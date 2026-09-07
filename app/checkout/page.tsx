import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import CheckoutForm from '@/components/CheckoutForm';

// /checkout — the GLOBAL marketplace checkout. A dedicated, distraction-free
// shell around the shared CheckoutForm: a slim secure-checkout header, the
// mall's warm paper, and nothing else competing with the buyer's attention.
// The cart drawer (root layout) routes here with ?shop=<id> so the form knows
// which seller's bag lines to check out; without it, a single-seller bag
// resolves itself and a multi-seller bag gets an on-page picker.
//
// The boutique equivalent lives at /site/[slug]/checkout inside the seller's
// chrome + theme cascade. This route is the Sanndikaa-branded fallback for
// marketplace purchases and for any bag line whose seller has no live site.

export const metadata: Metadata = {
  title: 'Secure Checkout · Sanndikaa',
  description: 'Complete your order and confirm it with the seller on WhatsApp.',
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{ shop?: string | string[] }>;
};

// Shop ids are UUIDs; anything else on the query string is ignored rather
// than echoed into the form.
function cleanShopParam(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' && /^[A-Za-z0-9-]{1,64}$/.test(value) ? value : null;
}

export default async function CheckoutPage({ searchParams }: PageProps) {
  const { shop } = await searchParams;
  const initialShopId = cleanShopParam(shop);

  return (
    <main className="min-h-screen bg-[#F9F8F6] text-gray-900">
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 md:px-10">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 transition hover:text-gray-900"
          >
            <ArrowLeft size={14} /> <span className="hidden sm:inline">Back to the mall</span><span className="sm:hidden">Back</span>
          </Link>
          <Link href="/" className="font-serif text-lg font-bold tracking-wide text-[#1a2e1a]">
            Sanndikaa
          </Link>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
            <ShieldCheck size={14} className="text-[#1a2e1a]" /> <span className="hidden sm:inline">Secure checkout</span><span className="sm:hidden">Secure</span>
          </span>
        </div>
      </header>

      <CheckoutForm
        tone="marketplace"
        initialShopId={initialShopId}
        continueHref="/"
        continueLabel="Continue shopping"
      />
    </main>
  );
}
