'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, ShoppingBag, X } from 'lucide-react';
import { formatDalasi as formatDalasiLabel } from '@/lib/currency';
import { sanitizePhoneNumber } from '@/lib/orderFlow';

/* ------------------------------------------------------------------ */
/* Physics — Heavy Luxury critical damping. No bounce.                 */
/* ------------------------------------------------------------------ */
const HEAVY_SPRING = { type: 'spring', stiffness: 80, damping: 25.29, mass: 2 } as const;

/* ------------------------------------------------------------------ */
/* Props — the storefront is data-blind. Supabase (or a fixture) feeds */
/* it a merchant and a product array; nothing is hardcoded here.       */
/* ------------------------------------------------------------------ */
export interface StorefrontMerchant {
  /** Brand name rendered in the header. Owns 70% of the header width; never truncated by a CTA. */
  name: string;
  /** Raw stored WhatsApp number. Sanitised to wa.me-safe digits at link-build time. */
  whatsappNumber: string;
  /** Optional hero copy + image. Each field falls back to the Banjul Noir defaults when omitted. */
  hero?: StorefrontHero;
}

export interface StorefrontHero {
  /** Serif headline over the scrim (e.g. "The Ritual of Oud"). */
  title?: string;
  /** Terse editorial subline (e.g. "Four attars. Pressed in Banjul. Worn on the pulse."). */
  subtitle?: string;
  /** Full-bleed hero image URL. Rendered object-cover at 4:5 / 3:4. */
  backgroundImage?: string;
}

const HERO_DEFAULTS: Required<StorefrontHero> = {
  title: 'The Ritual of Oud',
  subtitle: 'Four attars. Pressed in Banjul. Worn on the pulse.',
  backgroundImage:
    'https://images.unsplash.com/photo-1615634260167-c8cdede054de?q=80&w=1600&auto=format&fit=crop',
};

export interface StorefrontProduct {
  id: string;
  name: string;
  /** Short eyebrow — form · size (e.g. "Attar · 12ml"). */
  kicker: string;
  /** Extraction metadata — origin · method · maceration. Rendered monospaced in the Buy Box. */
  extraction: string;
  /** Price in Gambian Dalasi, whole units. */
  price: number;
  image: string;
  inStock: boolean;
  /** Ratings UI is suppressed entirely when this is 0. */
  reviewCount: number;
  /** 0–5. Ignored when reviewCount is 0. */
  rating: number;
  /** Rendered in full — never behind an accordion. */
  description: string[];
  details: string[];
}

export interface StorefrontProps {
  merchant: StorefrontMerchant;
  products: StorefrontProduct[];
}

function formatDalasi(amount: number): string {
  return formatDalasiLabel(amount) ?? 'D0';
}

