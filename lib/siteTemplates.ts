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
// LEGACY Step-1 concept pair (superseded by ARCHETYPES below — Pillar 3).
// The design consultation now pitches two ARCHETYPE bundles picked by
// pickConceptArchetypes; these exports remain render-valid history: the
// heuristic still backs conceptTemplateFromCategory consumers and any
// pre-archetype client payloads.
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
  // Phase 4 — product_tabs block budgets. tab_title stays terse (a tab strip
  // wraps badly), tab_content is a short paragraph per panel.
  tabs_heading: 60,
  tab_title: 40,
  tab_content: 400,
  // Archetype pass — testimonials block budgets. Quotes are REAL review
  // excerpts (never fabricated — integrity law), clipped to a readable
  // pull-quote length; the author line is the verified reviewer attribution.
  testimonials_heading: 60,
  testimonial_quote: 240,
  testimonial_author: 60,
} as const;

const copy = (max: number) => z.string().min(1).max(max);

// ─────────────────────────────────────────────────────────────────────────────
// Site blocks — the component-driven content model (Phase 3). Blocks live
// INSIDE shop_websites.config (jsonb; no migration possible), as an OPTIONAL
// array: every legacy row (no blocks) still validates and renders identically
// through the deterministic legacy adapter below. seo.* deliberately stays a
// fixed site.* field — it has no visual surface for the inline editor.
// ─────────────────────────────────────────────────────────────────────────────

// hidden?: true — Shopify-engine Item 2 visibility flag, on EVERY variant.
// STRICT SUPERSET: optional, so every stored row (no hidden keys) validates
// and renders byte-identically. Renderers read resolveVisibleBlocks (below)
// and SKIP hidden blocks; the editor shows them dimmed with an eye toggle.
// Canonical absent form: un-hiding DELETES the key (never `hidden: false`).
const hidden = z.boolean().optional();

// Inspector depth (Pillar 4): per-block presentation switches, on EVERY
// variant. STRICT SUPERSET — both optional; absent = the dialect's exact
// historical spacing/alignment (canonical form: selecting the default DELETES
// the key). Templates consume via per-dialect class maps — coverage is per
// block type and documented at each consumption site; types whose anatomy is
// spacing-driven (hero, marquee value props, video) simply never register a
// descriptor for them (BLOCK_SETTINGS), so no dead controls render.
const padding = z.enum(['compact', 'default', 'spacious']).optional();
const align = z.enum(['left', 'center']).optional();

export type BlockPadding = 'compact' | 'default' | 'spacious';
export type BlockAlign = 'left' | 'center';

export const HeroBannerBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('hero_banner'),
  headline: copy(SITE_COPY_LIMITS.hero_headline),
  subheadline: copy(SITE_COPY_LIMITS.hero_subheadline),
  tagline: copy(SITE_COPY_LIMITS.tagline).optional(),
  hidden,
  padding,
  align,
});

export const ValuePropsBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('value_props'),
  hidden,
  padding,
  align,
  /** 2–4 items (Phase 8 relaxation from exactly-3). STRICT SUPERSET: every
   *  stored row holds exactly 3, which stays valid; templates render 2/3/4
   *  responsively and the editor adds/removes rows within these bounds. */
  items: z.array(z.object({
    title: copy(SITE_COPY_LIMITS.value_title),
    body: copy(SITE_COPY_LIMITS.value_body),
  })).min(2).max(4),
});

export const ProductGridBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('product_grid'),
  title: copy(SITE_COPY_LIMITS.collection_title),
  intro: copy(SITE_COPY_LIMITS.collection_intro),
  /** Phase 4 — presentation switch for the collection section. OPTIONAL and
   *  additive: absent means 'grid', so every stored row keeps validating and
   *  renders the exact historical grid. 'carousel' renders the horizontal
   *  scroll-snap track. No site.* mirror exists for it — blocksToLegacySite
   *  deliberately never reads it. */
  displayMode: z.enum(['grid', 'carousel']).optional(),
  hidden,
  padding,
  align,
});

export const StoryTextBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('story_text'),
  body: copy(SITE_COPY_LIMITS.brand_story),
  hidden,
  padding,
  align,
});

export const CTABannerBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('cta_banner'),
  headline: copy(SITE_COPY_LIMITS.cta_headline),
  subtext: copy(SITE_COPY_LIMITS.cta_subtext),
  button_label: copy(SITE_COPY_LIMITS.cta_button_label),
  hidden,
  padding,
  align,
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 4 blocks — seller-added sections. Neither type has a site.* mirror
// field: blocksToLegacySite ignores them (existing mirror values preserved)
// and legacySiteToBlocks never fabricates them, so a legacy row can never
// grow one implicitly. They enter a config ONLY through the Site Editor's
// explicit "Add section" flow; the AI generation schema deliberately excludes
// them (the model must never invent video URLs or tab structures).
// ─────────────────────────────────────────────────────────────────────────────

export const ProductTabsBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('product_tabs'),
  title: copy(SITE_COPY_LIMITS.tabs_heading),
  tabs: z.array(z.object({
    title: copy(SITE_COPY_LIMITS.tab_title),
    content: copy(SITE_COPY_LIMITS.tab_content),
  })).min(2).max(4),
  hidden,
  padding,
  align,
});

