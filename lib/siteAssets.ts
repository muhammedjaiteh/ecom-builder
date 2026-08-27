import { generateImage } from 'ai';
import { openai } from '@ai-sdk/openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  SITE_TEMPLATES,
  type SiteAssets,
  type WebsiteConfig,
} from '@/lib/siteTemplates';

// ─────────────────────────────────────────────────────────────────────────────
// Website asset engine — the zero-click AI hero + logo behind the generated
// storefront (and the Site Editor's on-demand "Generate with AI" slots).
//
// HERO (Pillar 4a): a pure ABSTRACT brand atmosphere from gpt-image-2 —
// landscape 1536x1024, quality medium, 45s hard abort. The BiRefNet/IC-Light
// product-composite pipeline is RETIRED for site heroes (it produced literal
// "giant product" mastheads); Ad Studio keeps lib/falImaging untouched for
// its own stills/films. Law 4 is now satisfied by construction: NO product
// pixels enter this pipeline at all — the prompt explicitly prohibits
// products, packaging, bottles, mannequins, people, text, and logos, so
// nothing can be altered, deformed, or hallucinated. Sellers who WANT a
// product-led hero pick an Ad Studio still explicitly via HeroImagePicker.
//
// LOGO: the installed Vercel AI SDK ('ai' v6) ships a stable generateImage()
// surface with @ai-sdk/openai's provider.image() factory (the deprecated
// experimental_generateImage alias points at the same function). The model is
// gpt-image-2: the Images API retired dall-e-3 outright (probed 2026-08-24 —
// "The model 'dall-e-3' does not exist.") and rejects the `response_format`
// param the SDK hardcodes for dall-e IDs ("Unknown parameter:
// 'response_format'."). For gpt-image-* models the installed
// @ai-sdk/openai@3.0.68 omits response_format entirely
// (hasDefaultResponseFormat, dist/index.mjs:2010) and the b64_json default
// matches its response schema — so the SDK path stays valid with zero
// patching. Any failure (missing key, moderation, the hard abort) is a
// graceful skip in the onboarding phase — the monogram mark remains.
//
// STORAGE: results are copied into the platform's existing 'brand' bucket
// (the exact bucket the themes-page logo/banner uploads use), service-role,
// deterministic path site-assets/{shopId}/{kind}-{ts}.{ext} → public URL.
// SDK results upload as bytes directly — no provider-CDN download hop.
// ─────────────────────────────────────────────────────────────────────────────

const CALLER = 'site-assets';
const BRAND_BUCKET = 'brand';

/** Hard abort on the hero SDK call itself. */
const HERO_DEADLINE_MS = 45_000;
/** Overall onboarding budget for the hero task (SDK call + storage upload) —
 *  generate-website runs inside a 120s maxDuration that already spent time on
 *  the LLM step, so a stalled generation must time out into a skip, never
 *  kill the request. */
const HERO_PHASE_BUDGET_MS = 55_000;
const LOGO_DEADLINE_MS = 30_000;
/** Post-abort margin for the storage upload in the logo's outer budget. */
const ASSET_UPLOAD_MARGIN_MS = 20_000;

type ShopIdentity = {
  id: string;
  shop_name: string | null;
};

function extFromContentType(contentType: string): string {
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  return 'jpg';
}

/** Upload bytes into the existing 'brand' bucket (service-role) and return
 *  the public URL. Path is deterministic and timestamped so regeneration
 *  never overwrites an asset a published page may still be serving. */
async function uploadSiteAsset(
  admin: SupabaseClient,
  shopId: string,
  kind: 'hero' | 'logo',
  bytes: Uint8Array,
  contentType: string
): Promise<string> {
  const path = `site-assets/${shopId}/${kind}-${Date.now()}.${extFromContentType(contentType)}`;
  const { error } = await admin.storage.from(BRAND_BUCKET).upload(path, bytes, {
    contentType,
    upsert: false,
  });
  if (error) {
    throw new Error(`Storage upload failed for ${path}: ${error.message}`);
  }
  const { data } = admin.storage.from(BRAND_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) {
    throw new Error(`No public URL for uploaded asset ${path}.`);
  }
  return data.publicUrl;
}

