import { z } from 'zod';
import type { ReactNode } from 'react';
import { slugify } from './slugify';

// ─────────────────────────────────────────────────────────────────────────────
// AI Website Generator — template registry + generated-config schema.
// Single source of truth consumed by:
//   - app/api/ai/generate-website/route.ts       (matcher prompt + validation)
//   - components/website/WebsiteGeneratorStudio  (studio UI in /dashboard/customize)
//   - components/website/MiniSitePreview         (visual concept previews)
//   - app/site/[slug]/page.tsx                   (renderer map)
// ─────────────────────────────────────────────────────────────────────────────

export type TemplateKey = 'editorial' | 'ritual' | 'vitality';

export const TEMPLATE_KEYS = ['editorial', 'ritual', 'vitality'] as const;

export const SITE_TEMPLATES: Record<TemplateKey, {
  key: TemplateKey;
  name: string;
  niche: string;
  description: string;
  matchKeywords: string[];
}> = {
  editorial: {
    key: 'editorial',
    name: 'Editorial',
    niche: 'Magazine & Lookbook',
    description:
      'Magazine-grade storefront. Serif masthead, asymmetric split hero, alternating full-width product features, dense hairline collection grid with hover reveals, pull-quote brand story, dark serif sign-off footer. For fashion, accessories, craft, and any brand with a strong visual story.',
    matchKeywords: ['fashion', 'apparel', 'clothing', 'dress', 'sneakers', 'shoes', 'accessories', 'jewelry', 'bags', 'textiles'],
  },
  ritual: {
    key: 'ritual',
    name: 'Minimal',
    niche: 'Clean & Contemporary',
    description:
      'Premium minimal storefront. Sticky logo nav, full-bleed cinematic hero with dual CTAs, numbered value-props band, airy spacious product grid with quick-view hovers, brand-story strip, dark CTA banner, structured footer with delivery, pickup, and contact. For beauty, wellness, home, and any brand that sells through clarity.',
    matchKeywords: ['beauty', 'cosmetics', 'skincare', 'serum', 'oil', 'fragrance', 'hair', 'spa', 'wellness', 'body care'],
  },
  vitality: {
    key: 'vitality',
    name: 'Vitality',
    niche: 'Health, Fitness & Everything Bold',
    description:
      'High-energy, results-driven. Dark hero with condensed uppercase type, diagonal section breaks, stats band, benefit-led product rows, electric gold accents. For supplements, fitness, food, tech, and bold general brands.',
    matchKeywords: ['health', 'fitness', 'supplements', 'nutrition', 'sports', 'food', 'drinks', 'tech', 'electronics', 'home'],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Step-1 concept pair — the TWO structurally distinct layouts the design
// consultation pitches (founder mandate: two cards that LOOK like two
// different websites). 'ritual' renders Layout A (Minimal) and 'editorial'
// renders Layout B (Editorial magazine). 'vitality' stays render-valid for
// every legacy row and explicit templateOverride, but is no longer pitched.
// ─────────────────────────────────────────────────────────────────────────────

export const CONCEPT_TEMPLATE_KEYS = ['ritual', 'editorial'] as const;

export type ConceptTemplateKey = (typeof CONCEPT_TEMPLATE_KEYS)[number];

/** Concept-pair-safe heuristic: collapses the 3-key matcher onto the two
 *  pitched layouts. Fashion-adjacent inventory leads with Editorial; everything
 *  else leads with Minimal (the universal premium default). */
export function conceptTemplateFromCategory(dominantCategory: string | null | undefined): ConceptTemplateKey {
  return templateFromCategory(dominantCategory) === 'editorial' ? 'editorial' : 'ritual';
}

// Deterministic fallback when the seller's dominant product category needs a
// template without an LLM in the loop (used only as a matcher hint / safety net).
export function templateFromCategory(dominantCategory: string | null | undefined): TemplateKey {
  const c = (dominantCategory ?? '').toLowerCase();
  if (SITE_TEMPLATES.editorial.matchKeywords.some((k) => c.includes(k))) return 'editorial';
  if (SITE_TEMPLATES.ritual.matchKeywords.some((k) => c.includes(k))) return 'ritual';
  return 'vitality';
}

// ─────────────────────────────────────────────────────────────────────────────
// Copy field budgets — ONE table of character limits shared by the legacy
// site.* schema, the block schema, the LLM generation schema, and the inline
// editor's per-field budget display. A limit changed here changes everywhere,
// so a block field can never accept copy its site.* mirror would reject.
// ─────────────────────────────────────────────────────────────────────────────

export const SITE_COPY_LIMITS = {
  tagline: 80,
  hero_headline: 90,
  hero_subheadline: 200,
  brand_story: 600,
  value_title: 60,
  value_body: 200,
  collection_title: 60,
  collection_intro: 240,
  cta_headline: 90,
  cta_subtext: 200,
  cta_button_label: 40,
  seo_title: 70,
  seo_description: 170,
} as const;

const copy = (max: number) => z.string().min(1).max(max);

// ─────────────────────────────────────────────────────────────────────────────
// Site blocks — the component-driven content model (Phase 3). Blocks live
// INSIDE shop_websites.config (jsonb; no migration possible), as an OPTIONAL
// array: every legacy row (no blocks) still validates and renders identically
// through the deterministic legacy adapter below. seo.* deliberately stays a
// fixed site.* field — it has no visual surface for the inline editor.
// ─────────────────────────────────────────────────────────────────────────────

export const HeroBannerBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('hero_banner'),
  headline: copy(SITE_COPY_LIMITS.hero_headline),
  subheadline: copy(SITE_COPY_LIMITS.hero_subheadline),
  tagline: copy(SITE_COPY_LIMITS.tagline).optional(),
});

