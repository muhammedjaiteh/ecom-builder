'use client';

import { useLayoutEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import EditorialTemplate from '@/components/site-templates/EditorialTemplate';
import { GatedVideoPreviewScope } from '@/components/site-templates/GatedVideo';
import { RevealPreviewScope } from '@/components/site-templates/Reveal';
import { StoryClampPreviewScope } from '@/components/site-templates/StoryClamp';
import RitualTemplate from '@/components/site-templates/RitualTemplate';
import VitalityTemplate from '@/components/site-templates/VitalityTemplate';
import {
  ARCHETYPES,
  resolveHeroMedia,
  type SiteConcept,
  type SiteProduct,
  type SiteShop,
  type SiteTemplateProps,
  type TemplateKey,
  type WebsiteConfig,
} from '@/lib/siteTemplates';

// ─────────────────────────────────────────────────────────────────────────────
// MiniSitePreview — a true-to-structure miniature of a template layout.
// Renders the ACTUAL site-template component (the same one /site/[slug] ships)
// inside a clipped, pointer-events-none frame, scaled from a fixed desktop
// design width. The concept's AI copy populates the preview CONTENT (hero,
// tagline, collection intro); real seller inventory renders when provided,
// falling back to deterministic local demo data (never external URLs, Law 4).
// ─────────────────────────────────────────────────────────────────────────────

const TEMPLATE_COMPONENTS: Record<TemplateKey, ComponentType<SiteTemplateProps>> = {
  editorial: EditorialTemplate,
  ritual: RitualTemplate,
  vitality: VitalityTemplate,
};

// Desktop width the miniature is laid out at before scaling down.
const DESIGN_WIDTH = 1366;

// Deterministic demo inventory fallback when a shop has no products loaded.
const PREVIEW_PRODUCTS: SiteProduct[] = [
  { id: 'preview-01', name: 'The Signature Piece', price: 1850, description: 'The piece the whole collection is built around — cut, finished, and checked by hand.', image_url: null, ad_video_url: null, ad_hero_image_url: null, category: 'featured', stock_quantity: 8 },
  { id: 'preview-02', name: 'Atelier Classic', price: 1250, description: 'A quiet staple that carries the house signature in every seam.', image_url: null, ad_video_url: null, ad_hero_image_url: null, category: 'featured', stock_quantity: 12 },
  { id: 'preview-03', name: 'Everyday Essential', price: 650, description: null, image_url: null, ad_video_url: null, ad_hero_image_url: null, category: 'core', stock_quantity: 20 },
  { id: 'preview-04', name: 'House Favorite', price: 980, description: null, image_url: null, ad_video_url: null, ad_hero_image_url: null, category: 'core', stock_quantity: 3 },
  { id: 'preview-05', name: 'New Arrival', price: 1450, description: null, image_url: null, ad_video_url: null, ad_hero_image_url: null, category: 'new', stock_quantity: 15 },
  { id: 'preview-06', name: 'Weekend Edit', price: 780, description: null, image_url: null, ad_video_url: null, ad_hero_image_url: null, category: 'core', stock_quantity: 9 },
  { id: 'preview-07', name: 'Limited Run', price: 2400, description: null, image_url: null, ad_video_url: null, ad_hero_image_url: null, category: 'limited', stock_quantity: 6 },
  { id: 'preview-08', name: 'Icon Reissue', price: 1650, description: null, image_url: null, ad_video_url: null, ad_hero_image_url: null, category: 'limited', stock_quantity: 10 },
];

type MiniSitePreviewProps = {
  /** Concept mock (studio Step-2 cards) — the historical mode. */
  concept?: SiteConcept | null;
  /** REAL stored config (Themes hub hero thumbnail) — wins over `concept`
   *  when present, so the miniature shows the seller's actual site. */
  config?: WebsiteConfig | null;
  shopName?: string | null;
  /** Optional real seller products — falls back to PREVIEW_PRODUCTS when omitted/empty. */
  products?: SiteProduct[] | null;
  /** Optional real shop media for accurate masthead/hero rendering. */
  logoUrl?: string | null;
  bannerUrl?: string | null;
};

export default function MiniSitePreview({
  concept,
  config,
  shopName,
  products,
  logoUrl,
  bannerUrl,
}: MiniSitePreviewProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.3);

  // Scale the fixed-width miniature to whatever width the card gives us.
  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / DESIGN_WIDTH);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const activeProducts: SiteProduct[] = useMemo(
    () => (products && products.length > 0 ? products : PREVIEW_PRODUCTS),
    [products]
  );

  // If no explicit store banner is set, allow the lead product's hero/main image
  // to anchor the masthead so previews render editorial photography instead of an empty monogram box.
  const fallbackHeroUrl = useMemo(() => {
    if (!products) return null;
    for (const p of products) {
      const candidate = p.ad_hero_image_url?.trim() || p.image_url?.trim();
      if (candidate) return candidate;
    }
    return null;
  }, [products]);

  const previewShop: SiteShop = useMemo(
    () => ({
      id: 'preview-shop',
      shop_name: shopName?.trim() || 'Your Boutique',
      shop_slug: null,
      logo_url: logoUrl?.trim() || null,
      banner_url: bannerUrl?.trim() || fallbackHeroUrl || null,
      bio: null,
      offers_delivery: true,
      offers_pickup: true,
      pickup_instructions: null,
    }),
    [shopName, logoUrl, bannerUrl, fallbackHeroUrl]
  );

  // The concept's own copy IS the preview content — the seller judges the
  // layout wearing the exact creative direction they would be approving.
  // A real stored config (hub thumbnail mode) short-circuits the mock.
  const previewConfig: WebsiteConfig | null = useMemo(() => {
    if (config) return config;
    if (!concept) return null;
    return {
      template_key: concept.template_key,
      niche_reasoning: concept.vibe,
      site: {
        tagline: concept.tagline,
        hero_headline: concept.hero_headline,
        hero_subheadline: concept.hero_subheadline,
        brand_story: concept.vibe,
        value_props: [
          { title: 'Crafted With Intent', body: 'Every piece is checked by hand before it leaves the boutique.' },
          { title: 'Delivery & Pickup', body: 'Fast local delivery, or collect your order straight from the counter.' },
          { title: 'Direct From The Seller', body: 'Order in one tap and confirm the details directly with the boutique.' },
        ],
        collection_title: 'The Collection',
        collection_intro: concept.palette,
        cta_banner: {
          headline: concept.tagline,
          subtext: concept.hero_subheadline,
          button_label: 'Shop The Boutique',
        },
        seo: {
          title: concept.concept_name.slice(0, 70),
          description: concept.vibe.slice(0, 170),
        },
      },
      // Archetype pitches wear their REAL theme preset in the miniature —
      // the seller approves the accent/typeface they will actually receive.
      ...(concept.archetype_key
        ? { theme: { ...ARCHETYPES[concept.archetype_key].theme } }
        : {}),
    };
  }, [concept, config]);

  if (!previewConfig) return null;

  const Template = TEMPLATE_COMPONENTS[previewConfig.template_key] ?? RitualTemplate;
  const heroMedia = resolveHeroMedia(previewShop, previewConfig);

  return (
    <div
      ref={frameRef}
      aria-hidden
      className="pointer-events-none relative h-full w-full select-none overflow-hidden bg-white"
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ width: DESIGN_WIDTH, transform: `scale(${scale})` }}
      >
        
        <GatedVideoPreviewScope>
          <RevealPreviewScope>
            <StoryClampPreviewScope>
              <Template
                shop={previewShop}
                products={activeProducts}
                config={previewConfig}
                heroMedia={heroMedia}
              />
            </StoryClampPreviewScope>
          </RevealPreviewScope>
        </GatedVideoPreviewScope>
      </div>
      {/* Soft edge fade — signals the page continues below the crop. */}
      <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/15 to-transparent" />
    </div>
  );
}
