// ─────────────────────────────────────────────────────────────────────────────
// authRecovery — shared primitives for the seller password-recovery flow:
//
//   /forgot-password ─email─▶ /auth/callback?next=/update-password ─▶ /update-password ─▶ /dashboard
//
// Framework-neutral on purpose: no 'use client', no next/* imports, so the
// browser pages AND the server callback route import the same constants, the
// same open-redirect guard, and the same seller-facing error vocabulary.
// ─────────────────────────────────────────────────────────────────────────────

/** One password policy for the platform — mirrors app/register/page.tsx. */
export const PASSWORD_MIN_LENGTH = 6;

/** Gambia Standard: an auth round trip may never spin forever. Generous
 *  enough for a 2G/3G TLS handshake, short enough that the seller sees a
 *  retry prompt instead of a frozen button. */
export const AUTH_DEADLINE_MS = 15_000;

/** GoTrue rate-limits recovery emails to one per address per 60s. Mirroring
 *  that client-side turns a cryptic 429 into a visible countdown. */
export const RESEND_COOLDOWN_S = 60;

/** Where the callback sends a seller when `next` is absent or unsafe. */
export const DEFAULT_POST_AUTH_PATH = '/dashboard';

export class AuthDeadlineError extends Error {
  constructor() {
    super('The request timed out. Check your connection and try again.');
    this.name = 'AuthDeadlineError';
  }
}

/** Race an auth call against a hard deadline; the timer is always cleared. */
export async function withAuthDeadline<T>(work: Promise<T>, ms: number = AUTH_DEADLINE_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new AuthDeadlineError()), ms);
  });
  try {
    return await Promise.race([work, deadline]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

// ── Callback → /forgot-password error vocabulary ─────────────────────────────

export type RecoveryErrorCode = 'expired' | 'verifier' | 'invalid';

const RECOVERY_ERROR_CODES: ReadonlySet<string> = new Set(['expired', 'verifier', 'invalid']);

export function isRecoveryErrorCode(value: string | null | undefined): value is RecoveryErrorCode {
  return typeof value === 'string' && RECOVERY_ERROR_CODES.has(value);
}

export const RECOVERY_ERROR_COPY: Record<RecoveryErrorCode, { title: string; body: string }> = {
  expired: {
    title: 'That reset link has expired',
    body: 'Reset links work once and only for a short while. Request a fresh one below.',
  },
  verifier: {
    title: 'Open the link on this device',
    body:
      'For your security, a reset link only works in the browser that requested it. ' +
      'Request a new link here, then open the email on this same device.',
  },
  invalid: {
    title: 'That link is not valid',
    body: 'The link was incomplete or has already been used. Request a new one below.',
  },
};

// ── Open-redirect guard ──────────────────────────────────────────────────────

/** Accepts only same-origin absolute paths for the callback's `next` param.
 *  Rejects protocol-relative (`//evil.com`), backslash (`/\evil.com`) and
 *  scheme (`https://…`) forms by resolving against a sentinel origin and
 *  demanding that origin survive. Anything doubtful → DEFAULT_POST_AUTH_PATH. */
export function sanitizeNextPath(
  raw: string | null | undefined,
  fallback: string = DEFAULT_POST_AUTH_PATH
): string {
  if (typeof raw !== 'string') return fallback;
  const value = raw.trim();
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  try {
    const sentinel = 'http://next.invalid';
    const parsed = new URL(value, sentinel);
    if (parsed.origin !== sentinel) return fallback;
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return fallback;
  }
}

// ── Error → seller-facing copy ───────────────────────────────────────────────

type ErrorShape = { name?: unknown; code?: unknown; status?: unknown; message?: unknown };

function shape(error: unknown): ErrorShape {
  return error && typeof error === 'object' ? (error as ErrorShape) : {};
}

function lower(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase() : '';
}

/** True when the failure means "there is no usable session here" — the
 *  update form should collapse into its expired-link state. */
export function isSessionMissingError(error: unknown): boolean {
  const e = shape(error);
  if (e.name === 'AuthSessionMissingError' || e.code === 'session_not_found') return true;
  const message = lower(e.message);
  return message.includes('session missing') || message.includes('session_not_found');
}

/** Transport-class failure: dead radio, DNS, socket. Says nothing about the
 *  credentials — the seller should simply retry. */
export function isTransportFailure(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const e = shape(error);
  if (e.name === 'AuthRetryableFetchError' || e.status === 0) return true;
  if (error instanceof TypeError) return true;
  const message = lower(e.message);
  return message.includes('failed to fetch') || message.includes('network') || message.includes('load failed');
}

/** Translate a Supabase/network failure into one calm sentence a seller can
 *  act on. Raw GoTrue phrasing is passed through only for the rate-limit
 *  notice, which already reads well ("…you can only request this after 45
 *  seconds"). */
export function describeAuthError(error: unknown): string {
  if (error instanceof AuthDeadlineError) return error.message;
  if (isTransportFailure(error)) {
    return typeof navigator !== 'undefined' && navigator.onLine === false
      ? 'You are offline. Reconnect and try again.'
      : 'We could not reach the server. Check your connection and try again.';
  }

  const e = shape(error);
  const code = lower(e.code);
  const message = lower(e.message);

  if (e.status === 429 || code.includes('rate_limit') || message.includes('security purposes')) {
    return typeof e.message === 'string' && message.includes('security purposes')
      ? e.message
      : 'Too many attempts. Please wait a minute and try again.';
  }
  if (code === 'same_password' || message.includes('different from the old password')) {
    return 'Your new password must be different from your current one.';
  }
  if (code === 'weak_password' || message.includes('password should')) {
    return `Choose a stronger password of at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (code === 'reauthentication_needed' || message.includes('reauthentication')) {
    return 'This reset link has been open too long. Request a fresh link to continue.';
  }
  if (isSessionMissingError(error)) {
    return 'Your reset session has ended. Request a new link to continue.';
  }
  if (typeof e.message === 'string' && e.message.trim()) return e.message;
  return 'Something went wrong. Please try again.';
}