export const VideoHeroBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('video_hero'),
  /** Seller-owned asset URL (Ad Studio render or a validated manual URL) —
   *  never AI-invented. */
  videoUrl: z.string().url(),
  headline: copy(SITE_COPY_LIMITS.hero_headline).optional(),
  subheadline: copy(SITE_COPY_LIMITS.hero_subheadline).optional(),
  posterUrl: z.string().url().optional(),
  hidden,
  padding,
  align,
});

// ─────────────────────────────────────────────────────────────────────────────
// Archetype-pass blocks (Pillar 3). Neither type has a site.* mirror field —
// blocksToLegacySite ignores them exactly like video_hero (existing mirror
// values preserved) and legacySiteToBlocks never fabricates them.
//
// 'testimonials' — INTEGRITY LAW: quote items are seeded EXCLUSIVELY from
// real product reviews (the generation route reads the reviews table at
// execute time). When a shop has no qualifying reviews the block is simply
// never added — the honest placeholder-free fallback is NO section. The
// editor can edit/remove/hide an existing block but cannot ADD one (no
// starter is registered — see editorModel GROUP_STARTERS/SECTION_CATALOG),
// so a fabricated quote can never enter a config through the platform.
//
// 'split_cta' — a two-panel conversion spread: copy side (headline, body,
// button) + a solid accent panel. Pure brand copy, so it IS catalog-addable
// and the LLM may write it (WebsiteGenerationSchema.split_cta below).
// ─────────────────────────────────────────────────────────────────────────────

export const TestimonialsBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('testimonials'),
  title: copy(SITE_COPY_LIMITS.testimonials_heading).optional(),
  /** 2–6 REAL review excerpts. */
  items: z.array(z.object({
    quote: copy(SITE_COPY_LIMITS.testimonial_quote),
    author: copy(SITE_COPY_LIMITS.testimonial_author),
  })).min(2).max(6),
  hidden,
  padding,
  align,
});

export const SplitCtaBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('split_cta'),
  headline: copy(SITE_COPY_LIMITS.cta_headline),
  body: copy(SITE_COPY_LIMITS.cta_subtext),
  button_label: copy(SITE_COPY_LIMITS.cta_button_label),
  hidden,
  padding,
  align,
});

export const SiteBlockSchema = z.discriminatedUnion('type', [
  HeroBannerBlockSchema,
  ValuePropsBlockSchema,
  ProductGridBlockSchema,
  StoryTextBlockSchema,
  CTABannerBlockSchema,
  ProductTabsBlockSchema,
  VideoHeroBlockSchema,
  TestimonialsBlockSchema,
  SplitCtaBlockSchema,
]);

export type SiteBlock = z.infer<typeof SiteBlockSchema>;
export type SiteBlockType = SiteBlock['type'];

// ─────────────────────────────────────────────────────────────────────────────
// BLOCK_SETTINGS — the schema-driven inspector registry (Shopify-engine
// Item 1). One ordered descriptor list per block type, colocated with the
// schemas above so a field can never exist in the editor without its zod
// gate (budgets come from the SAME SITE_COPY_LIMITS constants the schemas
// are built from). The Site Editor's inspector, its mobile sheets, and the
// canvas→rail focus bridge are ALL generic renderers over this table:
// adding a new block type to the editor costs exactly (a) its zod schema in
// the union above, (b) one BLOCK_SETTINGS entry, (c) a SECTION_LABELS/
// catalog entry in editorModel, and (d) its template section — zero new
// inspector code.
// ─────────────────────────────────────────────────────────────────────────────

/** A single copy field (top-level or inside a repeatable group). `path` is a
 *  dot path within the block; group fields are relative to the group item. */
export type BlockCopySetting = {
  kind: 'text' | 'textarea';
  path: string;
  label: string;
  maxChars: number;
  /** Schema-optional (min(1) absent): emptying the field DELETES the key. */
  optional?: boolean;
};

/** Enumerated presentation switch. Selecting `clearValue` DELETES the key —
 *  the canonical absent form, so toggling away and back leaves the block
 *  byte-identical and the editor's dirty check settles clean. */
export type BlockSelectSetting = {
  kind: 'select';
  path: string;
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  clearValue?: string;
};

/** Delegation slot for the brand asset controls (hero image + logo). The
 *  generic renderer mounts the existing AssetSlots surface here — upload /
 *  Ad-Studio picker / Generate-with-AI / Clear stay owned by the editor's
 *  one optimistic asset state machine. */
export type BlockImageSetting = {
  kind: 'image';
  path: string;
  label: string;
};

/** Delegation slot for the film asset (video_hero) — renders the
 *  Change-film affordance that opens the Ad Studio picker. */
export type BlockVideoSetting = {
  kind: 'video';
  path: string;
  label: string;
};

/** Bounded repeatable group (tabs 2–4, value props 2–4). The renderer
 *  expands `fields` per current item and gates add/remove on min/max. */
