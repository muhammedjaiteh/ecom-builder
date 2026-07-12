// AD STUDIO progress contract — shared by the SSE pipeline routes
// (app/api/ai/generate-still, app/api/ai/animate-still) and the client
// consumer (components/VideoManager.tsx).
//
// Wire format: standard Server-Sent Events. Every event is a single
// `data: <json>\n\n` frame carrying an AdProgressEvent. Terminal frames are
// 'result' (mirrors the exact JSON payload the non-streaming route returns)
// or 'error' (mirrors the { error } JSON + HTTP status the non-streaming
// route would have used). This file is client-safe — no server-only imports.

export type AdStageKey =
  | 'directing'
  | 'extracting'
  | 'composing'
  | 'preview_ready'
  | 'animating'
  | 'finalizing'
  | 'completed';

export type AdStageStatus = 'pending' | 'active' | 'done';

export type AdStageDef = { key: AdStageKey; label: string };

export type AdProgressEvent =
  // A pipeline stage became active. `soft` activations (used for stages that
  // run in parallel with an earlier one) must NOT auto-complete prior stages.
  | { t: 'stage'; key: AdStageKey; soft?: boolean }
  // A pipeline stage finished.
  | { t: 'stage-done'; key: AdStageKey }
  // Granular micro-update inside the active stage (fal queue position,
  // Creatomate render ticks, …).
  | { t: 'detail'; key: AdStageKey; message: string }
  // Terminal success — payload is byte-for-byte what the JSON route returns.
  | { t: 'result'; status: number; payload: Record<string, unknown> }
  // Terminal failure — mirrors the JSON error contract.
  | { t: 'error'; status: number; error: string }
  // Heartbeat so buffering proxies keep the connection warm.
  | { t: 'ping' };

// ── Stage checklists (ordered) ─────────────────────────────────────────────
// The keys 'composing' | 'preview_ready' | 'animating' | 'finalizing' |
// 'completed' intentionally match the DB pipeline_stage values so realtime /
// render-status updates can drive the same checklist. 'directing' and
// 'extracting' are stream-only micro-stages that are never written to the DB.

export const STILL_STAGES: AdStageDef[] = [
  { key: 'directing', label: 'Directing the creative brief' },
  { key: 'extracting', label: 'Isolating your product — pixel-perfect' },
  { key: 'composing', label: 'Compositing the luxury scene' },
  { key: 'preview_ready', label: 'Polishing your preview' },
];

// NOTE: the dashboard client no longer consumes the animate pipeline over
// SSE — video renders are a fire-and-forget background handoff (compact
// status chip + dashboard-wide notifier, driven by DB pipeline_stage). This
// checklist remains part of the wire contract for the route's SSE mode.
export const ANIMATE_STAGES: AdStageDef[] = [
  { key: 'animating', label: 'Filming cinematic motion' },
  { key: 'finalizing', label: 'Assembling your commercial' },
  { key: 'completed', label: 'Delivering the final cut' },
];

// ── Checklist state transitions (pure, client-side) ────────────────────────

export function initialStageStatuses(order: AdStageDef[]): Record<string, AdStageStatus> {
  // First stage starts 'active' so the stepper looks alive even if the
  // stream yields no events (e.g. behind a buffering proxy).
  const statuses: Record<string, AdStageStatus> = {};
  order.forEach((s, i) => { statuses[s.key] = i === 0 ? 'active' : 'pending'; });
  return statuses;
}

export function advanceStages(
  prev: Record<string, AdStageStatus>,
  key: AdStageKey,
  order: AdStageDef[],
  soft = false
): Record<string, AdStageStatus> {
  const idx = order.findIndex((s) => s.key === key);
  if (idx === -1) return prev;
  const next: Record<string, AdStageStatus> = { ...prev };
  if (!soft) {
    // A non-soft activation implies everything before it finished — this also
    // heals dropped events and powers DB pipeline_stage jumps (realtime/poll).
    for (let i = 0; i < idx; i++) next[order[i].key] = 'done';
  }
  if (next[key] !== 'done') next[key] = 'active';
  return next;
}

export function completeStage(
  prev: Record<string, AdStageStatus>,
  key: AdStageKey
): Record<string, AdStageStatus> {
  return { ...prev, [key]: 'done' };
}

// ── fal queue-update → human copy ──────────────────────────────────────────
// @fal-ai/client's subscribe() exposes onQueueUpdate with statuses
// IN_QUEUE (with queue_position) / IN_PROGRESS / COMPLETED. Every member of
// the client's QueueStatus union is structurally assignable to this shape.

export type FalQueueUpdate = { status?: string; queue_position?: number };

export function describeFalQueueUpdate(
  update: FalQueueUpdate | null | undefined,
  stageName: string
): string | null {
  if (!update?.status) return null;
  if (update.status === 'IN_QUEUE') {
    return typeof update.queue_position === 'number' && update.queue_position > 0
      ? `${stageName} queued — position ${update.queue_position} in line…`
      : `${stageName} queued on a studio GPU…`;
  }
  if (update.status === 'IN_PROGRESS') return `${stageName} rendering on GPU…`;
  if (update.status === 'COMPLETED') return `${stageName} render complete.`;
  return null;
}

