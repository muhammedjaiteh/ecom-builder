import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// AI Website Generator — template registry + generated-config schema.
// Single source of truth consumed by:
//   - app/api/ai/generate-website/route.ts  (matcher prompt + validation)
//   - app/dashboard/website/page.tsx        (template picker UI)
//   - app/site/[slug]/page.tsx              (renderer map)
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
    niche: 'Fashion & Apparel',
    description:
      'High-fashion lookbook. Full-bleed hero with overlaid serif headline, asymmetric product grid, monochrome palette with a deep-green accent. For garments, accessories, footwear, and anything worn.',
    matchKeywords: ['fashion', 'apparel', 'clothing', 'dress', 'sneakers', 'shoes', 'accessories', 'jewelry', 'bags', 'textiles'],
  },
  ritual: {
    key: 'ritual',
    name: 'Ritual',
    niche: 'Beauty & Cosmetics',
    description:
      'Soft, ceremonial beauty aesthetic. Split hero with arch-masked imagery, cream and pastel gradients, "The Ritual" three-step story band, symmetric product cards. For skincare, cosmetics, fragrance, and self-care.',
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

// Deterministic fallback when the seller's dominant product category needs a
// template without an LLM in the loop (used only as a matcher hint / safety net).
export function templateFromCategory(dominantCategory: string | null | undefined): TemplateKey {
  const c = (dominantCategory ?? '').toLowerCase();
  if (SITE_TEMPLATES.editorial.matchKeywords.some((k) => c.includes(k))) return 'editorial';
  if (SITE_TEMPLATES.ritual.matchKeywords.some((k) => c.includes(k))) return 'ritual';
  return 'vitality';
}

// ─────────────────────────────────────────────────────────────────────────────
// Generated site config — everything the templates render besides live
// shop/product data. Produced by the LLM, validated here, stored as
// shop_websites.config.
// ─────────────────────────────────────────────────────────────────────────────

export const WebsiteConfigSchema = z.object({
  template_key: z.enum(TEMPLATE_KEYS),
  niche_reasoning: z.string().min(1),
  site: z.object({
    tagline: z.string().min(1).max(80),
    hero_headline: z.string().min(1).max(90),
    hero_subheadline: z.string().min(1).max(200),
    brand_story: z.string().min(1).max(600),
    value_props: z.array(z.object({
      title: z.string().min(1).max(60),
      body: z.string().min(1).max(200),
    })).length(3),
    collection_title: z.string().min(1).max(60),
    collection_intro: z.string().min(1).max(240),
    cta_banner: z.object({
      headline: z.string().min(1).max(90),
      subtext: z.string().min(1).max(200),
      button_label: z.string().min(1).max(40),
    }),
    seo: z.object({
      title: z.string().min(1).max(70),
      description: z.string().min(1).max(170),
    }),
  }),
});

export type WebsiteConfig = z.infer<typeof WebsiteConfigSchema>;

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

// Shapes shared by the three template components.
export type SiteProduct = {
  id: string;
  name: string;
  price: number | null;
  description: string | null;
  image_url: string | null;
  ad_video_url: string | null;
  ad_hero_image_url: string | null;
  category: string | null;
};

export type SiteShop = {
  id: string;
  shop_name: string | null;
  shop_slug: string | null;
  logo_url: string | null;
  banner_url: string | null;
  bio: string | null;
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