export const ValuePropsBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('value_props'),
  items: z.array(z.object({
    title: copy(SITE_COPY_LIMITS.value_title),
    body: copy(SITE_COPY_LIMITS.value_body),
  })).length(3),
});

export const ProductGridBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('product_grid'),
  title: copy(SITE_COPY_LIMITS.collection_title),
  intro: copy(SITE_COPY_LIMITS.collection_intro),
});

export const StoryTextBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('story_text'),
  body: copy(SITE_COPY_LIMITS.brand_story),
});

export const CTABannerBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('cta_banner'),
  headline: copy(SITE_COPY_LIMITS.cta_headline),
  subtext: copy(SITE_COPY_LIMITS.cta_subtext),
  button_label: copy(SITE_COPY_LIMITS.cta_button_label),
});

export const SiteBlockSchema = z.discriminatedUnion('type', [
  HeroBannerBlockSchema,
  ValuePropsBlockSchema,
  ProductGridBlockSchema,
  StoryTextBlockSchema,
  CTABannerBlockSchema,
]);

export type SiteBlock = z.infer<typeof SiteBlockSchema>;
export type SiteBlockType = SiteBlock['type'];

// ─────────────────────────────────────────────────────────────────────────────
// Generated site config — everything the templates render besides live
// shop/product data. Produced by the LLM, validated here, stored as
// shop_websites.config. STRICT SUPERSET of the pre-block schema: `blocks` is
// the only addition and it is optional, so every stored legacy row parses
// unchanged (requireSite safeParse-redirects invalid rows — see
// app/site/[slug]/siteData.ts).
// ─────────────────────────────────────────────────────────────────────────────

export const WebsiteConfigSchema = z.object({
  template_key: z.enum(TEMPLATE_KEYS),
  niche_reasoning: z.string().min(1),
  site: z.object({
    tagline: copy(SITE_COPY_LIMITS.tagline),
    hero_headline: copy(SITE_COPY_LIMITS.hero_headline),
    hero_subheadline: copy(SITE_COPY_LIMITS.hero_subheadline),
    brand_story: copy(SITE_COPY_LIMITS.brand_story),
    value_props: z.array(z.object({
      title: copy(SITE_COPY_LIMITS.value_title),
      body: copy(SITE_COPY_LIMITS.value_body),
    })).length(3),
    collection_title: copy(SITE_COPY_LIMITS.collection_title),
    collection_intro: copy(SITE_COPY_LIMITS.collection_intro),
    cta_banner: z.object({
      headline: copy(SITE_COPY_LIMITS.cta_headline),
      subtext: copy(SITE_COPY_LIMITS.cta_subtext),
      button_label: copy(SITE_COPY_LIMITS.cta_button_label),
    }),
    seo: z.object({
      title: copy(SITE_COPY_LIMITS.seo_title),
      description: copy(SITE_COPY_LIMITS.seo_description),
    }),
  }),
  blocks: z.array(SiteBlockSchema).optional(),
});

