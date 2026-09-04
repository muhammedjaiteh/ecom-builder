import { generateObject, type LanguageModel, type ModelMessage } from 'ai';
import { google } from '@ai-sdk/google';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import type { ZodSchema } from 'zod';

// Provider cascade: try in order. Adding a 4th provider or reordering is a one-line change.
type GenerateObjectProviderOptions = Parameters<typeof generateObject>[0]['providerOptions'];
export type ProviderEntry = {
  name: string;
  model: LanguageModel;
  /** Per-provider call options forwarded to generateObject (e.g. the
   *  Anthropic structured-output mode). Non-matching providers ignore
   *  foreign namespaces, so this is a no-op for Gemini/OpenAI entries. */
  providerOptions?: GenerateObjectProviderOptions;
};

const PROVIDERS: ProviderEntry[] = [
  { name: 'anthropic', model: anthropic('claude-sonnet-5') },
  { name: 'google',    model: google('gemini-2.5-flash') },
  { name: 'openai',    model: openai('gpt-4o-mini') },
];

/**
 * FLAGSHIP CREATIVE — claude-fable-5-1 (live-verified against the Models API
 * 2026-08-30: released 2026-08-28, 1M context, 128K output, adaptive-only
 * thinking). WEBSITE GENERATION ONLY per founder decision — passed as
 * primaryOverride by app/api/ai/generate-website (concepts + execute); every
 * other AI route stays on the standard PROVIDERS cascade above. ~5x Sonnet
 * pricing — do NOT add it to the default cascade. Refusal/content-filter
 * outcomes provably fall through to sonnet-5: see isRefusalOutcome below.
 */
export const FLAGSHIP_CREATIVE_PROVIDER: ProviderEntry = {
  name: 'anthropic-fable',
  model: anthropic('claude-fable-5-1'),
  // STRUCTURED OUTPUT MODE — REQUIRED for this model (found 2026-09-05 via the
  // dev harness): claude-fable-5-1 rejects forced tool_choice ("type 'tool'
  // and 'any' are not supported for this model"). @ai-sdk/anthropic 3.0.81's
  // default 'auto' mode only uses Anthropic's native output_config.format
  // for model ids on its hardcoded known-model list — which predates Fable
  // 5.1 — so 'auto' silently fell back to the forced `json` tool and the
  // request 400'd before any generation. 'outputFormat' pins the native
  // json_schema structured output (capabilities.structured_outputs.supported
  // = true per the live Models API). Sonnet-5 on the default cascade stays on
  // 'auto' — untouched request shape, untouched cache namespace.
  providerOptions: { anthropic: { structuredOutputMode: 'outputFormat' } },
};

const SAME_PROVIDER_RETRY_MS = 500;

/**
 * Safety-classifier refusal / content-filter detection (added 2026-09-02 with
 * the claude-fable-5-1 primary — its classifiers decline more assertively
 * than sonnet's). Three surfaces via the installed AI SDK ('ai' v6.0.197):
 *   (a) generateObject throws AI_NoObjectGeneratedError when a refusal yields
 *       no parsable object (already cascadeable via the name check) — it
 *       carries finishReason 'content-filter' (@ai-sdk/anthropic maps
 *       Anthropic stop_reason 'refusal' → 'content-filter');
 *   (b) that finishReason on the error or its cause, checked here directly;
 *   (c) an APICallError whose body says the output was blocked by the content
 *       filtering policy — Anthropic serves these as HTTP 400, which the
 *       status branch in isCascadeable would otherwise fail-fast as a
 *       config bug.
 * A refusal is model-specific, not request-invalid: the next provider in the
 * cascade routinely completes the same prompt. So refusals must CASCADE and
 * must NOT same-provider retry (the same model re-refuses the same prompt).
 *
 * SCOPE: consulted ONLY for the caller's primaryOverride provider (the
 * `refusalCascades` flag threaded through isCascadeable/isRetryWorthy).
 * The default PROVIDERS cascade — every route that passes no override —
 * keeps its historical classification byte-for-byte: an Anthropic 400
 * still fails fast there, and refusal-shaped messages still take the same
 * retry/fail paths they always did. Fable is the only model in this repo
 * whose classifier posture justified the new branch; widening it to the
 * default chain would be an unreviewed behavior change on every AI route.
 */
function isRefusalOutcome(err: unknown): boolean {
  const e = err as {
    finishReason?: unknown;
    message?: unknown;
    responseBody?: unknown;
    cause?: { finishReason?: unknown; message?: unknown };
  } | null | undefined;
  const finish = e?.finishReason ?? e?.cause?.finishReason;
  if (finish === 'content-filter') return true;
  const text = `${e?.message ?? ''} ${e?.responseBody ?? ''} ${e?.cause?.message ?? ''}`.toLowerCase();
  return (
    text.includes('content filter') ||   // "content filter" / "content filtering policy"
    text.includes('content_filter') ||
    text.includes('output blocked') ||
    /\brefusal\b/.test(text)             // \b guards: never matches ECONNREFUSED / "connection refused"
  );
}

