import { Check } from 'lucide-react';
import type { SiteTone } from '@/components/site-templates/chrome';
import type { SiteShop } from '@/lib/siteTemplates';
import { sanitizePhoneNumber } from '@/lib/orderFlow';

// ─────────────────────────────────────────────────────────────────────────────
// SiteTrustZone — the PDP's merchant trust strip (Phase 4A, item 3). Server
// component: zero JavaScript. Sits directly under the purchase CTAs, at the
// decision moment, as ONE glanceable line of ticks.
//
// HONESTY LAW: every signal is a fact the shop row asserts — the boutique's
// own WhatsApp number (phone), offers_delivery, offers_pickup. Nothing is
// inferred or invented (no review counts: SiteShop carries none), and a shop
// that asserts none of them renders NOTHING rather than a hollow strip. The
// detail lives in SiteFulfillmentPane below; this is the summary.
// ─────────────────────────────────────────────────────────────────────────────

/** The trust facts as labels — exported so tests can reason about the same
 *  ladder the strip renders. */
export function trustSignals(shop: SiteShop): string[] {
  const signals: string[] = [];
  // Only the boutique's OWN number counts as "direct": without one the order
  // routes through the platform fallback line (lib/orderFlow).
  if (sanitizePhoneNumber(shop.phone)) signals.push('Confirmed directly on WhatsApp');
  if (shop.offers_delivery) signals.push('Local delivery');
  if (shop.offers_pickup) signals.push('In-person pickup');
  return signals;
}

const TRUST_STYLES: Record<SiteTone, { list: string; item: string; icon: string }> = {
  ritual: {
    list: 'flex flex-wrap gap-x-5 gap-y-2',
    item: 'inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--site-muted,oklch(44.4%_0.011_73.639))]',
    icon: 'h-3.5 w-3.5 shrink-0 text-[var(--site-accent,#1c1917)]',
  },
  editorial: {
    list: 'flex flex-wrap gap-x-5 gap-y-2',
    item: 'inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--site-muted,oklch(43.9%_0_0))]',
    icon: 'h-3.5 w-3.5 shrink-0 text-[var(--site-accent,#1a2e1a)]',
  },
  neutral: {
    list: 'flex flex-wrap gap-x-5 gap-y-2',
    item: 'inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-white/70',
    icon: 'h-3.5 w-3.5 shrink-0 text-[var(--site-accent,#f0a500)]',
  },
};

export default function SiteTrustZone({ shop, tone, className }: {
  shop: SiteShop;
  tone: SiteTone;
  className?: string;
}) {
  const signals = trustSignals(shop);
  if (signals.length === 0) return null;
  const styles = TRUST_STYLES[tone];
  return (
    <ul aria-label="Boutique guarantees" className={`${styles.list} ${className ?? ''}`}>
      {signals.map((label) => (
        <li key={label} className={styles.item}>
          <Check aria-hidden strokeWidth={2.5} className={styles.icon} />
          {label}
        </li>
      ))}
    </ul>
  );
}