export type BlockGroupSetting = {
  kind: 'repeatable-group';
  path: string;
  label: string;
  min: number;
  max: number;
  /** Noun for the add button ("Add value prop") and remove fallbacks. */
  itemNoun: string;
  /** Inspector hint rendered between the item fields and the add/remove
   *  controls (e.g. the value-props marquee note). */
  hint?: string;
  fields: ReadonlyArray<BlockCopySetting>;
};

export type BlockSettingDescriptor =
  | BlockCopySetting
  | BlockSelectSetting
  | BlockImageSetting
  | BlockVideoSetting
  | BlockGroupSetting;

// ── Inspector depth (Pillar 4): shared padding/align descriptors ─────────────
// Registered ONLY on types whose templates actually consume them (truthful
// controls; coverage documented per dialect at each consumption site).
// clearValue 'default' DELETES the key — the canonical absent form, so
// selecting the default leaves the block byte-identical.
const PADDING_SETTING: BlockSelectSetting = {
  kind: 'select',
  path: 'padding',
  label: 'Section spacing',
  clearValue: 'default',
  options: [
    { value: 'default', label: 'Default' },
    { value: 'compact', label: 'Compact' },
    { value: 'spacious', label: 'Spacious' },
  ],
};

const ALIGN_SETTING: BlockSelectSetting = {
  kind: 'select',
  path: 'align',
  label: 'Alignment',
  clearValue: 'default',
  options: [
    { value: 'default', label: 'Default' },
    { value: 'left', label: 'Left' },
    { value: 'center', label: 'Centered' },
  ],
};

