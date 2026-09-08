'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, ShieldAlert } from 'lucide-react';
import {
  PASSWORD_MIN_LENGTH,
  describeAuthError,
  isSessionMissingError,
  withAuthDeadline,
} from '@/lib/authRecovery';

// ─────────────────────────────────────────────────────────────────────────────
// /update-password — step two of seller password recovery.
//
// Reached only WITH a session: proxy.ts bounces anonymous hits to
// /forgot-password?error=expired, and app/auth/callback has already written
// the recovery session into cookies before redirecting here. The page still
// resolves the session LOCALLY (getSession — a storage read, no network) so a
// dead radio can never masquerade as an expired link, and it listens for
// PASSWORD_RECOVERY in case the session lands a beat after first paint.
//
// updateUser({ password }) → /dashboard. Every failure surfaces as one calm
// sentence; a vanished session collapses the form into its expired state
// with a one-tap path back to a fresh link.
// ─────────────────────────────────────────────────────────────────────────────

type Phase = 'checking' | 'ready' | 'no-session' | 'saving' | 'done';

const INPUT_CLASS =
  'w-full rounded-xl border border-gray-200 bg-gray-50/50 px-5 py-4 pr-14 text-base font-medium text-gray-900 outline-none transition-all focus:border-gray-900 focus:bg-white focus:ring-1 focus:ring-gray-900';
const LABEL_CLASS = 'mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-500';
const PRIMARY_BUTTON_CLASS =
  'group flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a2e1a] py-4 text-xs font-bold uppercase tracking-widest text-white shadow-md transition-all hover:bg-black disabled:opacity-70';
const HINT_CLASS = 'mt-2 text-[10px] font-bold uppercase tracking-widest';

export default function UpdatePasswordPage() {
  const router = useRouter();
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [phase, setPhase] = useState<Phase>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Local truth first: the callback wrote the session into cookies, so this
    // resolves without a network hop. Only a genuine absence flips to the
    // expired-link state.
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (cancelled) return;
        setPhase((current) => (current === 'checking' ? (session ? 'ready' : 'no-session') : current));
      })
      .catch(() => {
        if (cancelled) return;
        setPhase((current) => (current === 'checking' ? 'no-session' : current));
      });

    // Belt and braces: if the session materialises a beat later, open the form.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) return;
      if (
        event === 'PASSWORD_RECOVERY' ||
        event === 'SIGNED_IN' ||
        event === 'INITIAL_SESSION' ||
        event === 'TOKEN_REFRESHED'
      ) {
        setPhase((current) => (current === 'checking' || current === 'no-session' ? 'ready' : current));
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const tooShort = password.length > 0 && password.length < PASSWORD_MIN_LENGTH;
  const longEnough = password.length >= PASSWORD_MIN_LENGTH;
  const mismatch = confirm.length > 0 && confirm !== password;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (phase !== 'ready') return;
    setError(null);

    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`Your password must be at least ${PASSWORD_MIN_LENGTH} characters long.`);
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match. Please try again.');
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setError('You are offline. Reconnect and try again.');
      return;
    }

    setPhase('saving');
    try {
      const { error: updateError } = await withAuthDeadline(supabase.auth.updateUser({ password }));
      if (updateError) throw updateError;
      setPhase('done');
      router.replace('/dashboard');
    } catch (err) {
      if (isSessionMissingError(err)) {
        setPhase('no-session');
        return;
      }
      setError(describeAuthError(err));
      setPhase('ready');
    }
  };

  const renderPanel = () => {
    if (phase === 'checking') {
      return (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="animate-spin text-gray-400" />
        </div>
      );
    }

    if (phase === 'no-session') {
      return (
        <div className="w-full max-w-md">
          <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <ShieldAlert size={24} />
          </div>
          <h2 className="text-3xl font-black tracking-tight text-gray-900">This link has expired</h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-500">
            Reset links work once, for a short while, and only in the browser that requested them.
            Request a fresh link and open it on this device.
          </p>
          <Link href="/forgot-password" className={`${PRIMARY_BUTTON_CLASS} mt-8`}>
            Request a new link
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/login"
            className="mt-4 flex min-h-[44px] w-full items-center justify-center text-xs font-bold uppercase tracking-widest text-gray-400 transition hover:text-gray-900"
          >
            Back to Sign In
          </Link>
        </div>
      );
    }

    if (phase === 'done') {
      return (
        <div className="w-full max-w-md">
          <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            <CheckCircle2 size={24} />
          </div>
          <h2 className="text-3xl font-black tracking-tight text-gray-900">Password updated</h2>
          <p className="mt-3 flex items-center gap-2 text-sm text-gray-500">
            <Loader2 size={14} className="animate-spin" /> Opening your dashboard…
          </p>
        </div>
      );
    }

    const saving = phase === 'saving';
    return (
      <div className="w-full max-w-md">
        <h2 className="text-3xl font-black tracking-tight text-gray-900">Create New Password</h2>
        <p className="mt-2 text-sm text-gray-500">
          Choose a new password for your boutique. You will stay signed in on this device.
        </p>

        <form onSubmit={handleSubmit} className="mt-10 space-y-6">
          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-xs font-bold text-red-600">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="new-password" className={LABEL_CLASS}>
                New Password
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={reveal ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  aria-invalid={tooShort}
                  className={INPUT_CLASS}
                />
                <button
                  type="button"
                  onClick={() => setReveal((r) => !r)}
                  aria-label={reveal ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex w-14 items-center justify-center text-gray-400 transition hover:text-gray-900"
                >
                  {reveal ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p
                className={`${HINT_CLASS} ${
                  tooShort ? 'text-red-500' : longEnough ? 'text-emerald-600' : 'text-gray-400'
                }`}
              >
                At least {PASSWORD_MIN_LENGTH} characters
              </p>
            </div>

            <div>
              <label htmlFor="confirm-password" className={LABEL_CLASS}>
                Confirm Password
              </label>
              <input
                id="confirm-password"
                type={reveal ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat password"
                required
                aria-invalid={mismatch}
                className={INPUT_CLASS}
              />
              {mismatch && <p className={`${HINT_CLASS} text-red-500`}>Passwords do not match</p>}
            </div>
          </div>

          <button type="submit" disabled={saving} className={PRIMARY_BUTTON_CLASS}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : 'Save Password'}
            {!saving && <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />}
          </button>
        </form>
      </div>
    );
  };

  return (
    <div className="flex min-h-dvh bg-white font-sans text-gray-900 selection:bg-gray-900 selection:text-white">
      {/* Editorial panel — the Seller Portal imagery shared with /login. */}
      <div className="relative hidden w-full lg:block lg:w-1/2">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a2e1a]/90 via-[#1a2e1a]/40 to-transparent" />

        <div className="absolute bottom-16 left-16 right-16">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.3em] text-emerald-400">Seller Portal</p>
          <h1 className="text-4xl font-serif leading-tight text-white xl:text-5xl">
            Choose a new <br /> password.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-gray-300">
            One new password and your dashboard, inventory, and customers are back at your fingertips.
          </p>
        </div>
      </div>

      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-20 xl:px-32">
        <div className="mb-12 flex w-fit items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400">
          <ShieldAlert size={16} /> Secure Reset
        </div>
        {renderPanel()}
      </div>
    </div>
  );
}
