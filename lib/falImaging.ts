import { fal } from '@/lib/fal';
import { AdPipelineError, type FalQueueUpdate } from '@/lib/adProgress';

// ─────────────────────────────────────────────────────────────────────────────
// Shared Fal imaging helpers — extracted VERBATIM from the Ad Studio still
// pipeline (app/api/ai/generate-still) so the website asset engine
// (lib/siteAssets.ts) reuses the exact same URL extraction and silent-failure
// detection instead of growing a divergent copy. Behavior is byte-identical
// to the pre-extraction route; only the log prefix is parameterized by
// caller. Server-only (lib/fal reads FAL_API_KEY).
// ─────────────────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

// Bulletproof URL extraction — Fal models return image URLs under several
// different keys depending on the model (image.url, images[0].url, image_url, url, etc.).
// The Fal client wraps everything in { data, requestId }; older shims hand back the raw payload,
// so we check both.
export function extractFalImageUrl(result: any): string | null {
  if (!result) return null;
  const data = result.data ?? result;
  if (!data) return null;
  if (typeof data === 'string') return data;

  return (
    data.image?.url ||
    data.images?.[0]?.url ||
    data.image_url ||
    data.url ||
    data.output?.url ||
    data.output?.[0]?.url ||
    (typeof data.output === 'string' ? data.output : null) ||
    null
  );
}

export function logFalFailure(caller: string, stage: string, result: any) {
  console.error(
    `[${caller}] ${stage} — could not extract image URL. Full Fal response:`,
    JSON.stringify(result, null, 2)
  );
}

export type FalSubscribeOptions = {
  /** Log prefix — '[generate-still]' for the Ad Studio, '[site-assets]' for
   *  the website asset engine. */
  caller: string;
  /** Optional progress hook — feeds the Ad Studio SSE stream. It never
   *  changes model inputs or outputs. */
  onQueueUpdate?: (update: FalQueueUpdate) => void;
};

// Wraps fal.subscribe so 422/4xx failures surface the actual FastAPI `detail`
// array instead of opaque "[Object]" output. Re-throws so existing error flow is unchanged.
export async function falSubscribeWithLogging<T = any>(
  modelId: string,
  input: Record<string, unknown>,
  stageLabel: string,
  opts: FalSubscribeOptions,
): Promise<T> {
  const { caller, onQueueUpdate } = opts;
  try {
    const result = (await fal.subscribe(modelId, { input, logs: false, onQueueUpdate })) as T;

    // ── Silent-failure detection (apparent-success responses with bad payloads) ──
    // Some Fal models return HTTP 200 + a valid URL pointing at a blank/black PNG
    // when their content filter triggers. We catch two signals before returning so
    // the UI sees a clean error instead of rendering a black image.
    const data = (result as any)?.data ?? result;

    // NSFW / content-filter trigger — Flux endpoints expose this on success.
    const nsfwFlagged =
      data?.has_nsfw_concepts?.[0] === true ||
      data?.has_nsfw_concepts === true ||
      data?.nsfw_detected === true ||
      data?.is_nsfw === true;
    if (nsfwFlagged) {
      console.error(
        `[${caller}] Fal ${modelId} (${stageLabel}) was content-filtered. Full response:`,
        JSON.stringify(data, null, 2)
      );
      // AdPipelineError carries this crafted copy all the way to the seller
      // instead of collapsing into the generic catch-all message.
      throw new AdPipelineError(
        `${stageLabel} output was blocked by the provider's content filter. Please retry or use a different photo.`,
        500
      );
    }

    // Suspiciously small file size = likely blank / near-empty image.
    // Real images are consistently >50KB; blank PNGs of any size compress to <2KB.
    // Check is defensive — only fires if the model exposes file_size at all.
    const imageField = data?.image ?? data?.images?.[0];
    const fileSize = imageField?.file_size;
    if (typeof fileSize === 'number' && fileSize < 2000) {
      console.error(
        `[${caller}] Fal ${modelId} (${stageLabel}) returned suspiciously small file (${fileSize} bytes) — likely blank/black. Full response:`,
        JSON.stringify(data, null, 2)
      );
      throw new AdPipelineError(
        `${stageLabel} returned an empty image. The model may have failed silently. Please retry.`,
        500
      );
    }

    return result;
  } catch (err: any) {
    const status = err?.status ?? err?.response?.status ?? 'unknown';
    const body = err?.body ?? err?.response?.body ?? err?.responseBody;
    console.error(`[${caller}] Fal ${modelId} (${stageLabel}) failed — HTTP ${status}`);
    console.error(`[${caller}] Fal error body:`, JSON.stringify(body ?? err, null, 2));
    if (err?.message) console.error(`[${caller}] Fal error message:`, err.message);
    throw err;
  }
}