/**
 * Override-specific REQUEST-SHAPE rejection (added 2026-09-05). The flagship
 * primaryOverride is an optimization layered over the default chain, so a
 * request shape the override's model rejects — HTTP 400/404/422 or an
 * explicit "not supported for this model" — is routinely accepted by sonnet-5
 * next in line (the canonical case: claude-fable-5-1 refusing forced
 * tool_choice before structuredOutputMode was pinned). These must CASCADE and
 * must never same-provider retry (the same request re-fails identically).
 * Auth/billing (401/402/403) are deliberately EXCLUDED — the same key would
 * fail on every Anthropic entry, so failing fast there is still correct.
 * SCOPE: consulted ONLY for the primaryOverride entry, like isRefusalOutcome.
 */
function isOverrideRequestRejection(err: unknown): boolean {
  const e = err as {
    statusCode?: unknown;
    status?: unknown;
    response?: { status?: unknown };
    message?: unknown;
    responseBody?: unknown;
  } | null | undefined;
  const status = e?.statusCode ?? e?.status ?? e?.response?.status;
  if (status === 400 || status === 404 || status === 422) return true;
  const text = `${e?.message ?? ''} ${e?.responseBody ?? ''}`.toLowerCase();
  return text.includes('not supported for this model');
}

/**
 * Should we move on to the NEXT provider after this error?
 * YES for transient availability/network problems and Zod-shape mismatches.
 * NO for auth, billing, and malformed-request errors — these are configuration bugs
 * that won't go away by trying a different provider, and cascading would silently
 * mask them while burning fallback credits.
 *
 * `refusalCascades` is true only when the erroring provider is the caller's
 * primaryOverride (Fable) — see isRefusalOutcome. With it false, this function
 * is byte-identical to the pre-Fable classifier.
 */
function isCascadeable(err: any, refusalCascades: boolean): boolean {
  // Zod / structured-output failures — different providers may conform to the schema differently.
  const name = err?.name ?? err?.cause?.name;
  if (
    name === 'AI_TypeValidationError' || name === 'TypeValidationError' ||
    name === 'AI_NoObjectGeneratedError' || name === 'NoObjectGeneratedError' ||
    name === 'ZodError'
  ) {
    return true;
  }

  // Safety-classifier refusals / content-filter outcomes — CASCADE to the
  // next provider (sonnet-5 first when the Fable primaryOverride refused).
  // Deliberately checked BEFORE the HTTP-status branch: Anthropic serves
  // classifier declines as 400, which would otherwise fail fast below.
  // Gated on refusalCascades so the un-overridden default cascade keeps its
  // historical fail-fast-on-400 behavior (isRefusalOutcome is not even
  // evaluated there).
  if (refusalCascades && isRefusalOutcome(err)) return true;

  // Override-specific request-shape rejections — CASCADE to the default chain
  // (see isOverrideRequestRejection). Also before the status branch: these are
  // 400-class errors that the default cascade rightly fails fast on, but that
  // the override must degrade through, never surface to the seller.
  if (refusalCascades && isOverrideRequestRejection(err)) return true;

  // Network errors (no HTTP status) — cascadeable
  const code = err?.code;
  if (code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ENETUNREACH' || code === 'ECONNREFUSED') {
    return true;
  }
  if (err?.name === 'TypeError' && String(err?.message ?? '').toLowerCase().includes('fetch')) {
    return true;
  }

  // HTTP status classification — the load-bearing branch
  const status = err?.statusCode ?? err?.status ?? err?.response?.status;
  if (typeof status === 'number') {
    if (status === 408 || status === 429) return true;            // timeout, rate limit
    if (status >= 500 && status < 600) return true;               // server errors
    return false;                                                 // 400/401/403/404/422 → fail fast
  }

  // No numeric status — Vercel AI SDK sometimes wraps errors with status in the message
  const msg = String(err?.message ?? '').toLowerCase();
  return (
    msg.includes('overloaded') || msg.includes('unavailable') ||
    msg.includes('rate limit') || msg.includes('quota') ||
    msg.includes('too many requests') || msg.includes('timed out') ||
    msg.includes('503') || msg.includes('502') || msg.includes('504') || msg.includes('429')
  );
}

/**
 * Should we wait briefly and retry the SAME provider before cascading?
 * Yes for true server-side hiccups (Gemini 503 micro-stutter is the canonical case).
 * NO for Zod/shape failures — the same prompt will produce the same bad output from
 * the same model, so the wait is wasted; we should immediately cascade.
 */
function isRetryWorthy(err: any, refusalCascades: boolean): boolean {
  const name = err?.name ?? err?.cause?.name;
  if (
    name === 'AI_TypeValidationError' || name === 'TypeValidationError' ||
    name === 'AI_NoObjectGeneratedError' || name === 'NoObjectGeneratedError' ||
    name === 'ZodError'
  ) {
    return false;
  }
  // Refusals from the primaryOverride: same prompt → same decline from the
  // same model. The 500ms wait is pure waste — cascade immediately
  // (isCascadeable says yes). Gated like isCascadeable's refusal branch so
  // the default cascade's retry decisions are untouched.
  if (refusalCascades && isRefusalOutcome(err)) return false;
  // Same for override request-shape rejections: identical request, identical
  // 400 — cascade immediately instead of burning the 500ms retry.
  if (refusalCascades && isOverrideRequestRejection(err)) return false;
  return isCascadeable(err, refusalCascades);
}

