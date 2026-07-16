import type { ComponentType } from 'react';
import type { SiteChromeProps, SiteProduct, TemplateKey } from '@/lib/siteTemplates';
import RitualChrome, { RITUAL_COLLECTION_GRID, RitualProductCard } from './RitualChrome';
import EditorialChrome, { EDITORIAL_COLLECTION_GRID, EditorialProductCard } from './EditorialChrome';
import NeutralChrome, { NEUTRAL_COLLECTION_GRID, NeutralProductCard } from './NeutralChrome';

// ─────────────────────────────────────────────────────────────────────────────
// Chrome registry — one entry per template_key, consumed by the nested /site
// routes (collections, product detail) to wrap their content in the seller's
// chosen premium chrome. 'vitality' maps to the neutral fallback: its legacy
// home template predates the omnichannel router and stays untouched, but its
// sites still gain the new routes through this registry.
// ─────────────────────────────────────────────────────────────────────────────

/** Styling dialect the shared page bodies (collections, PDP) speak. */
export type SiteTone = 'ritual' | 'editorial' | 'neutral';

export type SiteProductCardProps = { product: SiteProduct; index: number; href: string };

export type SiteChromeEntry = {
  tone: SiteTone;
  Chrome: ComponentType<SiteChromeProps>;
  ProductCard: ComponentType<SiteProductCardProps>;
  collectionGridClass: string;
};

export const SITE_CHROMES: Record<TemplateKey, SiteChromeEntry> = {
  ritual: {
    tone: 'ritual',
    Chrome: RitualChrome,
    ProductCard: RitualProductCard,
    collectionGridClass: RITUAL_COLLECTION_GRID,
  },
  editorial: {
    tone: 'editorial',
    Chrome: EditorialChrome,
    ProductCard: EditorialProductCard,
    collectionGridClass: EDITORIAL_COLLECTION_GRID,
  },
  vitality: {
    tone: 'neutral',
    Chrome: NeutralChrome,
    ProductCard: NeutralProductCard,
    collectionGridClass: NEUTRAL_COLLECTION_GRID,
  },
};
