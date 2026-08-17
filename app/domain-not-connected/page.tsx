import type { Metadata } from 'next';
import { Globe } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Branded explainer for custom domains that reach the platform but have no
// active storefront mapping (Step 2 tenant routing, decision-tree item 3).
// proxy.ts REWRITES unknown tenant hosts here — the visitor's URL bar keeps
// their domain, and this page explains what is (not yet) behind it.
// Fully static: no auth, no data, no client JS beyond the framework shell.
// ─────────────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Domain not connected — Sanndikaa',
  description: "This domain isn't connected to a Sanndikaa storefront yet.",
  robots: { index: false, follow: false },
};

export default function DomainNotConnectedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#1a2e1a] px-6 py-16">
      <div className="w-full max-w-md text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.4em] text-[#f0a500]">
          Sanndikaa
        </p>

        <span className="mx-auto mt-8 flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70">
          <Globe size={28} strokeWidth={1.5} />
        </span>

        <h1 className="mt-8 font-serif text-3xl text-white">
          This domain isn&apos;t connected to a storefront yet
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-white/60">
          The address you visited points to Sanndikaa, but no boutique has
          finished connecting it. If you were expecting a shop here, check back
          soon.
        </p>

        <a
          href="https://sanndikaa.com"
          className="mt-10 inline-flex items-center justify-center rounded-full bg-[#f0a500] px-8 py-3.5 text-[11px] font-bold uppercase tracking-[0.25em] text-black shadow-lg transition hover:bg-amber-400 active:scale-95"
        >
          Explore the Sanndikaa marketplace
        </a>

        <p className="mt-10 border-t border-white/10 pt-6 text-xs leading-relaxed text-white/40">
          Selling on Sanndikaa? Open your dashboard&apos;s Domain Settings and
          finish the DNS steps — once your domain shows{' '}
          <span className="text-white/60">Active</span>, your boutique goes
          live here automatically.
        </p>
      </div>
    </main>
  );
}
