import { generateImage } from 'ai';
import { openai } from '@ai-sdk/openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import { extractFalImageUrl, falSubscribeWithLogging, logFalFailure } from '@/lib/falImaging';
import {
  SITE_TEMPLATES,
  type SiteAssets,
  type WebsiteConfig,
} from '@/lib/siteTemplates';

// ─────────────────────────────────────────────────────────────────────────────
// Website asset engine — the zero-click AI hero + logo behind the generated
// storefront (and the Site Editor's on-demand "Generate with AI" slots).
//
// HERO (Law 4 — product-pixel integrity): reuses the EXACT Ad Studio still
// pipeline. BiRefNet extracts the seller's product foreground as a pristine
// unit, IC-Light v2 composites it into a generated luxury scene at the same
// 25 inference steps (Law 3: render speed), through the same silent-failure
// wrapper (lib/falImaging). No diffusion model ever touches the subject
// pixels. Runs ONLY when the shop has a real product photo — otherwise the
// caller skips and the template's gradient hero remains; nothing is ever
// fabricated.
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
// patching. Any failure (missing key, moderation, the 30s hard abort) is a
// graceful skip in the onboarding phase — the monogram mark remains.
//
// STORAGE: results are copied into the platform's existing 'brand' bucket
// (the exact bucket the themes-page logo/banner uploads use), service-role,
// deterministic path site-assets/{shopId}/{kind}-{ts}.{ext} → public URL.
// Provider CDN URLs (fal.media, oaidalleapi…) expire; ours do not.
// ─────────────────────────────────────────────────────────────────────────────

const CALLER = 'site-assets';
const BRAND_BUCKET = 'brand';

/** Overall onboarding budget for the hero pipeline — generate-website runs
 *  inside a 120s maxDuration that already spent time on the LLM step, so a
 *  cold-started model must time out into a skip, never kill the request. */
const HERO_PHASE_BUDGET_MS = 55_000;
const LOGO_DEADLINE_MS = 30_000;
const ASSET_DOWNLOAD_DEADLINE_MS = 20_000;

export type AssetProductSource = {
  id: string;
  name: string;
  image_url: string | null;
};

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

/** Download a provider CDN result with a hard deadline so a stalled socket
 *  can never eat the phase budget. */
async function downloadImage(url: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(ASSET_DOWNLOAD_DEADLINE_MS) });
  if (!res.ok) throw new Error(`Asset download failed (${res.status}) for ${url}`);
  const contentType = res.headers.get('content-type') ?? 'image/jpeg';
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength < 2000) {
    throw new Error(`Downloaded asset is suspiciously small (${bytes.byteLength} bytes) — likely blank.`);
  }
  return { bytes, contentType };
}

/** Deterministic luxury scene brief built from the generated brand identity —
 *  no extra LLM call in the loop (Law 3: the phase must stay fast). Prompts
 *  are pure functions of the config (byte-stable — cache law).
 *
 *  ART DIRECTION (Fix 5): abstract high-end brand texture, lifestyle mood,
 *  minimalist interior atmosphere — with EXPLICIT prohibitions. Law 4 note:
 *  IC-Light composites the seller's REAL product cutout into this scene, so
 *  the prohibitions govern the GENERATED SURROUNDINGS — the model must never
 *  invent additional merchandise, mannequins, lettering, or faces around the
 *  real product. */
function buildHeroScenePrompt(config: WebsiteConfig): string {
  const template = SITE_TEMPLATES[config.template_key];
  const tagline = config.site.tagline;
  const intro = config.site.collection_intro;
  return (
    `Photorealistic premium e-commerce hero scene for a ${template.niche} brand — "${tagline}". ` +
    `${intro} ` +
    `Abstract high-end brand texture and lifestyle mood in a minimalist interior atmosphere: refined materials, elegant color-gradient backdrop, one soft directional key light with gentle volumetric haze, ` +
    `generous negative space around the product for headline typography, shallow depth of field. ` +
    `The environment around the featured product must stay pure atmosphere: no additional products, no objects that read as merchandise, no packaging, no mannequins, ` +
    `no text, no lettering, no logos, no watermarks, and no people or faces anywhere in the frame. ` +
    `Elite Shopify storefront standard — confident, editorial, never cluttered, never discount-retailer.`
  );
}