export type WebsiteConfig = z.infer<typeof WebsiteConfigSchema>;

export type WebsiteSiteCopy = WebsiteConfig['site'];

// ─────────────────────────────────────────────────────────────────────────────
// Block ⇄ legacy adapters — two PURE functions that keep both representations
// of the same copy consistent. Writers (AI generation, the content API) store
// BOTH: `blocks` plus the site.* mirror computed via blocksToLegacySite, so
// legacy consumers (VitalityTemplate, /collections tone bodies, metadata
// seo.* reads) keep working untouched.
// ─────────────────────────────────────────────────────────────────────────────

/** Deterministic default block array for a legacy config (no stored blocks).
 *  Order mirrors the canonical home-page anatomy: hero → values → grid →
 *  story → cta. Stable ids let the inline editor target nodes on rows that
 *  have never been re-saved. */
export function legacySiteToBlocks(site: WebsiteSiteCopy): SiteBlock[] {
  return [
    {
      id: 'hero',
      type: 'hero_banner',
      headline: site.hero_headline,
      subheadline: site.hero_subheadline,
      tagline: site.tagline,
    },
    {
      id: 'values',
      type: 'value_props',
      items: site.value_props.map((v) => ({ title: v.title, body: v.body })),
    },
    { id: 'grid', type: 'product_grid', title: site.collection_title, intro: site.collection_intro },
    { id: 'story', type: 'story_text', body: site.brand_story },
    {
      id: 'cta',
      type: 'cta_banner',
      headline: site.cta_banner.headline,
      subtext: site.cta_banner.subtext,
      button_label: site.cta_banner.button_label,
    },
  ];
}

/** Mirror block copy back into the legacy site.* fields. seo.* is preserved
 *  from existingSite (fixed field — no block carries it), as is any field
 *  whose block type is absent from the array. When a type repeats, the last
 *  block wins — deterministic. Pure: never mutates its inputs. */
export function blocksToLegacySite(blocks: SiteBlock[], existingSite: WebsiteSiteCopy): WebsiteSiteCopy {
  const site: WebsiteSiteCopy = {
    ...existingSite,
    value_props: existingSite.value_props.map((v) => ({ ...v })),
    cta_banner: { ...existingSite.cta_banner },
    seo: { ...existingSite.seo },
  };

  for (const block of blocks) {
    switch (block.type) {
      case 'hero_banner':
        site.hero_headline = block.headline;
        site.hero_subheadline = block.subheadline;
        if (block.tagline) site.tagline = block.tagline;
        break;
      case 'value_props':
        site.value_props = block.items.map((i) => ({ ...i }));
        break;
      case 'product_grid':
        site.collection_title = block.title;
        site.collection_intro = block.intro;
        break;
      case 'story_text':
        site.brand_story = block.body;
        break;
      case 'cta_banner':
        site.cta_banner = {
          headline: block.headline,
          subtext: block.subtext,
          button_label: block.button_label,
        };
        break;
    }
  }

  return site;
}

/** Single source of truth at render time: stored blocks when present,
 *  otherwise the deterministic legacy projection. Every template/chrome copy
 *  read goes through this — never through config.blocks directly. */
export function resolveBlocks(config: WebsiteConfig): SiteBlock[] {
  return config.blocks ?? legacySiteToBlocks(config.site);
}

/** Typed first-match lookup, for chrome copy consumers anchored to a block
 *  type (Editorial masthead tagline, sign-off CTA). */