/** Deterministic ABSTRACT hero brief built from the generated brand identity —
 *  no extra LLM call in the loop (Law 3: the phase must stay fast). Pure
 *  function of the config (byte-stable — cache law).
 *
 *  ART DIRECTION: pure atmosphere, texture, and negative space — a stage for
 *  headline typography, never a subject. EXPLICIT prohibitions carry Law 4:
 *  with no products in frame, none can be altered, deformed, or
 *  hallucinated. Exported for testability and for the byte-stability
 *  contract. */
export function buildAbstractHeroPrompt(config: WebsiteConfig): string {
  const template = SITE_TEMPLATES[config.template_key];
  const tagline = config.site.tagline;
  const intro = config.site.collection_intro;
  return (
    `Abstract premium e-commerce hero backdrop for a ${template.niche} brand — "${tagline}". ` +
    `${intro} ` +
    `Pure brand ATMOSPHERE only: an elegant abstract composition of refined material textures (brushed stone, silk drape, matte ceramic, soft paper grain), ` +
    `a deep cinematic color-gradient field, one soft directional key light with gentle volumetric haze, and generous uncluttered negative space across the frame for headline typography. ` +
    `Wide landscape framing, shallow tonal depth, quiet luxury. ` +
    `STRICTLY NO SUBJECT: no products, no merchandise, no packaging, no bottles, no jars, no boxes, no mannequins, no furniture staging that reads as a product shot, ` +
    `no people, no faces, no hands, no text, no lettering, no logos, no watermarks. ` +
    `Elite Shopify storefront standard — confident, editorial, never cluttered, never discount-retailer.`
  );
}

/**
 * HERO: gpt-image-2 abstract landscape atmosphere → 'brand' bucket, bytes
 * uploaded directly from the SDK result (no CDN download hop). Throws on
 * failure — the onboarding orchestrator catches into a skip; the on-demand
 * API surfaces the message honestly.
 */
export async function generateHeroAsset(args: {
  admin: SupabaseClient;
  shopId: string;
  config: WebsiteConfig;
}): Promise<string> {
  const { admin, shopId, config } = args;
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured — hero generation unavailable.');
  }

  console.log(`[${CALLER}] Hero: gpt-image-2 abstract atmosphere for shop ${shopId}`);
  const { image } = await generateImage({
    model: openai.image('gpt-image-2'),
    prompt: buildAbstractHeroPrompt(config),
    // Landscape masthead — '1536x1024' is verified in the installed SDK's
    // size enum for gpt-image models.
    size: '1536x1024',
    providerOptions: {
      // 'medium' keeps an abstract gradient field clean while staying inside
      // the 45s abort (Law 3: render speed over max-quality stalls).
      openai: { quality: 'medium' },
    },
    abortSignal: AbortSignal.timeout(HERO_DEADLINE_MS),
    maxRetries: 0,
  });

  const publicUrl = await uploadSiteAsset(
    admin,
    shopId,
    'hero',
    image.uint8Array,
    image.mediaType || 'image/png'
  );
  console.log(`[${CALLER}] Hero stored for shop ${shopId}: ${publicUrl}`);
  return publicUrl;
}

/** Brand-identity logo prompt. A monogram emblem (not a long wordmark) —
 *  diffusion models garble long text, an initial mark stays clean. Pure
 *  function of (shopName, config): byte-stable — cache law.
 *
 *  Full abstract-mark discipline (Fix 5): the mark is an abstract high-end
 *  brand symbol — never a product illustration, never a scene, never a face,
 *  and no lettering beyond the single monogram initial. */
