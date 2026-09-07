import { MapPin, MessageCircle, Truck } from 'lucide-react';
import type { SiteTone } from '@/components/site-templates/chrome';
import type { SiteShop } from '@/lib/siteTemplates';
import { buildWhatsAppLink } from '@/lib/orderFlow';

// ─────────────────────────────────────────────────────────────────────────────
// SiteFulfillmentPane — the PDP's dedicated "Delivery & Pickup" data pane
// (PDP overhaul, Phase 2). Server component: zero JavaScript.
//
// HONESTY LAW: every row is a fact the shop row asserts (offers_delivery /
// offers_pickup / pickup_instructions / phone). Nothing is invented — a shop
// that offers neither service gets the single neutral "arranged when you
// order" line, exactly like the chrome footers, never a gray placeholder.
// Rows are conditionally rendered; the pane itself always renders because the
// fallback row is a real statement about how ordering works on Sanndikaa.
//
// TOKENS: every color rides the theme cascade (var(--site-*) with the
// template's historical literal as fallback), so a themed boutique recolors
// the pane with the rest of the site and a themeless one is byte-stable.
// ─────────────────────────────────────────────────────────────────────────────

type PaneStyles = {
  shell: string;
  heading: string;
  row: string;
  rowSep: string;
  icon: string;
  rowTitle: string;
  rowBody: string;
  link: string;
};

const PANE_STYLES: Record<SiteTone, PaneStyles> = {
  ritual: {
    shell: 'rounded-2xl border border-stone-200 bg-white/70 p-5 md:p-6',
    heading: 'text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--site-muted,oklch(70.9%_0.01_56.259))]',
    row: 'flex items-start gap-4',
    rowSep: 'mt-5 border-t border-stone-200 pt-5',
    icon: 'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--site-accent,#1c1917)_8%,transparent)] text-[var(--site-accent,#1c1917)]',
    rowTitle: 'text-sm font-medium leading-snug text-[var(--site-text,oklch(21.6%_0.006_56.043))]',
    rowBody: 'mt-1 text-xs leading-relaxed text-[var(--site-muted,oklch(55.3%_0.013_58.071))]',
    link: 'mt-1 inline-flex min-h-11 items-center text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--site-accent,#1c1917)] underline underline-offset-4 transition hover:opacity-70',
  },
  editorial: {
    shell: 'border border-neutral-900 p-5 md:p-6',
    heading: 'text-[10px] font-bold uppercase tracking-[0.35em] text-[var(--site-muted,oklch(55.6%_0_0))]',
    row: 'flex items-start gap-4',
    rowSep: 'mt-5 border-t border-neutral-300 pt-5',
    icon: 'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center border border-neutral-900 text-[var(--site-accent,#1a2e1a)]',
    rowTitle: 'font-serif text-base italic leading-snug text-[var(--site-text,oklch(20.5%_0_0))]',
    rowBody: 'mt-1 text-xs leading-relaxed text-[var(--site-muted,oklch(43.9%_0_0))]',
    link: 'mt-1 inline-flex min-h-11 items-center text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--site-text,oklch(20.5%_0_0))] underline underline-offset-4 transition hover:text-[var(--site-accent,#1a2e1a)]',
  },
  neutral: {
    shell: 'rounded-2xl border border-white/10 bg-[#111] p-5 md:p-6',
    heading: 'text-[10px] font-black uppercase tracking-[0.25em] text-white/50',
    row: 'flex items-start gap-4',
    rowSep: 'mt-5 border-t border-white/10 pt-5',
    icon: 'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--site-accent,#f0a500)_12%,transparent)] text-[var(--site-accent,#f0a500)]',
    rowTitle: 'text-sm font-bold leading-snug text-[var(--site-text,#ffffff)]',
    rowBody: 'mt-1 text-xs leading-relaxed text-white/50',
    link: 'mt-1 inline-flex min-h-11 items-center text-[10px] font-black uppercase tracking-[0.2em] text-[var(--site-accent,#f0a500)] underline underline-offset-4 transition hover:opacity-70',
  },
};

type Row = {
  key: string;
  Icon: typeof Truck;
  title: string;
  body: string | null;
  link?: { href: string; label: string } | null;
};

/** The fulfillment facts as rows — exported so the skeleton/tests can reason
 *  about the same ladder the pane renders. */
export function fulfillmentRows(shop: SiteShop, productName: string): Row[] {
  const rows: Row[] = [];
  if (shop.offers_delivery) {
    rows.push({
      key: 'delivery',
      Icon: Truck,
      title: 'Local delivery available',
      body: 'Delivery details are confirmed with the boutique when you order.',
    });
  }
  if (shop.offers_pickup) {
    const note = shop.pickup_instructions?.trim();
    rows.push({
      key: 'pickup',
      Icon: MapPin,
      title: 'In-person pickup available',
      body: note ? note.slice(0, 140) : 'The pickup location is shared when you order.',
    });
  }
  if (rows.length === 0) {
    rows.push({
      key: 'arranged',
      Icon: Truck,
      title: 'Fulfillment arranged when you order',
      body: 'The boutique confirms delivery or pickup with you directly.',
    });
  }
  const whatsApp = buildWhatsAppLink(
    shop.phone,
    `Hello ${shop.shop_name ?? 'there'}! I have a question about "${productName}" on your boutique website.`
  );
  if (whatsApp) {
    rows.push({
      key: 'contact',
      Icon: MessageCircle,
      title: 'Questions about this piece?',
      body: null,
      link: { href: whatsApp, label: 'Message the boutique on WhatsApp' },
    });
  }
  return rows;
}

export default function SiteFulfillmentPane({ shop, productName, tone }: {
  shop: SiteShop;
  productName: string;
  tone: SiteTone;
}) {
  const styles = PANE_STYLES[tone];
  const rows = fulfillmentRows(shop, productName);
  return (
    <aside aria-labelledby="pdp-fulfillment-heading" className={styles.shell}>
      <p id="pdp-fulfillment-heading" className={styles.heading}>Delivery &amp; Pickup</p>
      <div className="mt-4">
        {rows.map(({ key, Icon, title, body, link }, i) => (
          <div key={key} className={`${styles.row} ${i > 0 ? styles.rowSep : ''}`}>
            <span aria-hidden className={styles.icon}>
              <Icon size={16} strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <p className={styles.rowTitle}>{title}</p>
              {body && <p className={styles.rowBody}>{body}</p>}
              {link && (
                <a href={link.href} target="_blank" rel="noopener noreferrer" className={styles.link}>
                  {link.label}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
