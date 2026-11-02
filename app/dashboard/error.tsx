'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Branded error boundary for the seller dashboard. Renders INSIDE
// app/dashboard/layout.tsx, so the sidebar / mobile Menu pill stay available
// and the seller can navigate away even when a page segment throws. Uses the
// --dash-* tokens (app/globals.css) like DashboardShell. Launch Hardening P0.
// ─────────────────────────────────────────────────────────────────────────────

import Link from 'next/link';
import { useEffect } from 'react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[sanndikaa] dashboard error', error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-dash-bone px-6 py-24 text-center font-sans text-dash-forest">
      <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-dash-gold">Dashboard</p>
      <h1 className="mt-4 max-w-xl text-balance font-serif text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
        This page hit a snag.
      </h1>
      <p className="mt-4 max-w-md text-sm leading-6 text-dash-forest/70">
        Your boutique, products and orders are safe. Reload this page, or head back to your dashboard overview.
      </p>
      <div className="mt-10 flex w-full max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={() => reset()}
          className="h-12 rounded-full bg-dash-forest px-8 text-sm font-semibold text-dash-bone transition hover:brightness-110 active:scale-[0.98]"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="flex h-12 items-center justify-center rounded-full px-8 text-sm font-semibold text-dash-forest ring-1 ring-dash-forest/20 transition hover:bg-dash-forest/5"
        >
          Dashboard overview
        </Link>
      </div>
      {error.digest && (
        <p className="mt-10 text-[10px] uppercase tracking-widest text-dash-forest/40">Reference {error.digest}</p>
      )}
    </div>
  );
}