/** Pick the seller's best ORIGINAL product photo as the BiRefNet input.
 *  Only real product pixels enter the pipeline — Ad Studio composites are
 *  never re-composited. Returns null when no product has a photo (SKIP). */
export function pickHeroSourceImage(products: AssetProductSource[]): string | null {
  return products.find((p) => typeof p.image_url === 'string' && p.image_url.length > 0)?.image_url ?? null;
}

/**
 * HERO: BiRefNet cutout → IC-Light v2 luxury composite → 'brand' bucket.
 * Throws on failure — the onboarding orchestrator catches into a skip; the
 * on-demand API surfaces the message honestly.
 */
export async function generateHeroAsset(args: {
  admin: SupabaseClient;
  shopId: string;
  config: WebsiteConfig;
  sourceImageUrl: string;
}): Promise<string> {
  const { admin, shopId, config, sourceImageUrl } = args;

  console.log(`[${CALLER}] Hero: BiRefNet foreground extraction for shop ${shopId}`);
  const isolateResult = await falSubscribeWithLogging(
    'fal-ai/birefnet',
    { image_url: sourceImageUrl },
    'BiRefNet',
    { caller: CALLER }
  );
  const cutoutUrl = extractFalImageUrl(isolateResult);
  if (!cutoutUrl) {
    logFalFailure(CALLER, 'BiRefNet', isolateResult);
    throw new Error('Background removal failed — no cutout URL in the BiRefNet response.');
  }

  console.log(`[${CALLER}] Hero: IC-Light v2 scene composition for shop ${shopId}`);
  const iclResult = await falSubscribeWithLogging(
    'fal-ai/iclight-v2',
    {
      image_url: cutoutUrl,
      prompt: buildHeroScenePrompt(config),
      // Law 3: 25 steps — identical to the Ad Studio still pipeline.
      num_inference_steps: 25,
    },
    'IC-Light v2',
    { caller: CALLER }
  );
  const heroUrl = extractFalImageUrl(iclResult);
  if (!heroUrl) {
    logFalFailure(CALLER, 'IC-Light v2', iclResult);
    throw new Error('Scene composition failed — no image URL in the IC-Light response.');
  }

  const { bytes, contentType } = await downloadImage(heroUrl);
  const publicUrl = await uploadSiteAsset(admin, shopId, 'hero', bytes, contentType);
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
 */
export async function runSiteAssetPhase(args: {
  admin: SupabaseClient;
  shop: ShopIdentity;
  products: AssetProductSource[];
  config: WebsiteConfig;
}): Promise<SiteAssets | null> {
  const { admin, shop, products, config } = args;

  const heroSource = pickHeroSourceImage(products);

  const [heroUrl, logoUrl] = await Promise.all([
    heroSource
      ? settleWithin(
          'Hero generation',
          HERO_PHASE_BUDGET_MS,
          generateHeroAsset({ admin, shopId: shop.id, config, sourceImageUrl: heroSource })
        )
      : Promise.resolve<string | null>(null),
    settleWithin(
      'Logo generation',
      // The SDK's own 30s abort fires first; this outer budget only guards a
      // stalled upload after it.
      LOGO_DEADLINE_MS + ASSET_DOWNLOAD_DEADLINE_MS,
      generateLogoAsset({ admin, shopId: shop.id, shopName: shop.shop_name, config })
    ),
  ]);

  if (!heroSource) {
    console.log(`[${CALLER}] Hero skipped for shop ${shop.id}: no product photo (template hero remains — never fabricate).`);
  }
  if (!heroUrl && !logoUrl) return null;

  const assets: SiteAssets = { generated_at: new Date().toISOString() };
  if (heroUrl) assets.hero_image_url = heroUrl;
  if (logoUrl) assets.logo_url = logoUrl;
  return assets;
}