function buildMessages(
  prompt: string,
  images?: Array<{ data: string; mimeType: string }>,
  cachedSystem?: string,
): ModelMessage[] {
  const messages: ModelMessage[] = [];

  // Anthropic prompt caching: a stable instruction prefix in its own system
  // message, marked ephemeral. Non-Anthropic providers in the cascade ignore
  // providerOptions.anthropic, so this is a no-op for Gemini/OpenAI. The cache
  // only hits when cachedSystem is byte-identical across calls — callers must
  // keep ALL per-request content out of it.
  if (cachedSystem) {
    messages.push({
      role: 'system',
      content: cachedSystem,
      providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
    });
  }

  if (!images || images.length === 0) {
    messages.push({ role: 'user', content: prompt });
    return messages;
  }
  messages.push({
    role: 'user',
    content: [
      { type: 'text', text: prompt },
      ...images.map((img) => ({
        type: 'image' as const,
        image: img.data,
        mediaType: img.mimeType,
      })),
    ],
  });
  return messages;
}

async function callOneProvider<T>(
  provider: ProviderEntry,
  schema: ZodSchema<T>,
  messages: ModelMessage[],
  callerName: string,
  refusalCascades: boolean,
): Promise<T> {
  const callOptions = provider.providerOptions ? { providerOptions: provider.providerOptions } : {};
  try {
    const { object } = await generateObject({ model: provider.model, schema, messages, ...callOptions });
    return object as T;
  } catch (err: any) {
    if (!isRetryWorthy(err, refusalCascades)) throw err; // outer loop decides whether to cascade or fail fast
    console.warn(
      `[${callerName}] ${provider.name} transient hiccup — retrying once in ${SAME_PROVIDER_RETRY_MS}ms:`,
      err?.message ?? err
    );
    await new Promise((r) => setTimeout(r, SAME_PROVIDER_RETRY_MS));
    const { object } = await generateObject({ model: provider.model, schema, messages, ...callOptions });
    return object as T;
  }
}

export type GenerateWithFallbackOpts<T> = {
  schema: ZodSchema<T>;
  prompt: string;
  images?: Array<{ data: string; mimeType: string }>;
  callerName: string;
  /**
   * Optional stable instruction prefix, sent as a leading system message with
   * Anthropic cache_control (ephemeral). Must be byte-identical across calls
   * for the cache to hit — never interpolate per-request data into it.
   */
  cachedSystem?: string;
  /**
   * Optional per-call PRIMARY provider, prepended ahead of the standard
   * cascade: effective order becomes [primaryOverride, ...PROVIDERS], so any
   * cascadeable failure on the override (refusal, transient, shape) falls
   * through to the default chain (sonnet-5 first). Refusal/content-filter
   * classification (isRefusalOutcome) applies to the override entry ONLY:
   * absent this field — or once the cascade has fallen past it — error
   * handling is byte-identical to the historical PROVIDERS cascade.
   */
  primaryOverride?: ProviderEntry;
};

export type GenerateWithFallbackResult<T> = {
  data: T;
  provider: string;
};

/**
 * Two-level resilience:
 *   1. Per-provider: one fast retry on transient availability errors (500ms wait).
 *   2. Cross-provider: cascade to the next provider on transient/shape errors.
 *
 * Auth/billing/malformed-request errors propagate immediately — no retry, no cascade,
 * no silent masking.
 */
export async function generateWithFallback<T>(
  opts: GenerateWithFallbackOpts<T>
): Promise<GenerateWithFallbackResult<T>> {
  const messages = buildMessages(opts.prompt, opts.images, opts.cachedSystem);
  let lastError: any;

  const cascade = opts.primaryOverride ? [opts.primaryOverride, ...PROVIDERS] : PROVIDERS;
  for (const provider of cascade) {
    // Refusal-cascade classification is scoped to the primaryOverride entry
    // itself (reference identity — cascade[0] IS opts.primaryOverride). The
    // default PROVIDERS run — and the fallback tail of an overridden run —
    // classify errors exactly as the pre-Fable cascade did.
    const refusalCascades = provider === opts.primaryOverride;
    try {
      const data = await callOneProvider(provider, opts.schema, messages, opts.callerName, refusalCascades);
      return { data, provider: provider.name };
    } catch (err: any) {
      if (!isCascadeable(err, refusalCascades)) {
        console.error(
          `[${opts.callerName}] ${provider.name} returned a non-cascadeable error — failing fast:`,
          err?.message ?? err
        );
        throw err;
      }
      lastError = err;
      console.warn(
        `[${opts.callerName}] ${provider.name} failed after retry — cascading to next provider:`,
        err?.message ?? err
      );
    }
  }

  throw lastError ?? new Error('All providers in the cascade failed.');
}
