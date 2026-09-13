'use client';

import { useState } from 'react';
import { BadgeCheck } from 'lucide-react';
import type { SiteTone } from '@/components/site-templates/chrome';
import DeviceReviewForm from '@/components/DeviceReviewForm';
import ReviewList from '@/components/ReviewList';
import { usePurchasedProduct } from '@/lib/purchaseMemory';

// ─────────────────────────────────────────────────────────────────────────────
// SiteProductReviews — the boutique PDP's "Customer Feedback" section.
//
// Same anatomy as the marketplace PDP (app/product/[id]/ProductClient.tsx):
// a 2/3 review list + 1/3 sticky submission column. The page itself is a
// server component, so this island owns the two client concerns — the local
// device-recognition hook (lib/purchaseMemory) and the refresh counter that
// re-fetches the list after a post.
//
// SUBMISSION: DeviceReviewForm only. It inserts straight through the anon
// Supabase client, so it works on custom domains untouched. The phone-
// verified BuyerReviewForm POSTs /api/reviews, which proxy.ts does NOT
// allowlist for tenant hosts — wiring it here needs that allowlist first.
// An unrecognised device gets an honest note instead of an empty column.
//
// TOKENS: colors ride the theme cascade (var(--site-*) + historical literal),
// mirroring SiteFulfillmentPane. ReviewList/DeviceReviewForm are light-theme
// components, so the dark Vitality (neutral) tone hosts the list on a white
// surface — the same treatment the form card already gives itself.
// ─────────────────────────────────────────────────────────────────────────────

type ReviewStyles = {
  shell: string;
  eyebrow: string;
  /** Wrapper around ReviewList — a light surface where the chrome is dark. */
  list: string;
  /** Sticky offset for the form column (mirrors the PDP infoCol per tone). */
  formCol: string;
  note: string;
  noteIcon: string;
  noteTitle: string;
  noteBody: string;
};

const REVIEW_STYLES: Record<SiteTone, ReviewStyles> = {
  ritual: {
    shell: 'mt-16 border-t border-stone-200 pt-12 md:mt-24 md:pt-16',
    eyebrow: 'text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--site-muted,oklch(70.9%_0.01_56.259))]',
    list: '',
    formCol: 'lg:sticky lg:top-24',
    note: 'rounded-2xl border border-stone-200 bg-white/70 p-5 md:p-6',
    noteIcon: 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--site-accent,#1c1917)_8%,transparent)] text-[var(--site-accent,#1c1917)]',
    noteTitle: 'text-sm font-medium leading-snug text-[var(--site-text,oklch(21.6%_0.006_56.043))]',
    noteBody: 'mt-1 text-xs leading-relaxed text-[var(--site-muted,oklch(55.3%_0.013_58.071))]',
  },
  editorial: {
    shell: 'mt-16 border-t border-neutral-900 pt-12 md:mt-24 md:pt-16',
    eyebrow: 'text-[10px] font-bold uppercase tracking-[0.35em] text-[var(--site-accent,#1a2e1a)]',
    list: '',
    formCol: 'lg:sticky lg:top-10',
    note: 'border border-neutral-900 p-5 md:p-6',
    noteIcon: 'flex h-9 w-9 shrink-0 items-center justify-center border border-neutral-900 text-[var(--site-accent,#1a2e1a)]',
    noteTitle: 'font-serif text-base italic leading-snug text-[var(--site-text,oklch(20.5%_0_0))]',
    noteBody: 'mt-1 text-xs leading-relaxed text-[var(--site-muted,oklch(43.9%_0_0))]',
  },
  neutral: {
    shell: 'mt-16 border-t border-white/10 pt-12 md:mt-24 md:pt-16',
    eyebrow: 'text-[10px] font-black uppercase tracking-[0.25em] text-[var(--site-accent,#f0a500)]',
    list: 'rounded-2xl border border-white/10 bg-white p-6 text-neutral-900 md:p-8',
    formCol: 'lg:sticky lg:top-24',
    note: 'rounded-2xl border border-white/10 bg-[#111] p-5 md:p-6',
    noteIcon: 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--site-accent,#f0a500)_12%,transparent)] text-[var(--site-accent,#f0a500)]',
    noteTitle: 'text-sm font-bold leading-snug text-[var(--site-text,#ffffff)]',
    noteBody: 'mt-1 text-xs leading-relaxed text-white/60',
  },
};

export default function SiteProductReviews({
  productId,
  shopId,
  tone,
}: {
  productId: string;
  shopId: string;
  tone: SiteTone;
}) {
  const styles = REVIEW_STYLES[tone];
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  // True post-mount once this device has ordered the product (server
  // snapshot is always false, so the form never flashes during hydration).
  const purchasedOnThisDevice = usePurchasedProduct(productId);

  return (
    <div id="reviews" aria-label="Customer feedback" className={styles.shell}>
      <p className={styles.eyebrow}>Customer Feedback</p>

      <div className="mt-8 grid grid-cols-1 gap-12 lg:grid-cols-3">
        {/* Left: list + aggregate rating */}
        <div className={`lg:col-span-2 ${styles.list}`}>
          <ReviewList productId={productId} refreshTrigger={refreshTrigger} />
        </div>

        {/* Right: the no-phone form for a device that ordered here, or an
            honest note about how the form unlocks. */}
        <div className="lg:col-span-1">
          <div className={styles.formCol}>
            {purchasedOnThisDevice ? (
              <DeviceReviewForm
                productId={productId}
                shopId={shopId}
                onReviewSubmitted={() => setRefreshTrigger((n) => n + 1)}
              />
            ) : (
              <div className={styles.note}>
                <div className="flex items-start gap-4">
                  <div className={styles.noteIcon}>
                    <BadgeCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <p className={styles.noteTitle}>Reviews come from buyers who ordered here.</p>
                    <p className={styles.noteBody}>
                      Order this item and the review form unlocks on this device &mdash; no phone number, no login.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
