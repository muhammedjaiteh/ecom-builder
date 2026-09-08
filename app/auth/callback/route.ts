import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { EmailOtpType } from '@supabase/supabase-js';
import { sanitizeNextPath, type RecoveryErrorCode } from '@/lib/authRecovery';

// ─────────────────────────────────────────────────────────────────────────────
// GET /auth/callback — the ONE landing pad for every Supabase email link.
//
// Callers:
//   · /forgot-password → resetPasswordForEmail({ redirectTo: …/auth/callback?next=/update-password })
//   · /register        → signUp({ emailRedirectTo: …/auth/callback })         (next → /dashboard)
//
// The @supabase/ssr browser client runs the PKCE flow: it stores a
// code-verifier cookie when the email is requested, GoTrue bounces the seller
// back here with ?code=…, and exchangeCodeForSession() trades code + verifier
// for a session written into cookies ON THIS REDIRECT RESPONSE — so the very
// next request (/update-password) already passes proxy.ts.
//
// Also accepted:
//   · ?token_hash=…&type=…  — email templates rewritten to {{ .TokenHash }}.
//     This is the durable fix for links opened in a different browser than
//     the one that requested them (in-app mail clients, a second phone),
//     where no verifier cookie can exist.
//   · ?error_code=…         — GoTrue's own bounce for links it already
//     rejected server-side (expired / already used).
//
// Failure never dead-ends on a blank page: recovery links return to
// /forgot-password with a coded explanation that page renders in prose; the
// `next` target is sanitized so this route can never become an open redirect.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic';

const EMAIL_OTP_TYPES: ReadonlySet<string> = new Set<EmailOtpType>([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
]);

/** The origin the seller's browser is actually on. Behind Vercel's edge the
 *  platform-set x-forwarded-host is authoritative; in local dev there is no
 *  proxy, so nextUrl.origin is the truth. */
function publicOrigin(request: NextRequest): string {
  if (process.env.NODE_ENV !== 'development') {
    const host = request.headers.get('x-forwarded-host');
    if (host) {
      const proto = request.headers.get('x-forwarded-proto') ?? 'https';
      return `${proto}://${host}`;
    }
  }
  return request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const origin = publicOrigin(request);
  const next = sanitizeNextPath(params.get('next'));
  const isRecovery = next.startsWith('/update-password') || params.get('type') === 'recovery';

  const succeed = () => NextResponse.redirect(new URL(next, origin));
  const fail = (code: RecoveryErrorCode) =>
    NextResponse.redirect(new URL(isRecovery ? `/forgot-password?error=${code}` : '/login', origin));

  // GoTrue already rejected the link server-side and bounced here with its
  // own error params — there is no code to exchange.
  const gotrueError = params.get('error_code') ?? params.get('error');
  if (gotrueError) {
    return fail(gotrueError === 'otp_expired' ? 'expired' : 'invalid');
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Route Handlers may mutate cookies; every set() lands as a
          // Set-Cookie header on the redirect response returned below.
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    }
  );

  const code = params.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return succeed();
    console.error('[auth/callback] code exchange failed:', error.code ?? error.name, error.message);
    // No verifier cookie = the link was opened somewhere other than the
    // browser that requested it. auth-js raises this as
    // AuthPKCECodeVerifierMissingError (pkce_code_verifier_not_found); GoTrue
    // reports the same condition as a validation error naming the verifier.
    const verifierMissing =
      error.name === 'AuthPKCECodeVerifierMissingError' ||
      error.code === 'pkce_code_verifier_not_found' ||
      /verifier/i.test(error.message);
    return fail(verifierMissing ? 'verifier' : 'expired');
  }

  const tokenHash = params.get('token_hash');
  const type = params.get('type');
  if (tokenHash && type && EMAIL_OTP_TYPES.has(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType });
    if (!error) return succeed();
    console.error('[auth/callback] token_hash verification failed:', error.code ?? error.name, error.message);
    return fail('expired');
  }

  return fail('invalid');
}
