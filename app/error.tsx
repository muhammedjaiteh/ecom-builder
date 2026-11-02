'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Branded route error boundary for the public floor (marketplace, product,
// storefront, legal). Replaces the default Next.js error screen. Styled on the
// marketplace token cascade (mall-bone / mall-forest / mall-gold); reset()
// re-renders the failed segment, the secondary link returns to the floor.
// Launch Hardening P0 — trust.
// ─────────────────────────────────────────────────────────────────────────────

import Link from 'next/link';
import { useEffect } from 'react';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to the console / platform log drain; never to the visitor.
    console.error('[sanndikaa] route error', error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-mall-bone px-6 py-24 text-center font-sans text-mall-forest">
      <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-mall-gold">A pause on the floor</p>
      <h1 className="mt-4 max-w-xl text-balance font-serif text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
        Something didn&apos;t load as it should.
      </h1>
      <p className="mt-4 max-w-md text-sm leading-6 text-mall-forest/70">
        Nothing you were doing has been lost. Try again, or return to the marketplace and pick up where you were.
      </p>
      <div className="mt-10 flex w-full max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={() => reset()}
          className="h-12 rounded-full bg-mall-forest px-8 text-sm font-semibold text-mall-bone transition hover:brightness-110 active:scale-[0.98]"
        >
          Try again
        </button>
        <Link
          href="/"
          className="flex h-12 items-center justify-center rounded-full px-8 text-sm font-semibold text-mall-forest ring-1 ring-mall-forest/20 transition hover:bg-mall-forest/5"
        >
          Back to the marketplace
        </Link>
      </div>
      {error.digest && (
        <p className="mt-10 text-[10px] uppercase tracking-widest text-mall-forest/40">Reference {error.digest}</p>
      )}
    </main>
  );
}