function buildLogoPrompt(shopName: string, config: WebsiteConfig): string {
  const template = SITE_TEMPLATES[config.template_key];
  const initial = shopName.trim().charAt(0).toUpperCase() || 'S';
  return (
    `Minimalist luxury brand logo mark for "${shopName}", a ${template.niche} boutique — "${config.site.tagline}". ` +
    `An elegant abstract "${initial}" monogram emblem inside a simple geometric frame — an abstract high-end brand mark, flat vector style, ` +
    `two-tone palette drawn from deep charcoal and warm gold, crisp edges, centered on a plain solid off-white background. ` +
    `Strictly an abstract symbol: no photograph, no literal products, no objects that read as merchandise, no mannequins, no people or faces, ` +
    `no words or lettering beyond the single monogram initial, no gradient noise, no watermark.`
  );
}

/**
 * LOGO: Vercel AI SDK generateImage() over the existing OpenAI key.
 * Throws on any failure (missing key, moderation, 30s deadline) — the
 * onboarding orchestrator turns that into a console.warn skip.
 */
export async function generateLogoAsset(args: {
  admin: SupabaseClient;
  shopId: string;
  shopName: string | null;
  config: WebsiteConfig;
}): Promise<string> {
  const { admin, shopId, shopName, config } = args;
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured — logo generation unavailable.');
  }

  console.log(`[${CALLER}] Logo: gpt-image-2 draft for shop ${shopId}`);
  const { image } = await generateImage({
    model: openai.image('gpt-image-2'),
    prompt: buildLogoPrompt(shopName ?? 'Sanndikaa Boutique', config),
    size: '1024x1024',
    providerOptions: {
      // 'medium' keeps a flat two-tone monogram crisp while staying inside
      // the 30s abort — validated against the installed provider's
      // openaiImageModelGenerationOptions schema.
      openai: { quality: 'medium' },
    },
    // A logo draft is a bonus, never a blocker — hard 30s abort.
    abortSignal: AbortSignal.timeout(LOGO_DEADLINE_MS),
    maxRetries: 0,
  });

  const publicUrl = await uploadSiteAsset(
    admin,
    shopId,
    'logo',
    image.uint8Array,
    image.mediaType || 'image/png'
  );
  console.log(`[${CALLER}] Logo stored for shop ${shopId}: ${publicUrl}`);
  return publicUrl;
}

/** Resolve-with-deadline that NEVER rejects: on timeout or failure the task
 *  resolves null with a console.warn — onboarding must never block on assets. */
function settleWithin<T>(
  label: string,
  budgetMs: number,
  task: Promise<T>
): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.warn(`[${CALLER}] ${label} exceeded its ${budgetMs}ms budget — skipped (regenerate from the Site Editor).`);
      resolve(null);
    }, budgetMs);
    task.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        console.warn(`[${CALLER}] ${label} skipped:`, err instanceof Error ? err.message : err);
        resolve(null);
      }
    );
  });
}

/**
 * The zero-click onboarding phase: hero + logo IN PARALLEL, every failure a
 * graceful skip. Returns the assets patch to merge into config, or null when
 * nothing was produced (the row stays byte-identical — strict superset law).
 * The hero is a pure abstract atmosphere now (Pillar 4a) — no product photo
 * gate: photo-less shops generate exactly like stocked ones.
 */
export async function runSiteAssetPhase(args: {
  admin: SupabaseClient;
  shop: ShopIdentity;
  config: WebsiteConfig;
}): Promise<SiteAssets | null> {
  const { admin, shop, config } = args;

  const [heroUrl, logoUrl] = await Promise.all([
    settleWithin(
      'Hero generation',
      HERO_PHASE_BUDGET_MS,
      generateHeroAsset({ admin, shopId: shop.id, config })
    ),
    settleWithin(
      'Logo generation',
      // The SDK's own 30s abort fires first; this outer budget only guards a
      // stalled upload after it.
      LOGO_DEADLINE_MS + ASSET_UPLOAD_MARGIN_MS,
      generateLogoAsset({ admin, shopId: shop.id, shopName: shop.shop_name, config })
    ),
  ]);

  if (!heroUrl && !logoUrl) return null;

  const assets: SiteAssets = { generated_at: new Date().toISOString() };
  if (heroUrl) assets.hero_image_url = heroUrl;
  if (logoUrl) assets.logo_url = logoUrl;
  return assets;
}
