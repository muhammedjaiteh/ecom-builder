import { generateObject, type LanguageModel, type ModelMessage } from 'ai';
import { google } from '@ai-sdk/google';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import type { ZodSchema } from 'zod';

// Provider cascade: try in order. Adding a 4th provider or reordering is a one-line change.
type ProviderEntry = { name: string; model: LanguageModel };

const PROVIDERS: ProviderEntry[] = [
  // Anthropic first: the cachedSystem prompt-cache directive earns on every
  // request when Claude is primary, instead of only on cascade fallback.
  { name: 'anthropic', model: anthropic('claude-3-5-sonnet-20241022') },
  { name: 'google',    model: google('gemini-2.5-flash') },
  { name: 'openai',    model: openai('gpt-4o-mini') },
];

const SAME_PROVIDER_RETRY_MS = 500;

/**
 * Should we move on to the NEXT provider after this error?
 * YES for transient availability/network problems and Zod-shape mismatches.
 * NO for auth, billing, and malformed-request errors — these are configuration bugs
 * that won't go away by trying a different provider, and cascading would silently
 * mask them while burning fallback credits.
 */
function isCascadeable(err: any): boolean {
  // Zod / structured-output failures — different providers may conform to the schema differently.
  const name = err?.name ?? err?.cause?.name;
  if (
    name === 'AI_TypeValidationError' || name === 'TypeValidationError' ||
    name === 'AI_NoObjectGeneratedError' || name === 'NoObjectGeneratedError' ||
    name === 'ZodError'
  ) {
    return true;
  }

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
function isRetryWorthy(err: any): boolean {
  const name = err?.name ?? err?.cause?.name;
  if (
    name === 'AI_TypeValidationError' || name === 'TypeValidationError' ||
    name === 'AI_NoObjectGeneratedError' || name === 'NoObjectGeneratedError' ||
    name === 'ZodError'
  ) {
    return false;
  }
  return isCascadeable(err);
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
): Promise<T> {
  try {
    const { object } = await generateObject({ model: provider.model, schema, messages });
    return object as T;
  } catch (err: any) {
    if (!isRetryWorthy(err)) throw err; // outer loop decides whether to cascade or fail fast
    console.warn(
      `[${callerName}] ${provider.name} transient hiccup — retrying once in ${SAME_PROVIDER_RETRY_MS}ms:`,
      err?.message ?? err
    );
    await new Promise((r) => setTimeout(r, SAME_PROVIDER_RETRY_MS));
    const { object } = await generateObject({ model: provider.model, schema, messages });
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

  for (const provider of PROVIDERS) {
    try {
      const data = await callOneProvider(provider, opts.schema, messages, opts.callerName);
      return { data, provider: provider.name };
    } catch (err: any) {
      if (!isCascadeable(err)) {
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
