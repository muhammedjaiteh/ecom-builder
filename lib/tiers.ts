// ─────────────────────────────────────────────────────────────────────────────
// lib/tiers — THE single source of truth for the subscription ladder.
//
// FOUNDER MATRIX (2026-08-29): Starter D100/mo · Pro D250/mo (Studio
// customizer + analytics) · Flagship D750/mo (VIP placement + custom domain).
// There is NO 'advanced' tier in the new ladder — the Studio moved DOWN to
// Pro, and Flagship absorbed everything above it.
//
// LEGACY HONORING (never strand a payer): existing 'advanced' subscribers
// keep every capability they paid for — 'advanced' remains a member of the
// STUDIO family AND the DOMAIN family, and lib/feedRanking keeps its paid
// placement (flagship 4 > advanced 3 > pro 2 > starter 1). 'advanced' is
// simply no longer sold: it appears on no pricing surface, and legacy
// localStorage plan intents invoice as Flagship.
//
// LAUNCH ANCHOR (2026-09-11): every sellable tier also carries an anchorPrice
// — the struck-through "was" figure /pricing renders beside the live price
// under a "Founder's Rate" badge. It is DISPLAY ONLY: invoices, upgrade
// requests, the terms page and the landing page all keep pricing off
// monthlyPrice. Retiring the launch offer = deleting anchorPrice + the badge;
// no billing surface moves.
//
// Every tier gate in the codebase resolves through the predicates below —
// a matrix change here changes the platform, nothing else moves.
// ─────────────────────────────────────────────────────────────────────────────

/** The tiers that can be BOUGHT today. */
export type TierId = 'starter' | 'pro' | 'flagship';

/** Everything a shops.subscription_tier row may legally carry (plus the
 *  'pending'/'suspended' lifecycle states handled by the vault door). */
export type AnyTier = TierId | 'advanced';

export type TierCard = {
  id: TierId;
  name: string;
  /** Monthly price in Dalasi — the ONLY figure any invoice surface prices. */
  monthlyPrice: number;
  /** Launch-anchor "was" price in Dalasi, struck through beside monthlyPrice
   *  on /pricing. Display only — never invoiced, never gated on. */
  anchorPrice: number;
  tagline: string;
  /** TRUTHFUL ONLY — every bullet maps to a shipped, verifiable feature. */
  features: string[];
};

/** The sellable ladder, in ascending order. Rendered by /pricing, the
 *  dashboard Settings billing section, and priced by every invoice surface. */
export const TIER_MATRIX: ReadonlyArray<TierCard> = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 100,
    anchorPrice: 200,
    tagline: 'Launch your boutique and take orders on WhatsApp.',
    features: [
      'Your own boutique page on Sanndikaa',
      'Product listings with photos, colors & sizes',
      'WhatsApp checkout with order tracking',
      'Customer reviews on your products',
      'Sales analytics dashboard',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 250,
    anchorPrice: 500,
    tagline: 'The growth engine — your own AI-built website.',
    features: [
      'Everything in Starter',
      'AI Website Studio — a complete branded website',
      'Live Site Editor: sections, copy, colors & fonts',
      'Premium boutique layouts & brand colors',
      'Verified Pro badge on the marketplace',
      'Placement above Starter shops in the feed',
    ],
  },
  {
    id: 'flagship',
    name: 'Flagship',
    monthlyPrice: 750,
    anchorPrice: 1500,
    tagline: 'Own the district — VIP placement and your own domain.',
    features: [
      'Everything in Pro',
      'VIP placement — top of every marketplace feed',
      'Custom domain (.com / .gm / .sn) with automatic SSL',
      'Flagship gold crown on the marketplace',
      'WhatsApp customer broadcast engine',
    ],
  },
];

export const TIER_BY_ID: Record<TierId, TierCard> = Object.fromEntries(
  TIER_MATRIX.map((t) => [t.id, t])
) as Record<TierId, TierCard>;

/** One normalization for every gate — case/whitespace folded. */
export function normalizeTier(tier: string | null | undefined): string {
  return (tier ?? '').toLowerCase().trim();
}

// ── Capability families ──────────────────────────────────────────────────────
// Arrays exported for the routes that build SQL-ish membership checks; the
// predicates are the canonical consumption form.

/** AI Website Studio family — generate/publish/content/assets/restore routes,
 *  the studio surfaces, and useStorefrontUrl's fetch gate. Studio moved DOWN
 *  to Pro (founder matrix); legacy 'advanced' payers keep it. */
export const STUDIO_TIERS: ReadonlyArray<string> = ['pro', 'advanced', 'flagship'];

/** Custom-domain family — the /api/domains route and both domain dashboards.
 *  Flagship-exclusive in the new ladder; legacy 'advanced' payers keep it. */
export const DOMAIN_TIERS: ReadonlyArray<string> = ['advanced', 'flagship'];

/** Broadcast engine family — unchanged (flagship + legacy advanced). */
export const BROADCAST_TIERS: ReadonlyArray<string> = ['advanced', 'flagship'];

export function canUseStudio(tier: string | null | undefined): boolean {
  return STUDIO_TIERS.includes(normalizeTier(tier));
}

export function canUseCustomDomain(tier: string | null | undefined): boolean {
  return DOMAIN_TIERS.includes(normalizeTier(tier));
}

export function canUseBroadcast(tier: string | null | undefined): boolean {
  return BROADCAST_TIERS.includes(normalizeTier(tier));
}

/** AI-credit metering family — starter/pro consume shops.ai_credits;
 *  flagship (and legacy advanced) generate uncapped. Values unchanged by the
 *  2026-08-29 matrix; only the upgrade copy now points at Flagship. */
export const METERED_TIERS: ReadonlyArray<string> = ['starter', 'pro'];

export function isMeteredTier(tier: string | null | undefined): boolean {
  return METERED_TIERS.includes(normalizeTier(tier));
}

// ── Invoice pricing (vault door, concierge, admin approval) ─────────────────

/** Price a plan-intent string for invoice minting. Legacy 'advanced' intents
 *  (old localStorage / requested_plan rows) invoice as Flagship — advanced is
 *  no longer sold. Unknown values fall to Starter, the historical default. */
export function invoicePlanFor(plan: string | null | undefined): { id: TierId; name: string; price: number } {
  const key = normalizeTier(plan);
  if (key === 'pro') return { id: 'pro', name: 'Pro', price: TIER_BY_ID.pro.monthlyPrice };
  if (key === 'advanced' || key === 'flagship') {
    return { id: 'flagship', name: 'Flagship', price: TIER_BY_ID.flagship.monthlyPrice };
  }
  return { id: 'starter', name: 'Starter', price: TIER_BY_ID.starter.monthlyPrice };
}

/** Human price range of the sellable ladder ("D100–D750"). */
export const TIER_PRICE_RANGE = `D${TIER_MATRIX[0].monthlyPrice}–D${TIER_MATRIX[TIER_MATRIX.length - 1].monthlyPrice}`;

/** Badge copy rendered beside every struck-through anchorPrice on /pricing.
 *  Single source so the offer can be renamed (or retired) in one place. */
export const LAUNCH_OFFER_LABEL = "Founder's Rate";

/** One-time concierge setup fee (unchanged by the matrix). */
export const CONCIERGE_PRICE = 500;

/** The platform admin/support WhatsApp number every payment + support flow
 *  routes through. */
export const SUPPORT_WHATSAPP = '447599710468';