// ── Server: pipeline errors that carry a user-facing message + HTTP status ─

export class AdPipelineError extends Error {
  readonly status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = 'AdPipelineError';
    this.status = status;
  }
}

// ── Server: SSE stream factory ─────────────────────────────────────────────

export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  // nginx and similar reverse proxies buffer by default; this disables it.
  'X-Accel-Buffering': 'no',
} as const;

const HEARTBEAT_INTERVAL_MS = 10_000;

export function createAdProgressStream(): {
  readable: ReadableStream<Uint8Array>;
  send: (event: AdProgressEvent) => void;
  close: () => void;
} {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let closed = false;
  let lastDetailSignature = '';
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stopHeartbeat = () => {
    if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
  };

  const send = (event: AdProgressEvent) => {
    if (closed || !controller) return;
    // fal polls its queue roughly every second — dedupe identical detail
    // frames so the stream stays lean.
    if (event.t === 'detail') {
      const signature = `${event.key}|${event.message}`;
      if (signature === lastDetailSignature) return;
      lastDetailSignature = signature;
    }
    try {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    } catch {
      // Client disconnected mid-stream — the pipeline keeps running so the
      // DB row still reaches a terminal state for rehydration on refresh.
      closed = true;
      stopHeartbeat();
    }
  };

  const readable = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
      // Flush an SSE comment immediately so proxies commit to streaming.
      c.enqueue(encoder.encode(': ad-progress-stream\n\n'));
      heartbeat = setInterval(() => send({ t: 'ping' }), HEARTBEAT_INTERVAL_MS);
    },
    cancel() {
      closed = true;
      stopHeartbeat();
    },
  });

  const close = () => {
    if (closed) return;
    closed = true;
    stopHeartbeat();
    try { controller?.close(); } catch { /* already closed by cancel */ }
  };

  return { readable, send, close };
}

// ── Client: streaming fetch consumer ───────────────────────────────────────
// EventSource cannot POST, so the client consumes the stream via fetch +
// response.body.getReader(), parsing `data:` frames incrementally. If the
// server (or an old deployment) answers with plain JSON, this degrades to the
// exact pre-SSE behavior — the JSON error contract is unchanged either way.

export type AdPipelineResult =
  | { ok: true; status: number; payload: Record<string, unknown> }
  | { ok: false; status: number; error: string };

const STREAM_DROP_MESSAGE =
  'The connection dropped mid-generation. Your generation may still complete — refresh to check.';

export async function fetchAdPipeline(
  url: string,
  body: Record<string, unknown>,
  opts: { signal?: AbortSignal; onEvent?: (event: AdProgressEvent) => void } = {}
): Promise<AdPipelineResult> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  const contentType = res.headers.get('content-type') ?? '';

  // Plain JSON — auth/validation errors always return before the stream
  // starts, and older deployments never stream at all.
  if (!contentType.includes('text/event-stream')) {
    let data: Record<string, unknown> | null = null;
    try {
      data = await res.json();
    } catch {
      // Vercel 502/504 bodies are HTML — fall through to the fallback copy.
    }
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: (data?.error as string) || 'Request failed. Please try again.',
      };
    }
    return { ok: true, status: res.status, payload: data ?? {} };
  }

  if (!res.body) {
    return { ok: false, status: res.status, error: 'Streaming is not supported by this browser.' };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let terminal: AdPipelineResult | null = null;

  const parseFrame = (frame: string): AdProgressEvent | null => {
    const json = frame
      .split('\n')
      .map((line) => line.replace(/\r$/, ''))
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');
    if (!json) return null; // comment / heartbeat frame

    try {
      return JSON.parse(json) as AdProgressEvent;
    } catch {
      return null; // malformed frame — skip, the terminal frame still decides
    }
  };

  const applyEvent = (event: AdProgressEvent | null): AdPipelineResult | null => {
    if (!event) return null;
    if (event.t === 'result') {
      return { ok: true, status: event.status, payload: event.payload };
    }
    if (event.t === 'error') {
      return { ok: false, status: event.status, error: event.error };
    }
    if (event.t !== 'ping') opts.onEvent?.(event);
    return null;
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let separatorIdx: number;
    while ((separatorIdx = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, separatorIdx);
      buffer = buffer.slice(separatorIdx + 2);
      terminal = applyEvent(parseFrame(frame)) ?? terminal;
    }
  }
  if (buffer.trim()) {
    terminal = applyEvent(parseFrame(buffer)) ?? terminal; // trailing frame without \n\n
  }

  if (terminal) return terminal;
  // Stream closed without a terminal frame (network drop / proxy reset).
  // status 0 lets callers distinguish this from a real server error.
  return { ok: false, status: 0, error: STREAM_DROP_MESSAGE };
}