export const BLOCK_SETTINGS: Record<SiteBlockType, ReadonlyArray<BlockSettingDescriptor>> = {
  hero_banner: [
    { kind: 'text', path: 'tagline', label: 'Tagline', maxChars: SITE_COPY_LIMITS.tagline, optional: true },
    { kind: 'text', path: 'headline', label: 'Hero headline', maxChars: SITE_COPY_LIMITS.hero_headline },
    { kind: 'textarea', path: 'subheadline', label: 'Hero subheadline', maxChars: SITE_COPY_LIMITS.hero_subheadline },
    { kind: 'image', path: 'assets', label: 'Brand assets' },
  ],
  value_props: [
    {
      kind: 'repeatable-group',
      path: 'items',
      label: 'Value props',
      min: 2,
      max: 4,
      itemNoun: 'value prop',
      hint: 'Shown in the moving banner under the hero — edit the props here.',
      fields: [
        { kind: 'text', path: 'title', label: 'Value prop title', maxChars: SITE_COPY_LIMITS.value_title },
        { kind: 'textarea', path: 'body', label: 'Value prop body', maxChars: SITE_COPY_LIMITS.value_body },
      ],
    },
  ],
  product_grid: [
    { kind: 'text', path: 'title', label: 'Collection title', maxChars: SITE_COPY_LIMITS.collection_title },
    { kind: 'textarea', path: 'intro', label: 'Collection intro', maxChars: SITE_COPY_LIMITS.collection_intro },
    {
      kind: 'select',
      path: 'displayMode',
      label: 'Layout',
      clearValue: 'grid',
      options: [
        { value: 'grid', label: 'Grid' },
        { value: 'carousel', label: 'Carousel' },
      ],
    },
    PADDING_SETTING,
    ALIGN_SETTING,
  ],
  story_text: [
    { kind: 'textarea', path: 'body', label: 'Brand story', maxChars: SITE_COPY_LIMITS.brand_story },
    PADDING_SETTING,
    ALIGN_SETTING,
  ],
  // padding/align consumed by the RITUAL banner only (editorial's cta is the
  // chrome sign-off design slot; vitality's is site.*-driven) — documented.
  cta_banner: [
    { kind: 'text', path: 'headline', label: 'Banner headline', maxChars: SITE_COPY_LIMITS.cta_headline },
    { kind: 'textarea', path: 'subtext', label: 'Banner subtext', maxChars: SITE_COPY_LIMITS.cta_subtext },
    { kind: 'text', path: 'button_label', label: 'Button label', maxChars: SITE_COPY_LIMITS.cta_button_label },
    PADDING_SETTING,
    ALIGN_SETTING,
  ],
  product_tabs: [
    { kind: 'text', path: 'title', label: 'Tabs heading', maxChars: SITE_COPY_LIMITS.tabs_heading },
    {
      kind: 'repeatable-group',
      path: 'tabs',
      label: 'Tabs',
      min: 2,
      max: 4,
      itemNoun: 'tab',
      fields: [
        { kind: 'text', path: 'title', label: 'Tab title', maxChars: SITE_COPY_LIMITS.tab_title },
        { kind: 'textarea', path: 'content', label: 'Tab content', maxChars: SITE_COPY_LIMITS.tab_content },
      ],
    },
    PADDING_SETTING,
  ],
  video_hero: [
    { kind: 'text', path: 'headline', label: 'Film headline', maxChars: SITE_COPY_LIMITS.hero_headline, optional: true },
    { kind: 'textarea', path: 'subheadline', label: 'Film subheadline', maxChars: SITE_COPY_LIMITS.hero_subheadline, optional: true },
    { kind: 'video', path: 'videoUrl', label: 'Film' },
  ],
  testimonials: [
    { kind: 'text', path: 'title', label: 'Testimonials heading', maxChars: SITE_COPY_LIMITS.testimonials_heading, optional: true },
    {
      kind: 'repeatable-group',
      path: 'items',
      label: 'Customer quotes',
      min: 2,
      max: 6,
      itemNoun: 'quote',
      hint: 'These quotes were taken from your real product reviews. New quotes only arrive from reviews — never invented.',
      fields: [
        { kind: 'textarea', path: 'quote', label: 'Quote', maxChars: SITE_COPY_LIMITS.testimonial_quote },
        { kind: 'text', path: 'author', label: 'Attribution', maxChars: SITE_COPY_LIMITS.testimonial_author },
      ],
    },
    PADDING_SETTING,
    ALIGN_SETTING,
  ],
  split_cta: [
    { kind: 'text', path: 'headline', label: 'Spread headline', maxChars: SITE_COPY_LIMITS.cta_headline },
    { kind: 'textarea', path: 'body', label: 'Spread body', maxChars: SITE_COPY_LIMITS.cta_subtext },
    { kind: 'text', path: 'button_label', label: 'Button label', maxChars: SITE_COPY_LIMITS.cta_button_label },
    PADDING_SETTING,
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Generated site config — everything the templates render besides live
// shop/product data. Produced by the LLM, validated here, stored as
// shop_websites.config. STRICT SUPERSET of the pre-block schema: `blocks` is
// the only addition and it is optional, so every stored legacy row parses
// unchanged (requireSite safeParse-redirects invalid rows — see
// app/site/[slug]/siteData.ts).
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Generated brand assets — Premium Visual Editor phase. Lives INSIDE config
// (jsonb; no migration) as an OPTIONAL object: STRICT-SUPERSET LAW preserved,
// every stored row (no assets key) keeps validating byte-for-byte. Every URL
// is an asset the platform produced FOR this seller (IC-Light hero via the
// Ad Studio engine, AI logo, or the seller's own upload) — never an external
// placeholder. All keys optional: a partial object ({} included) validates.
// ─────────────────────────────────────────────────────────────────────────────

export const SiteAssetsSchema = z.object({
  /** AI-drafted or uploaded brand logo — falls back to shop.logo_url → monogram. */
  logo_url: z.string().url().optional(),
  /** Dedicated hero shot (IC-Light composite of the seller's product, or an
   *  upload / Ad Studio still) — first link of the hero media fallback chain. */
  hero_image_url: z.string().url().optional(),
  /** ISO timestamp of the last AI asset generation run. */
  generated_at: z.string().optional(),
});

export type SiteAssets = z.infer<typeof SiteAssetsSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Site theme — the Customize cockpit's accent + display-font layer. Lives
// INSIDE config (jsonb; no migration) as an OPTIONAL object: STRICT-SUPERSET
// LAW preserved, every stored row (no theme key) keeps validating and renders
// byte-identically (the templates' CSS variables fall back to the template
// defaults inline). Both keys optional: a partial object ({} included)
// validates and simply themes nothing.
// ─────────────────────────────────────────────────────────────────────────────

/** Curated display faces, loaded as next/font CSS variables in app/layout.tsx
 *  and mapped to font metadata in lib/siteTheme.ts. The enum is the schema's
 *  contract: a stored theme can never reference a face the platform did not
 *  ship. */
export const SITE_FONT_KEYS = ['playfair', 'cormorant', 'fraunces', 'lora', 'bodoni'] as const;

export type SiteFontKey = (typeof SITE_FONT_KEYS)[number];

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export const SiteThemeSchema = z.object({
  /** Accent color for the template's ACCENT SPOTS only (CTAs, badges, price
   *  highlights) — a 6-digit hex, validated so an arbitrary CSS payload can
   *  never enter the style attribute. */
  accent: z.string().regex(HEX_COLOR, 'Accent must be a 6-digit hex color.').optional(),
  /** Curated display serif — swaps --site-serif on the site root. */
  display_font: z.enum(SITE_FONT_KEYS).optional(),
  // ── Token cascade (Pillar 4) — ALL OPTIONAL (strict superset; a stored
  // theme without them renders byte-identically through the var() fallbacks).
  /** Deep primary brand surface/fill — dark CTA banners, the sign-off spread,
   *  solid checkout buttons (--site-primary). Hex-gated like accent. */
  primary: z.string().regex(HEX_COLOR, 'Primary must be a 6-digit hex color.').optional(),
  /** Page paper (--site-bg). The cockpit's WCAG guard blocks text/background
   *  pairs below 4.5:1 before they can be applied. */
  background: z.string().regex(HEX_COLOR, 'Background must be a 6-digit hex color.').optional(),
  /** Page ink (--site-text). Guarded against `background` at 4.5:1. */
  text: z.string().regex(HEX_COLOR, 'Text must be a 6-digit hex color.').optional(),
  /** Corner language for CTAs/buttons (--site-radius): sharp 0px ·
   *  rounded 0.75rem · pill 9999px. Absent = each dialect's native corners. */
  button_radius: z.enum(['sharp', 'rounded', 'pill']).optional(),
  /** Sticky-nav toggle (theme-level — chromes consume). Absent/true = the
   *  dialect's historical behavior (ritual/vitality/neutral navs stick);
   *  false = static nav. The Editorial masthead is print anatomy and never
   *  sticks — the toggle is a documented no-op there. */
  sticky_nav: z.boolean().optional(),
});

export type SiteTheme = z.infer<typeof SiteThemeSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// GENERATIVE ARCHETYPES (Pillar 3) — variety without abandoning the proven
// engine. An archetype is a (template_key × theme preset × block mix) BUNDLE,
// not a new template: the three shipped templates stay the only renderers.
//
//   pastel-minimalist  — ritual base. Pastel-adjacent dusty-rose accent
//                        (#a15c6e clears the 4.5:1 white-label CTA guard —
//                        true pastels cannot carry white button text, so the
//                        preset keeps the pastel register in the DEEP-muted
//                        range instead of lying about readability), Cormorant
//                        serif emphasis, ritual's native pill CTAs.
//   high-contrast-street — vitality base. Black/white/neon-volt accent
//                        (#c6f04a, a shipped vitality swatch); NO display_font
//                        override on purpose: vitality's native font-black
//                        uppercase sans IS the grotesque/condensed register —
//                        the curated font enum ships serifs only, and forcing
//                        one would soften the street anatomy.
//   warm-editorial     — editorial base. Terracotta accent (#8a3412, a
//                        shipped editorial-adjacent ember), Fraunces warmth,
//                        storytelling emphasis (story spread BEFORE the grid —
//                        Editorial renders body blocks in array order).
//   deep-luxury        — RITUAL base (decided over editorial: ritual's
//                        full-bleed dark hero, airy spacious grid, and dark
//                        CTA banner are literally the minimalist-showcase
//                        anatomy the brief names; editorial's dense hairline
//                        print grid reads magazine, not luxury-minimal).
//                        Antique-bronze metallic accent (#7a5c33 — clears the
//                        white-label guard where brighter golds fail), Bodoni
//                        didone.
//
// blockMix is the ORDERED home-page composition. 'testimonials' is a
// conditional slot — the generation route fills it ONLY from real reviews and
// silently drops it otherwise (integrity law). 'split_cta' is filled from the
// LLM's optional split_cta object and likewise dropped when absent.
// ─────────────────────────────────────────────────────────────────────────────

export const ARCHETYPE_KEYS = [
  'pastel-minimalist',
  'high-contrast-street',
  'warm-editorial',
  'deep-luxury',
] as const;

export type ArchetypeKey = (typeof ARCHETYPE_KEYS)[number];

export type SiteArchetype = {
  key: ArchetypeKey;
  name: string;
  template_key: TemplateKey;
  /** Theme preset applied at execute time — accent + display_font only
   *  (SiteThemeSchema-valid by construction). */
  theme: SiteTheme;
  /** Ordered home-page composition (conditional slots noted above). */
  blockMix: SiteBlockType[];
  /** One-line creative direction handed to the LLM (dynamic prompt). */
  copyDirection: string;
  /** Mood line for the concept pitch. */
  vibe: string;
};

export const ARCHETYPES: Record<ArchetypeKey, SiteArchetype> = {
  'pastel-minimalist': {
    key: 'pastel-minimalist',
    name: 'Pastel Minimalist',
    template_key: 'ritual',
    // Pastel register lives on the SURFACES (blush paper) — the accent stays
    // deep enough to carry white CTA labels (guard-verified). Pill corners.
    theme: { accent: '#a15c6e', display_font: 'cormorant', background: '#f7f0ec', text: '#3d3430', button_radius: 'pill' },
    blockMix: ['hero_banner', 'value_props', 'product_grid', 'split_cta', 'story_text', 'testimonials', 'cta_banner'],
    copyDirection:
      'Soft-spoken, airy, feminine-leaning luxury: short sentences, gentle sensory words (petal, glow, calm), zero hype.',
    vibe: 'Powder-soft minimalism — blush tones, feather serifs, generous air.',
  },
  'high-contrast-street': {
    key: 'high-contrast-street',
    name: 'High-Contrast Street',
    template_key: 'vitality',
    theme: { accent: '#c6f04a' },
    blockMix: ['hero_banner', 'value_props', 'product_grid', 'split_cta', 'story_text', 'testimonials', 'cta_banner'],
    copyDirection:
      'Loud, kinetic, street-poster energy: punchy verbs, uppercase-worthy fragments, confident swagger — never corporate.',
    vibe: 'Black-and-white with a neon-volt strike — condensed, dense, unapologetic.',
  },
  'warm-editorial': {
    key: 'warm-editorial',
    name: 'Warm Editorial',
    template_key: 'editorial',
    // Warm paper + espresso ink (12.7:1) under the terracotta accent.
    theme: { accent: '#8a3412', display_font: 'fraunces', background: '#f4ede2', text: '#2b2015' },
    blockMix: ['hero_banner', 'value_props', 'story_text', 'product_grid', 'testimonials', 'split_cta', 'cta_banner'],
    copyDirection:
      'Long-table storytelling: warm, earthy, human — lead with origin and craft, terracotta-and-olive imagery, print-magazine cadence.',
    vibe: 'Sun-baked print pages — terracotta ink, olive undertones, stories first.',
  },
  'deep-luxury': {
    key: 'deep-luxury',
    name: 'Deep Luxury',
    template_key: 'ritual',
    // Obsidian paper, bone ink (14.5:1), charcoal primary panels, sharp
    // museum-label corners.
    theme: { accent: '#7a5c33', display_font: 'bodoni', background: '#12100d', text: '#e8e2d6', primary: '#1d1a15', button_radius: 'sharp' },
    blockMix: ['hero_banner', 'value_props', 'product_grid', 'split_cta', 'story_text', 'testimonials', 'cta_banner'],
    copyDirection:
      'Obsidian-quiet luxury: sparse, declarative, museum-label restraint — every word costs something, nothing pleads.',
    vibe: 'Obsidian and charcoal with a bronze thread — a minimalist showcase.',
  },
};

// ── Niche → archetype mapping with DETERMINISTIC VARIETY ────────────────────
// Two cosmetics shops must not render twins: the shop id hash ROTATES the
// niche-fitting candidate list, so which two archetypes get pitched (and
// which leads) varies per shop while staying stable across regenerations.

/** FNV-1a 32-bit — tiny, dependency-free, stable across runtimes. */
export function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Ordered archetype candidates for a niche (best-fit first). Every list
 *  carries at least three entries so the hash rotation has room to vary. */
export function nicheArchetypeCandidates(dominantCategory: string | null | undefined): ArchetypeKey[] {
  switch (templateFromCategory(dominantCategory)) {
    case 'editorial':
      // Fashion/apparel/craft — story-led print first.
      return ['warm-editorial', 'deep-luxury', 'high-contrast-street', 'pastel-minimalist'];
    case 'ritual':
      // Beauty/wellness/home — soft minimalism first.
      return ['pastel-minimalist', 'deep-luxury', 'warm-editorial', 'high-contrast-street'];
    default:
      // Health/fitness/tech/food/bold general — street energy first.
      return ['high-contrast-street', 'deep-luxury', 'pastel-minimalist', 'warm-editorial'];
  }
}

/** The TWO archetypes the design consultation pitches for this shop:
 *  hash-rotated within the niche-fitting candidates (deterministic variety),
 *  always two DIFFERENT bundles. */
export function pickConceptArchetypes(
  shopId: string,
  dominantCategory: string | null | undefined
): [SiteArchetype, SiteArchetype] {
  const candidates = nicheArchetypeCandidates(dominantCategory);
  // xor-fold before the small modulo: FNV-1a's LOW bits disperse poorly for
  // strings sharing a long suffix (every UUID tail collided onto one offset
  // in the compat gate) — folding the high half in restores the variety.
  const hash = fnv1a(shopId);
  const offset = ((hash >>> 16) ^ (hash & 0xffff)) % candidates.length;
  const first = candidates[offset];
  // Second pick: the next DIFFERENT candidate in rotated order — adjacent in
  // fit ranking, so both pitches stay niche-honest while varying per shop.
  const second = candidates[(offset + 1) % candidates.length];
  return [ARCHETYPES[first], ARCHETYPES[second]];
}

// ─────────────────────────────────────────────────────────────────────────────
// config.previous — the snapshot ritual (Shopify-engine Item 5). Written
// server-side by the generate-website EXECUTE step immediately before the
// wholesale upsert whenever a prior config exists, and swapped atomically by
// the restore route. STRICT SUPERSET: optional, so every stored row (no
// previous key) validates byte-identically. NON-RECURSIVE by construction:
// buildPreviousDesign copies only the six content keys — the prior config's
// own `previous` is never carried, so the snapshot is exactly one generation
// deep.
//
// LAX-BUT-SHAPED ON PURPOSE: every key optional + loose (extra keys pass).
// The snapshot is a BACKUP of a config that may predate the current schema —
// it must NEVER make the row fail requireSite validation and knock the LIVE
// site offline. The restore route re-validates the snapshot STRICTLY (full
// WebsiteConfigSchema) before it ever becomes the current config, so laxness
// here can never leak an invalid config into service.
// ─────────────────────────────────────────────────────────────────────────────

export const PreviousDesignSchema = z.looseObject({
  template_key: z.string().optional(),
  niche_reasoning: z.string().optional(),
  site: z.unknown().optional(),
  blocks: z.unknown().optional(),
  theme: z.unknown().optional(),
  assets: z.unknown().optional(),
  /** ISO timestamp the snapshot was written. */
  saved_at: z.string().optional(),
});

export type PreviousDesign = z.infer<typeof PreviousDesignSchema>;

/** Build the one-generation-deep snapshot of a prior config. Returns null
 *  for non-object priors (never written by our writers — belt and
 *  suspenders for hand-edited rows). Deep-copied via JSON so the snapshot
 *  can never alias the live config object. */
export function buildPreviousDesign(prior: unknown): PreviousDesign | null {
  if (typeof prior !== 'object' || prior === null || Array.isArray(prior)) return null;
  const source = prior as Record<string, unknown>;
  const snapshot: Record<string, unknown> = { saved_at: new Date().toISOString() };
  for (const key of ['template_key', 'niche_reasoning', 'site', 'blocks', 'theme', 'assets'] as const) {
    if (source[key] !== undefined) {
      snapshot[key] = JSON.parse(JSON.stringify(source[key]));
    }
  }
  return snapshot as PreviousDesign;
}

export const WebsiteConfigSchema = z.object({
  template_key: z.enum(TEMPLATE_KEYS),
  niche_reasoning: z.string().min(1),
  site: z.object({
    tagline: copy(SITE_COPY_LIMITS.tagline),
    hero_headline: copy(SITE_COPY_LIMITS.hero_headline),
    hero_subheadline: copy(SITE_COPY_LIMITS.hero_subheadline),
    brand_story: copy(SITE_COPY_LIMITS.brand_story),
    // 2–4 (Phase 8): mirrors ValuePropsBlockSchema exactly, so the block ⇄
    // legacy adapters stay total over the whole window.
    value_props: z.array(z.object({
      title: copy(SITE_COPY_LIMITS.value_title),
      body: copy(SITE_COPY_LIMITS.value_body),
    })).min(2).max(4),
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
  /** Optional generated/uploaded brand assets — see SiteAssetsSchema above. */
  assets: SiteAssetsSchema.optional(),
  /** Optional accent/display-font theme layer — see SiteThemeSchema above. */
  theme: SiteThemeSchema.optional(),
  /** Optional restorable backup of the pre-regeneration design — see
   *  PreviousDesignSchema above. Declared here so zod's key-stripping can
   *  never silently drop the snapshot on a content-API rebuild. */
  previous: PreviousDesignSchema.optional(),
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
 *  block wins — deterministic. Pure: never mutates its inputs.
 *  TOTAL over the union by construction: block types with no site.* counterpart
 *  (product_tabs, video_hero — and product_grid.displayMode within its case)
 *  fall through the switch untouched, so the existing mirror values survive.
 *  HIDDEN BLOCKS MIRROR TOO (Item 2, deliberate): the mirror is a CONTENT
 *  store, not a visibility surface — hiding is reversible styling, never
 *  deletion. Skipping hidden blocks here would blank the seo/masthead/
 *  Vitality fallbacks the moment a seller hides a section, and un-hiding
 *  could then resurrect stale mirror copy. Visibility is enforced solely at
 *  render time via resolveVisibleBlocks. */
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

/** Single source of truth for the FULL block array: stored blocks when
 *  present, otherwise the deterministic legacy projection. The Site Editor
 *  reads this (hidden blocks must stay editable); render surfaces read
 *  resolveVisibleBlocks below. */
export function resolveBlocks(config: WebsiteConfig): SiteBlock[] {
  return config.blocks ?? legacySiteToBlocks(config.site);
}

/** Render-time projection (Shopify-engine Item 2): resolveBlocks minus the
 *  hidden ones. Every template body, the marquee, and the chrome copy
 *  consumers read THIS — a hidden block disappears from the page but keeps
 *  living in config.blocks (and in the site.* mirror — see blocksToLegacySite)
 *  so the eye toggle is always a lossless round trip. */
export function resolveVisibleBlocks(config: WebsiteConfig): SiteBlock[] {
  return resolveBlocks(config).filter((b) => !b.hidden);
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
  // 2–4 (Phase 8): the generation schema follows the stored-config window.
  value_props: z.array(z.object({
    title: copy(SITE_COPY_LIMITS.value_title),
    body: copy(SITE_COPY_LIMITS.value_body),
  })).min(2).max(4),
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
  /** Archetype pass (Pillar 3): the two-panel conversion spread. OPTIONAL —
   *  a strict superset of the classic generation shape, so every provider in
   *  the cascade that omits it still validates; the assembler simply skips
   *  the split_cta slot. Testimonials are DELIBERATELY absent here: quotes
   *  come only from real reviews, never from the model (integrity law). */
  split_cta: z.object({
    headline: copy(SITE_COPY_LIMITS.cta_headline),
    body: copy(SITE_COPY_LIMITS.cta_subtext),
    button_label: copy(SITE_COPY_LIMITS.cta_button_label),
  }).optional(),
});

export type WebsiteGeneration = z.infer<typeof WebsiteGenerationSchema>;

/** Assemble the stored config from LLM output: blocks with stable ids plus
 *  the site.* mirror derived through blocksToLegacySite, so both
 *  representations are consistent by construction.
 *
 *  REGENERATE CONTRACT (Phase 4, preserved as found): generate-website Step 2
 *  upserts this config WHOLESALE — there is no merge with the previously
 *  stored blocks. Regenerating a site therefore rebuilds the classic 5-block
 *  anatomy and drops any seller-added product_tabs/video_hero blocks along
 *  with every copy edit, exactly as copy edits were already dropped pre-Phase
 *  4. The generation schema stays classic-only on purpose: the model never
 *  invents video URLs or tab structures. */
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
// Archetype assembly (Pillar 3) — pure helpers the execute step composes AFTER
// generationToConfig. The classic path (no archetype) never calls these, so
// legacy behavior is byte-identical.
// ─────────────────────────────────────────────────────────────────────────────

/** A real review row, as the generation route reads it (service role). */
export type TestimonialSourceReview = {
  rating: number | null;
  comment: string | null;
  reviewer_name?: string | null;
  external_author?: string | null;
  verified_purchase?: boolean | null;
};

/** Word-boundary clip that keeps quotes inside the schema budget without
 *  mid-word amputation. */
function clipQuote(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 40 ? lastSpace : max - 1).trimEnd()}…`;
}

/** Build the testimonials block from REAL reviews — or null when the shop
 *  cannot honestly fill it (fewer than 2 quality quotes → NO section, never a
 *  fabricated one). Quality bar: rating ≥ 4 with a substantive comment. */
export function buildTestimonialsFromReviews(
  reviews: TestimonialSourceReview[] | null | undefined,
  id = 'testimonials'
): Extract<SiteBlock, { type: 'testimonials' }> | null {
  const items: Array<{ quote: string; author: string }> = [];
  for (const review of reviews ?? []) {
    if (items.length >= 6) break;
    const rating = Number(review?.rating);
    const comment = (review?.comment ?? '').trim();
    if (!Number.isFinite(rating) || rating < 4) continue;
    if (comment.length < 12) continue; // too thin to stand as a pull-quote
    const name =
      review.reviewer_name?.trim() ||
      review.external_author?.trim() ||
      'Verified buyer';
    items.push({
      quote: clipQuote(comment, SITE_COPY_LIMITS.testimonial_quote),
      author: clipQuote(
        review.verified_purchase && review.reviewer_name?.trim()
          ? `${name} · Verified Purchase`
          : name,
        SITE_COPY_LIMITS.testimonial_author
      ),
    });
  }
  if (items.length < 2) return null;
  return { id, type: 'testimonials', title: 'In Their Words', items };
}

/** Apply an archetype bundle to a freshly generated config:
 *    1. template_key pinned to the archetype's base;
 *    2. theme preset attached (accent + display_font);
 *    3. split_cta (from the LLM's optional object) and testimonials (from
 *       real reviews) blocks minted;
 *    4. blocks reordered to the archetype's blockMix — first block per type
 *       takes the slot, unfilled conditional slots drop out, and any block
 *       the mix doesn't name (impossible today, defensive forever) appends in
 *       original order so content is never silently lost.
 *  The site.* mirror is already consistent (new types have no mirror fields —
 *  blocksToLegacySite ignores them by construction). Pure: returns a new
 *  config object. */
export function applyArchetype(
  config: WebsiteConfig,
  archetype: SiteArchetype,
  gen: Pick<WebsiteGeneration, 'split_cta'>,
  reviews: TestimonialSourceReview[] | null | undefined
): WebsiteConfig {
  const pool: SiteBlock[] = (config.blocks ?? legacySiteToBlocks(config.site)).map((b) => ({ ...b }));

  if (gen.split_cta) {
    pool.push({
      id: 'split-cta',
      type: 'split_cta',
      headline: gen.split_cta.headline,
      body: gen.split_cta.body,
      button_label: gen.split_cta.button_label,
    });
  }

  const testimonials = buildTestimonialsFromReviews(reviews);
  if (testimonials) pool.push(testimonials);

  const used = new Set<string>();
  const ordered: SiteBlock[] = [];
  for (const type of archetype.blockMix) {
    const block = pool.find((b) => b.type === type && !used.has(b.id));
    if (block) {
      used.add(block.id);
      ordered.push(block);
    }
  }
  for (const block of pool) {
    if (!used.has(block.id)) ordered.push(block);
  }

  return {
    ...config,
    template_key: archetype.template_key,
    blocks: ordered,
    theme: { ...archetype.theme },
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
  /** Archetype bundle this concept pitches (Pillar 3). OPTIONAL — a strict
   *  superset: pre-archetype clients post concepts without it and execute
   *  down the classic template-only path unchanged. */
  archetype_key: z.enum(ARCHETYPE_KEYS).optional(),
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

// Default hero resolution (Pillar 4b): the seller's DELIBERATE hero first —
// config.assets.hero_image_url (generated abstract atmosphere, uploaded shot,
// or an Ad Studio still picked explicitly through HeroImagePicker) — then the
// shop banner, then null. The historical ad_video/ad_hero/raw-product tiers
// are REMOVED from the default: they were the other "giant product bottle"
// masthead source, so an Ad Studio asset on the hero is now always an
// explicit seller choice, never an automatic one. Back-compat is automatic —
// saved heroes stay first-priority and render byte-identically. Null → the
// templates render the animated HeroBrandPlate. The HeroMedia video variant
// stays (harmless, future-cheap) for explicit video heroes.
export function resolveHeroMedia(
  shop: SiteShop,
  config?: Pick<WebsiteConfig, 'assets'> | null
): HeroMedia {
  if (config?.assets?.hero_image_url) {
    return { type: 'image', url: config.assets.hero_image_url };
  }
  if (shop.banner_url) return { type: 'image', url: shop.banner_url };
  return null;
}

/** Logo slot fallback chain: generated/uploaded site logo → the shop's own
 *  logo → null (chrome renders the monogram/initial mark). One resolver so
 *  every chrome agrees on the same priority. */
export function resolveLogoUrl(
  config: Pick<WebsiteConfig, 'assets'>,
  shop: Pick<SiteShop, 'logo_url'>
): string | null {
  return config.assets?.logo_url ?? shop.logo_url ?? null;
}
