'use client';

import { useLayoutEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import EditorialTemplate from '@/components/site-templates/EditorialTemplate';
import RitualTemplate from '@/components/site-templates/RitualTemplate';
import VitalityTemplate from '@/components/site-templates/VitalityTemplate';
import type {
  SiteConcept,
  SiteProduct,
  SiteShop,
  SiteTemplateProps,
  TemplateKey,
  WebsiteConfig,
} from '@/lib/siteTemplates';

// ─────────────────────────────────────────────────────────────────────────────
// MiniSitePreview — a true-to-structure miniature of a template layout.
// Renders the ACTUAL site-template component (the same one /site/[slug] ships)
// inside a clipped, pointer-events-none frame, scaled from a fixed desktop
// design width. The concept's AI copy populates the preview CONTENT (hero,
// tagline, collection intro); products are deterministic local demo data with
// gradient visuals — never external placeholder URLs (Law 4).
// ─────────────────────────────────────────────────────────────────────────────

const TEMPLATE_COMPONENTS: Record<TemplateKey, ComponentType<SiteTemplateProps>> = {
  editorial: EditorialTemplate,
  ritual: RitualTemplate,
  vitality: VitalityTemplate,
};

// Desktop width the miniature is laid out at before scaling down.
const DESIGN_WIDTH = 1366;

// Deterministic demo inventory. image_url stays null on purpose: the templates
// render their branded gradient plates, so the miniature reads as a styled
// theme demo rather than a page of broken frames. Varied initials keep the
// plates visually distinct; one low-stock item demos the urgency badge.
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
  concept: SiteConcept;
  shopName?: string | null;
};

export default function MiniSitePreview({ concept, shopName }: MiniSitePreviewProps) {
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

  const previewShop: SiteShop = useMemo(
    () => ({
      id: 'preview-shop',
      shop_name: shopName?.trim() || 'Your Boutique',
      shop_slug: null,
      logo_url: null,
      banner_url: null,
      bio: null,
      offers_delivery: true,
      offers_pickup: true,
      pickup_instructions: null,
    }),
    [shopName]
  );

  // The concept's own copy IS the preview content — the seller judges the
  // layout wearing the exact creative direction they would be approving.
  const previewConfig: WebsiteConfig = useMemo(
    () => ({
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
    }),
    [concept]
  );

  const Template = TEMPLATE_COMPONENTS[concept.template_key] ?? RitualTemplate;

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
        <Template shop={previewShop} products={PREVIEW_PRODUCTS} config={previewConfig} heroMedia={null} />
      </div>
      {/* Soft edge fade — signals the page continues below the crop. */}
      <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/15 to-transparent" />
    </div>
  );
}
