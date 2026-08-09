// ─────────────────────────────────────────────────────────────────────────────
// Transport layer — the ONLY way dashboard code talks JSON over fetch.
//
// Every call carries a hard deadline (default 12s, per-call override so the
// AI generation steps keep their 125s ceiling), so a dead socket can never
// hang a screen: the 8-minute ECONNRESET class of failure becomes a
// classified 'timeout' after twelve seconds, and the UI decides what to do
// with it. Errors are classified — never a bare TypeError bubbling into a
// generic catch:
//
//   'timeout' — our deadline fired before the server answered.
//   'offline' — navigator.onLine is false, or fetch failed at the network
//               layer (DNS/socket/TypeError). Retryable when connectivity
//               returns.
//   'server'  — HTTP >= 400. Carries status + the parsed error body; the
//               message is the API's own `error` string when present.
//   'abort'   — an EXTERNAL AbortSignal fired (unmount, cancel, superseded).
//               Callers treat this as silence, exactly like today.
//
// Composable with an external signal: pass `init.signal` and unmount aborts
// still work — the internal deadline controller mirrors it.
// ─────────────────────────────────────────────────────────────────────────────

export type TransportErrorKind = 'timeout' | 'offline' | 'server' | 'abort';

export class TransportError extends Error {
  readonly kind: TransportErrorKind;
  /** HTTP status — present only for kind 'server'. */
  readonly status?: number;
  /** Parsed JSON error body — present only for kind 'server' (when readable). */
  readonly body?: unknown;

  constructor(kind: TransportErrorKind, message: string, opts?: { status?: number; body?: unknown }) {
    super(message);
    this.name = 'TransportError';
    this.kind = kind;
    this.status = opts?.status;
    this.body = opts?.body;
  }
}

/** Narrowing helper — `isTransportError(e) && e.kind === 'offline'` reads
 *  cleaner in catch blocks than repeated instanceof checks. */
export function isTransportError(error: unknown): error is TransportError {
  return error instanceof TransportError;
}

export const DEFAULT_TIMEOUT_MS = 12_000;

export type FetchJSONOptions = {
  /** Per-call deadline override — generation steps pass their 125s ceiling. */
  timeoutMs?: number;
};

export async function fetchJSON<T = unknown>(
  url: string,
  init: RequestInit = {},
  opts: FetchJSONOptions = {}
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // Definitely-offline fast path: navigator.onLine === false is authoritative
  // ("false" means no connection); don't burn the deadline on a doomed socket.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new TransportError('offline', 'You appear to be offline.');
  }

  const external = init.signal ?? undefined;
  if (external?.aborted) {
    throw new TransportError('abort', 'Request aborted.');
  }

  // Internal controller owns the socket; the external signal mirrors into it
  // so unmount/cancel aborts keep working alongside the deadline.
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onExternalAbort = () => controller.abort();
  external?.addEventListener('abort', onExternalAbort);

  const classifyAbort = (): TransportError =>
    timedOut
      ? new TransportError('timeout', 'The request timed out. Please try again.')
      : new TransportError('abort', 'Request aborted.');

  try {
    let res: Response;
    try {
      res = await fetch(url, { ...init, signal: controller.signal });
    } catch (err) {
      if (controller.signal.aborted) throw classifyAbort();
      if (err instanceof DOMException && err.name === 'AbortError') throw classifyAbort();
      // fetch rejects with TypeError on network-layer failure (DNS, socket
      // reset, connection refused) — the offline class.
      throw new TransportError('offline', 'Network request failed — you may be offline.');
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      if (controller.signal.aborted) throw classifyAbort();
      if (res.ok) {
        throw new TransportError('server', 'The server returned an unreadable response.', { status: res.status });
      }
      body = undefined; // error status with a non-JSON body — classify below
    }

    if (!res.ok) {
      const apiMessage =
        body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string'
          ? (body as { error: string }).error
          : `Request failed with status ${res.status}.`;
      throw new TransportError('server', apiMessage, { status: res.status, body });
    }

    return body as T;
  } finally {
    clearTimeout(timer);
    external?.removeEventListener('abort', onExternalAbort);
  }
}