export function findBlock<T extends SiteBlockType>(
  blocks: SiteBlock[],
  type: T
): Extract<SiteBlock, { type: T }> | undefined {
  return blocks.find((b): b is Extract<SiteBlock, { type: T }> => b.type === type);
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM generation output (execute step) — the model writes block copy as a
// KEYED object (one entry per block type) rather than the discriminated
// array: structured output stays robust across the provider cascade, and the
// server mints stable ids deterministically. generationToConfig produces the
// stored config carrying BOTH representations.
// ─────────────────────────────────────────────────────────────────────────────

export const WebsiteGenerationSchema = z.object({
  template_key: z.enum(TEMPLATE_KEYS),
  niche_reasoning: z.string().min(1),
  hero: z.object({
    tagline: copy(SITE_COPY_LIMITS.tagline),
    headline: copy(SITE_COPY_LIMITS.hero_headline),
    subheadline: copy(SITE_COPY_LIMITS.hero_subheadline),
  }),
  value_props: z.array(z.object({
    title: copy(SITE_COPY_LIMITS.value_title),
    body: copy(SITE_COPY_LIMITS.value_body),
  })).length(3),
  product_grid: z.object({
    title: copy(SITE_COPY_LIMITS.collection_title),
    intro: copy(SITE_COPY_LIMITS.collection_intro),
  }),
  story: z.object({
    body: copy(SITE_COPY_LIMITS.brand_story),
  }),
  cta: z.object({
    headline: copy(SITE_COPY_LIMITS.cta_headline),
    subtext: copy(SITE_COPY_LIMITS.cta_subtext),
    button_label: copy(SITE_COPY_LIMITS.cta_button_label),
  }),
  seo: z.object({
    title: copy(SITE_COPY_LIMITS.seo_title),
    description: copy(SITE_COPY_LIMITS.seo_description),
  }),
});

export type WebsiteGeneration = z.infer<typeof WebsiteGenerationSchema>;

/** Assemble the stored config from LLM output: blocks with stable ids plus
 *  the site.* mirror derived through blocksToLegacySite, so both
 *  representations are consistent by construction. */
export function generationToConfig(gen: WebsiteGeneration): WebsiteConfig {
  const blocks: SiteBlock[] = [
    {
      id: 'hero',
      type: 'hero_banner',
      headline: gen.hero.headline,
      subheadline: gen.hero.subheadline,
      tagline: gen.hero.tagline,
    },
    {
      id: 'values',
      type: 'value_props',
      items: gen.value_props.map((v) => ({ title: v.title, body: v.body })),
    },
    { id: 'grid', type: 'product_grid', title: gen.product_grid.title, intro: gen.product_grid.intro },
    { id: 'story', type: 'story_text', body: gen.story.body },
    {
      id: 'cta',
      type: 'cta_banner',
      headline: gen.cta.headline,
      subtext: gen.cta.subtext,
      button_label: gen.cta.button_label,
    },
  ];

  // Seed carries the seo.* the mirror preserves; every other field is
  // overwritten from the blocks (all five types present by construction).
  const seedSite: WebsiteSiteCopy = {
    tagline: gen.hero.tagline,
    hero_headline: gen.hero.headline,
    hero_subheadline: gen.hero.subheadline,
    brand_story: gen.story.body,
    value_props: gen.value_props.map((v) => ({ ...v })),
    collection_title: gen.product_grid.title,
    collection_intro: gen.product_grid.intro,
    cta_banner: { ...gen.cta },
    seo: { ...gen.seo },
  };

  return {
    template_key: gen.template_key,
    niche_reasoning: gen.niche_reasoning,
    site: blocksToLegacySite(blocks, seedSite),
    blocks,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// The full shop_websites row as every owner-authed API returns it
// (generate-website, publish, content). Shared by the studio, the inline
// editor, and the Online Store dashboards so they all agree on one contract.
// ─────────────────────────────────────────────────────────────────────────────

export type ShopWebsiteRow = {
  id: string;
  shop_id: string;
  template_key: TemplateKey;
  config: WebsiteConfig;
  status: 'draft' | 'published';
  niche_reasoning: string | null;
  generated_at: string;
  published_at: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// 2-step generator — Step 1 "Design Consultation" output. Two distinct
// concepts (different templates) with mock positioning copy. Stateless: never
// persisted — the client posts the chosen concept back for Step 2 execution.
// ─────────────────────────────────────────────────────────────────────────────

export const SiteConceptSchema = z.object({
  template_key: z.enum(TEMPLATE_KEYS),
  concept_name: z.string().min(1).max(60),
  tagline: z.string().min(1).max(80),
  vibe: z.string().min(1).max(240),
  palette: z.string().min(1).max(160),
  hero_headline: z.string().min(1).max(90),
  hero_subheadline: z.string().min(1).max(200),
});

export type SiteConcept = z.infer<typeof SiteConceptSchema>;

export const ConceptPairSchema = z.object({
  niche_reasoning: z.string().min(1),
  concepts: z.array(SiteConceptSchema).length(2),
});

export type ConceptPair = z.infer<typeof ConceptPairSchema>;

// Shapes shared by the three template components. New fields are OPTIONAL:
// every existing caller (and stored row) keeps compiling and rendering.
export type SiteProduct = {
  id: string;
  name: string;
  price: number | null;
  description: string | null;
  image_url: string | null;
  ad_video_url: string | null;
  ad_hero_image_url: string | null;
  category: string | null;
  /** Live inventory count. Optional/additive — undefined means "not loaded"
   *  and the templates render no stock badge at all. */
  stock_quantity?: number | null;
};

export type SiteShop = {
  id: string;
  shop_name: string | null;
  shop_slug: string | null;
  logo_url: string | null;
  banner_url: string | null;
  bio: string | null;
  /** Fulfillment + contact facts for the structured footers. Optional/additive
   *  — templates fall back to neutral copy when these are not loaded. */
  offers_delivery?: boolean | null;
  offers_pickup?: boolean | null;
  pickup_instructions?: string | null;
  /** Seller WhatsApp/phone for the footer contact link and on-site checkout.
   *  Optional/additive — chrome omits the contact link when not loaded. */
  phone?: string | null;
};

export type HeroMedia =
  | { type: 'video'; url: string; poster: string | null }
  | { type: 'image'; url: string }
  | null;

export type SiteTemplateProps = {
  shop: SiteShop;
  products: SiteProduct[];
  config: WebsiteConfig;
  heroMedia: HeroMedia;
};

// ─────────────────────────────────────────────────────────────────────────────
// Omnichannel site routing — every /site page (home, collections, product)
// shares its template's chrome (header/nav + footer). The chrome components
// live in components/site-templates/chrome/* and implement this contract.
// ─────────────────────────────────────────────────────────────────────────────

export type SiteChromeActive = 'home' | 'collections' | 'product';

export type SiteChromeProps = {
  shop: SiteShop;
  config: WebsiteConfig;
  /** Which page the chrome is wrapping — drives nav emphasis and whether
   *  section anchors stay on-page or route back to the home page. */
  active: SiteChromeActive;
  children: ReactNode;
};

/**
 * Canonical /site base path for a resolved shop, or null when no slug exists
 * (studio previews). Safe by construction: /site/[slug] resolves a shop only
 * when slugify(shop_slug) equals the requested canonical slug (exact match or
 * verified legacy fallback), so links minted here always route back to the
 * SAME shop through the same resolution (Law 2 slug safety).
 */
export function siteBasePath(shop: Pick<SiteShop, 'shop_slug'>): string | null {
  const slug = slugify(shop.shop_slug);
  return slug ? `/site/${slug}` : null;
}

/** Full-catalog page inside the branded site, or null in slugless previews. */
export function siteCollectionsPath(shop: Pick<SiteShop, 'shop_slug'>): string | null {
  const base = siteBasePath(shop);
  return base ? `${base}/collections` : null;
}

/** On-site product detail page, or null in slugless previews. */
export function siteProductPath(shop: Pick<SiteShop, 'shop_slug'>, productId: string): string | null {
  const base = siteBasePath(shop);
  return base ? `${base}/products/${productId}` : null;
}

// Best-available hero media, in fidelity order. Every input is an asset the
// seller already owns — Ad Studio video first, then stills, then originals.
export function resolveHeroMedia(products: SiteProduct[], shop: SiteShop): HeroMedia {
  const withVideo = products.find((p) => p.ad_video_url);
  if (withVideo?.ad_video_url) {
    return { type: 'video', url: withVideo.ad_video_url, poster: withVideo.ad_hero_image_url ?? withVideo.image_url };
  }
  const withHero = products.find((p) => p.ad_hero_image_url);
  if (withHero?.ad_hero_image_url) {
    return { type: 'image', url: withHero.ad_hero_image_url };
  }
  if (shop.banner_url) return { type: 'image', url: shop.banner_url };
  const withImage = products.find((p) => p.image_url);
  if (withImage?.image_url) return { type: 'image', url: withImage.image_url };
  return null;
}