function whatsappHref(whatsappNumber: string, message: string): string {
  const digits = sanitizePhoneNumber(whatsappNumber) ?? whatsappNumber.replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */
type ActiveView = { kind: 'home' } | { kind: 'pdp'; productId: string };

export default function BanjulNoirStorefront({ merchant, products }: StorefrontProps) {
  const [activeView, setActiveView] = useState<ActiveView>({ kind: 'home' });
  const [bagCount, setBagCount] = useState(0);

  const activeProduct =
    activeView.kind === 'pdp' ? products.find((p) => p.id === activeView.productId) ?? null : null;

  const openProduct = (id: string) => setActiveView({ kind: 'pdp', productId: id });
  const closeProduct = () => setActiveView({ kind: 'home' });

  // Hero resolves per-field so a merchant can override only the image, or only the copy.
  const heroTitle = merchant.hero?.title?.trim() || HERO_DEFAULTS.title;
  const heroSubtitle = merchant.hero?.subtitle?.trim() || HERO_DEFAULTS.subtitle;
  const heroImage = merchant.hero?.backgroundImage?.trim() || HERO_DEFAULTS.backgroundImage;

  return (
    <div className="relative min-h-dvh bg-mall-forest text-mall-bone font-sans antialiased">
      {/* ---------------------------------------------------------- */}
      {/* Header — Logo / Search / Bag. Nothing else.                 */}
      {/* ---------------------------------------------------------- */}
      <header className="sticky top-0 z-30 flex items-center gap-4 px-5 py-4 bg-mall-forest border-b border-mall-bone/15">
        <button
          type="button"
          onClick={closeProduct}
          className="flex-1 min-w-0 text-left font-serif text-xl tracking-[0.18em] uppercase truncate"
          aria-label={`${merchant.name} — Home`}
        >
          {merchant.name}
        </button>
        <button
          type="button"
          className="shrink-0 p-2 -m-2 opacity-80 hover:opacity-100 transition-opacity duration-700"
          aria-label="Search"
        >
          <Search className="size-5" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          className="relative shrink-0 p-2 -m-2 opacity-80 hover:opacity-100 transition-opacity duration-700"
          aria-label={`Bag, ${bagCount} items`}
        >
          <ShoppingBag className="size-5" strokeWidth={1.5} />
          {bagCount > 0 && (
            <span className="absolute -top-1 -right-1 grid place-items-center size-4 rounded-none bg-mall-gold text-mall-forest text-[10px] font-bold">
              {bagCount}
            </span>
          )}
        </button>
      </header>

      {/* ---------------------------------------------------------- */}
      {/* Homepage                                                     */}
      {/* ---------------------------------------------------------- */}
      <main>
        {/* Hero */}
        <section className="relative aspect-[4/5] sm:aspect-[3/4] md:aspect-auto md:h-[85dvh] overflow-hidden">
          <img
            src={heroImage}
            alt={heroTitle}
            className="absolute inset-0 size-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-transparent" aria-hidden />
          <div className="absolute inset-x-0 bottom-0 px-5 pb-12 md:px-16 md:pb-24 md:max-w-2xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-mall-gold mb-4">Collection 01</p>
            <h1 className="font-serif text-5xl md:text-7xl leading-[0.95] text-balance text-mall-bone">
              {heroTitle}
            </h1>
            <p className="mt-6 text-sm md:text-base text-mall-bone/85 max-w-sm leading-relaxed">
              {heroSubtitle}
            </p>
          </div>
        </section>

        {/* Product grid — asymmetric offset, 4:5 locked */}
        <section className="px-5 py-24 md:px-16 md:py-32">
          <div className="flex items-baseline justify-between mb-12">
            <h2 className="font-serif text-3xl md:text-4xl text-balance">The Edit</h2>
            <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-mall-gold">
              {products.length} pieces
            </span>
          </div>

          <ul className="grid grid-cols-2 gap-x-4 gap-y-14 md:grid-cols-3 md:gap-x-8 md:gap-y-24">
            {products.map((product, i) => (
              <li key={product.id} className={i % 2 === 1 ? 'mt-12 md:mt-0 md:[&:nth-child(3n+2)]:mt-24' : ''}>
                <button
                  type="button"
                  onClick={() => openProduct(product.id)}
                  className="group block w-full text-left"
                >
                  {/* Luxury frame — keeps raw white product renders from clashing with the forest ground */}
                  <div className="relative aspect-[4/5] overflow-hidden border border-mall-bone/15 bg-white/5">
                    <img
                      src={product.image}
                      alt={product.name}
                      loading="lazy"
                      className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    />
                    {!product.inStock && (
                      <span className="absolute top-3 left-3 px-2.5 py-1 bg-black/60 backdrop-blur-md border border-mall-gold/30 text-mall-gold font-mono text-[10px] uppercase tracking-widest">
                        Restocking
                      </span>
                    )}
                  </div>
                  <div className="mt-4">
                    <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-mall-gold">{product.kicker}</p>
                    <h3 className="mt-1 font-serif text-lg leading-tight text-mall-bone">{product.name}</h3>
                    <p className="mt-1 text-sm font-bold text-mall-bone">{formatDalasi(product.price)}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </main>

      {/* ---------------------------------------------------------- */}
      {/* PDP — bottom sheet                                           */}
      {/* ---------------------------------------------------------- */}
      <AnimatePresence>
        {activeProduct && (
          <motion.div
            key="pdp-overlay"
            className="fixed inset-0 z-50 flex items-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Scrim — dims and blurs the storefront so nothing leaks through the sheet edges */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeProduct} aria-hidden />

            <motion.section
              key={activeProduct.id}
              role="dialog"
              aria-modal="true"
              aria-labelledby="pdp-title"
              className="relative w-full max-h-[92dvh] overflow-y-auto overscroll-contain bg-mall-forest text-mall-bone border-t border-mall-gold/40 pb-[max(env(safe-area-inset-bottom),1.25rem)]"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={HEAVY_SPRING}
            >
              {/* Grab handle + close */}
              <div className="sticky top-0 z-10 flex items-center justify-between px-5 pt-3 pb-2 bg-mall-forest">
                <span className="mx-auto h-1 w-10 bg-mall-bone/30" aria-hidden />
                <button
                  type="button"
                  onClick={closeProduct}
                  className="absolute right-4 top-3 p-2 -m-2 opacity-80 hover:opacity-100 transition-opacity duration-700"
                  aria-label="Close"
                >
                  <X className="size-5" strokeWidth={1.5} />
                </button>
              </div>

              <div className="md:grid md:grid-cols-[3fr_2fr] md:gap-16 md:px-16 md:pb-16">
                {/* Hero image — 4:5, framed */}
                <div className="relative aspect-[4/5] overflow-hidden border border-mall-bone/15 bg-white/5">
                  <img src={activeProduct.image} alt={activeProduct.name} className="size-full object-cover" />
                  {!activeProduct.inStock && (
                    <span className="absolute top-3 left-3 px-2.5 py-1 bg-black/60 backdrop-blur-md border border-mall-gold/30 text-mall-gold font-mono text-[10px] uppercase tracking-widest">
                      Restocking
                    </span>
                  )}
                </div>

                {/* Buy Box — Name, Price, Extraction, WhatsApp. Sits directly under the hero. */}
                <div className="px-5 pt-8 md:px-0 md:pt-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-mall-gold">{activeProduct.kicker}</p>
                  <h2 id="pdp-title" className="mt-2 font-serif text-4xl leading-none text-balance">
                    {activeProduct.name}
                  </h2>
                  <p className="mt-3 text-xl font-bold text-mall-bone">{formatDalasi(activeProduct.price)}</p>

                  <dl className="mt-5 border-y border-mall-bone/15 py-3">
                    <dt className="font-mono text-[10px] uppercase tracking-[0.25em] text-mall-gold">Extraction</dt>
                    <dd className="mt-1 font-mono text-[11px] uppercase tracking-[0.15em] text-mall-bone/85">
                      {activeProduct.extraction}
                    </dd>
                  </dl>

                  {/* Ratings — hidden entirely when there are none */}
                  {activeProduct.reviewCount > 0 && (
                    <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-mall-bone/80">
                      <span className="text-mall-gold" aria-hidden>
                        {'★'.repeat(Math.round(activeProduct.rating))}
                      </span>{' '}
                      {activeProduct.rating.toFixed(1)} · {activeProduct.reviewCount} reviews
                    </p>
                  )}

                  {/* WhatsApp action — full width, primary. Bag is the secondary path. */}
                  <div className="mt-8 space-y-3">
                    {activeProduct.inStock ? (
                      <>
                        <motion.a
                          href={whatsappHref(
                            merchant.whatsappNumber,
                            `I'd like to order ${activeProduct.name} (${activeProduct.kicker}) — ${formatDalasi(activeProduct.price)}.`,
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          whileTap={{ scale: 0.98 }}
                          transition={HEAVY_SPRING}
                          className="block w-full py-4 text-center bg-mall-gold text-mall-forest font-sans text-sm font-bold uppercase tracking-[0.25em]"
                        >
                          Order via WhatsApp — {formatDalasi(activeProduct.price)}
                        </motion.a>
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.98 }}
                          transition={HEAVY_SPRING}
                          onClick={() => setBagCount((n) => n + 1)}
                          className="w-full py-4 border border-mall-bone/30 text-mall-bone font-sans text-sm font-bold uppercase tracking-[0.25em] hover:border-mall-bone/60 transition-colors duration-700"
                        >
                          Add to Bag
                        </motion.button>
                      </>
                    ) : (
                      <motion.a
                        href={whatsappHref(merchant.whatsappNumber, `Notify me when ${activeProduct.name} is restocked.`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        whileTap={{ scale: 0.98 }}
                        transition={HEAVY_SPRING}
                        className="block w-full py-4 text-center border border-mall-gold text-mall-gold font-sans text-sm font-bold uppercase tracking-[0.25em]"
                      >
                        Notify via WhatsApp When Restocked
                      </motion.a>
                    )}
                  </div>

                  {/* Description — rendered in full, no accordion */}
                  <div className="mt-12 space-y-4 text-sm leading-relaxed text-mall-bone/90">
                    {activeProduct.description.map((para) => (
                      <p key={para}>{para}</p>
                    ))}
                  </div>

                  <ul className="mt-10 border-t border-mall-bone/15 divide-y divide-mall-bone/15">
                    {activeProduct.details.map((d) => (
                      <li key={d} className="py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-mall-bone/80">
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
