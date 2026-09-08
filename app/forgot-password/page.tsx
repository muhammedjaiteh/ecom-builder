'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Loader2, MailCheck, ShieldAlert } from 'lucide-react';
import {
  RECOVERY_ERROR_COPY,
  RESEND_COOLDOWN_S,
  describeAuthError,
  isRecoveryErrorCode,
  withAuthDeadline,
} from '@/lib/authRecovery';

// ─────────────────────────────────────────────────────────────────────────────
// /forgot-password — step one of seller password recovery.
//
// Visual twin of /login: editorial retail panel on the left, minimalist form
// on the right. resetPasswordForEmail() runs the PKCE flow — the browser
// client stores a code-verifier cookie here, the emailed link lands on
// /auth/callback, and the callback swaps code + verifier for a session before
// forwarding to /update-password.
//
// Gambia Standard: hard deadline on the round trip, explicit offline copy,
// ≥44px targets, 16px inputs (no iOS zoom), and a visible resend countdown
// that mirrors GoTrue's email rate limit instead of surfacing a raw 429.
// ─────────────────────────────────────────────────────────────────────────────

const INPUT_CLASS =
  'w-full rounded-xl border border-gray-200 bg-gray-50/50 px-5 py-4 text-base font-medium text-gray-900 outline-none transition-all focus:border-gray-900 focus:bg-white focus:ring-1 focus:ring-gray-900';
const LABEL_CLASS = 'mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-500';
const PRIMARY_BUTTON_CLASS =
  'group flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a2e1a] py-4 text-xs font-bold uppercase tracking-widest text-white shadow-md transition-all hover:bg-black disabled:opacity-70';
const SECONDARY_BUTTON_CLASS =
  'flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-4 text-xs font-bold uppercase tracking-widest text-gray-900 transition-all hover:border-gray-900 disabled:opacity-60';
const ERROR_CLASS = 'rounded-xl border border-red-100 bg-red-50 p-4 text-xs font-bold text-red-600';

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const linkError = searchParams.get('error');
  const notice = isRecoveryErrorCode(linkError) ? RECOVERY_ERROR_COPY[linkError] : null;

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Resend countdown — one interval for the whole run, torn down at zero.
  const counting = cooldown > 0;
  useEffect(() => {
    if (!counting) return;
    const timer = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [counting]);

  const sendResetLink = async () => {
    const address = email.trim();
    if (!address || sending) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setError('You are offline. Reconnect and try again.');
      return;
    }

    setSending(true);
    setError(null);
    try {
      const { error: resetError } = await withAuthDeadline(
        supabase.auth.resetPasswordForEmail(address, {
          redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
        })
      );
      if (resetError) throw resetError;
      setSent(true);
      setCooldown(RESEND_COOLDOWN_S);
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void sendResetLink();
  };

  if (sent) {
    return (
      <div className="w-full max-w-md">
        <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
          <MailCheck size={24} />
        </div>
        <h2 className="text-3xl font-black tracking-tight text-gray-900">Check your email</h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-500">
          Check your email for the reset link. We sent it to{' '}
          <span className="font-bold text-gray-900">{email.trim()}</span>. Open it on this device to
          choose a new password.
        </p>
        <p className="mt-3 text-xs leading-relaxed text-gray-400">
          The link works once and expires soon. If it does not arrive within a few minutes, check your
          spam folder.
        </p>

        {error && <div className={`${ERROR_CLASS} mt-6`}>{error}</div>}

        <button
          type="button"
          onClick={() => void sendResetLink()}
          disabled={counting || sending}
          className={`${SECONDARY_BUTTON_CLASS} mt-8`}
        >
          {sending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : counting ? (
            `Resend in ${cooldown}s`
          ) : (
            'Resend link'
          )}
        </button>

        <Link
          href="/login"
          className="mt-4 flex min-h-[44px] w-full items-center justify-center text-xs font-bold uppercase tracking-widest text-gray-400 transition hover:text-gray-900"
        >
          Back to Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <h2 className="text-3xl font-black tracking-tight text-gray-900">Reset Password</h2>
      <p className="mt-2 text-sm text-gray-500">
        Enter the email for your boutique and we will send you a secure link to choose a new password.
      </p>

      {notice && (
        <div className="mt-8 flex gap-3 rounded-xl border border-amber-100 bg-amber-50 p-4">
          <ShieldAlert size={18} className="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <p className="text-xs font-bold text-amber-800">{notice.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-700">{notice.body}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className={`${notice ? 'mt-6' : 'mt-10'} space-y-6`}>
        {error && <div className={ERROR_CLASS}>{error}</div>}

        <div>
          <label htmlFor="email" className={LABEL_CLASS}>
            Email Address
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seller@boutique.com"
            required
            className={INPUT_CLASS}
          />
        </div>

        <button type="submit" disabled={sending} className={PRIMARY_BUTTON_CLASS}>
          {sending ? <Loader2 size={16} className="animate-spin" /> : 'Send Reset Link'}
          {!sending && <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />}
        </button>
      </form>

      <p className="mt-10 text-center text-xs font-medium text-gray-500">
        Remembered it?{' '}
        <Link href="/login" className="font-bold text-[#1a2e1a] hover:underline">
          Back to Sign In
        </Link>
      </p>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-dvh bg-white font-sans text-gray-900 selection:bg-gray-900 selection:text-white">
      {/* Editorial panel — the same retail imagery as /login, so recovery reads
          as part of the Seller Portal rather than a detour off-brand. */}
      <div className="relative hidden w-full lg:block lg:w-1/2">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a2e1a]/90 via-[#1a2e1a]/40 to-transparent" />

        <div className="absolute bottom-16 left-16 right-16">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.3em] text-emerald-400">Seller Portal</p>
          <h1 className="text-4xl font-serif leading-tight text-white xl:text-5xl">
            Locked out? <br /> Let us walk you back in.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-gray-300">
            One secure link, one new password, and your boutique is yours again.
          </p>
        </div>
      </div>

      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-20 xl:px-32">
        <Link
          href="/login"
          className="group mb-12 flex w-fit items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 transition hover:text-gray-900"
        >
          <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" /> Back to Sign In
        </Link>

        <Suspense
          fallback={
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-gray-400" />
            </div>
          }
        >
          <ForgotPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
