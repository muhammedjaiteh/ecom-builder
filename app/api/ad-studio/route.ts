import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { formatDalasi } from '@/components/marketplace/format';
import {
  AD_ASPECT_RATIOS,
  AD_FORMATS,
  NICHE_KEYS,
  buildPhotoroomEditParams,
  composeEditorialCopy,
  formatTenantDomain,
  resolveNichePreset,
  toDisplayTitle,
  type AdStudioDelivery,
  type AdStudioMockReason,
  type AdStudioRenderResult,
} from '@/lib/adStudio/nichePresets';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ad-studio — niche-aware still generation for the premium Ad Studio.
//
// Body:    { productTitle, category?, price, imageUrl, tenantDomain?,
//            aspectRatio: '1:1' | '9:16', niche?, seed?, variant?, dryRun? }
// Returns: AdStudioRenderResult (lib/adStudio/nichePresets) — the composed
//          still + the editorial copy the compositor stamps over it.
//
// PIPELINE
//   1. Cookie-verified auth (Iron Dome: every server route authenticates).
//   2. Niche Intelligence: category/title → curated preset (or override).
//   3. Photoroom Image Editing API v2 — GET /v2/edit with the seller's
//      public image URL. Photoroom cuts the product out and generates ONLY
//      the environment behind it from the preset's scene brief; the
//      product's pixels are never repainted (Law 4). Parameters verified
//      against docs.photoroom.com on 2026-09-15.
//   4. Delivery: the PNG is rehosted into the existing 'brand' bucket
//      (service-role, exactly like lib/siteAssets) so the canvas gets a
//      durable CDN URL; if storage is unavailable it degrades to an inline
//      data: URL rather than failing the seller.
//
// MOCK FALLBACK: without PHOTOROOM_API_KEY the route still answers 200 with
// mock: true and the seller's source image as the base layer, so the studio
// UI, the copy engine, and the compositor are fully exercisable before the
// key lands. `dryRun: true` does the same on purpose (no credit spent) and
// returns the exact dispatch the real call would make.
//
// This route touches no checkout logic, no database tables, and no proxy.
// ─────────────────────────────────────────────────────────────────────────────

// Photoroom AI backgrounds render in ~5–20s; the abort below is generous for
// cold starts, and the storage upload needs a margin after it.
export const maxDuration = 120;

const PHOTOROOM_EDIT_ENDPOINT = 'https://image-api.photoroom.com/v2/edit';
const PHOTOROOM_TIMEOUT_MS = 75_000;
const BRAND_BUCKET = 'brand';
const LOG = '[ad-studio]';

const RequestSchema = z.object({
  productTitle: z.string().trim().min(1, 'productTitle is required').max(160),
  category: z.string().trim().max(80).nullish(),
  price: z.coerce.number().min(0, 'price must be zero or more'),
  imageUrl: z.string().trim().min(1, 'imageUrl is required').max(2048),
  tenantDomain: z.string().trim().max(253).nullish(),
  aspectRatio: z.enum(AD_ASPECT_RATIOS),
  /** Seller override of the detected niche. */
  niche: z.enum(NICHE_KEYS).nullish(),
  /** Photoroom background seed — resend a previous result's seed to reproduce it. */
  seed: z.number().int().positive().max(2_147_483_647).nullish(),
  /** Copy variant — cycles the editorial set for the same product. */
  variant: z.number().int().min(0).max(999).nullish(),
  /** Plan only: resolve niche + copy + dispatch, spend no Photoroom credit. */
  dryRun: z.boolean().optional(),
});

type AdStudioRequest = z.infer<typeof RequestSchema>;

/** Photoroom fetches the seller's image itself, so it must be a public https
 *  URL — data: URLs, blob: URLs, and plain http are rejected up front. */
function parsePublicImageUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    if (!url.hostname.includes('.')) return null;
    return url;
  } catch {
    return null;
  }
}

async function authenticate(): Promise<{ userId: string } | NextResponse> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: async () => (await cookies()).getAll(),
        setAll: async (cookiesToSet) => {
          const cookieStore = await cookies();
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    },
  );
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
  }
  return { userId: user.id };
}

// ── Photoroom ───────────────────────────────────────────────────────────────

class PhotoroomError extends Error {
  readonly status: number;
  readonly retryAfter?: number;
  constructor(message: string, status: number, retryAfter?: number) {
    super(message);
    this.name = 'PhotoroomError';
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

/** Photoroom answers non-200 with JSON: { "error": { "message": "…" } }
 *  (older shapes use `detail` / `message`). Never leak a raw body. */
function extractPhotoroomMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: unknown } | string;
      detail?: unknown;
      message?: unknown;
    };
    if (typeof parsed.error === 'string') return parsed.error;
    if (parsed.error && typeof parsed.error === 'object' && typeof parsed.error.message === 'string') {
      return parsed.error.message;
    }
    if (typeof parsed.detail === 'string') return parsed.detail;
    if (typeof parsed.message === 'string') return parsed.message;
  } catch {
    // Non-JSON body (HTML gateway page) — fall through.
  }
  return '';
}

function classifyPhotoroomFailure(status: number, body: string): PhotoroomError {
  const detail = extractPhotoroomMessage(body).slice(0, 240);
  if (status === 401 || status === 403) {
    return new PhotoroomError('Ad Studio is not configured correctly — the Photoroom key was rejected.', 500);
  }
  if (status === 402) {
    return new PhotoroomError('Ad Studio credits are exhausted. Top up Photoroom to keep generating.', 402);
  }
  if (status === 429) {
    return new PhotoroomError('The studio is busy — please try again in a moment.', 429, 7);
  }
  if (status === 400 || status === 422) {
    return new PhotoroomError(
      detail ? `Photoroom could not use this image: ${detail}` : 'Photoroom could not use this image. Try a clearer product photo.',
      422,
    );
  }
  if (status >= 500) {
    return new PhotoroomError('The studio backend is unavailable. Please retry shortly.', 502);
  }
  return new PhotoroomError(detail || `Photoroom request failed (${status}).`, 502);
}

type PhotoroomComposite = {
  bytes: Uint8Array;
  contentType: string;
  seed: number | null;
};

async function dispatchPhotoroom(args: {
  apiKey: string;
  imageUrl: string;
  params: Record<string, string>;
}): Promise<PhotoroomComposite> {
  const url = new URL(PHOTOROOM_EDIT_ENDPOINT);
  url.searchParams.set('imageUrl', args.imageUrl);
  for (const [key, value] of Object.entries(args.params)) url.searchParams.set(key, value);

  const headers: Record<string, string> = { 'x-api-key': args.apiKey };
  // Optional pin of the AI Backgrounds model (docs: '3' is the default,
  // 'background-studio-beta-…' the recommended studio model). Unset = default.
  const modelVersion = process.env.PHOTOROOM_BACKGROUND_MODEL_VERSION?.trim();
  if (modelVersion) headers['pr-ai-background-model-version'] = modelVersion;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PHOTOROOM_TIMEOUT_MS);
  try {
    let response: Response;
    try {
      response = await fetch(url, { method: 'GET', headers, signal: controller.signal, cache: 'no-store' });
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') {
        throw new PhotoroomError('The studio took too long to compose this scene. Please try again.', 504);
      }
      throw new PhotoroomError('Could not reach the studio backend. Check your connection and retry.', 502);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error(`${LOG} photoroom ${response.status}:`, body.slice(0, 500));
      throw classifyPhotoroomFailure(response.status, body);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) {
      const body = await response.text().catch(() => '');
      console.error(`${LOG} photoroom returned non-image content-type "${contentType}":`, body.slice(0, 500));
      throw new PhotoroomError('The studio returned an unexpected response. Please try again.', 502);
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0) {
      throw new PhotoroomError('The studio returned an empty image. Please try again.', 502);
    }

    const seedHeader = response.headers.get('pr-ai-background-seed');
    const seed = seedHeader && /^\d+$/.test(seedHeader) ? Number(seedHeader) : null;
    return { bytes, contentType: contentType.split(';')[0].trim(), seed };
  } finally {
    clearTimeout(timer);
  }
}

// ── Delivery ────────────────────────────────────────────────────────────────

function extensionFor(contentType: string): string {
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
  return 'png';
}

/** Rehost into the platform's existing 'brand' bucket (the bucket the themes
 *  page and lib/siteAssets already write to). Timestamped path so a
 *  regeneration never overwrites a still a seller may already have shared. */
async function deliverComposite(args: {
  userId: string;
  niche: string;
  width: number;
  height: number;
  composite: PhotoroomComposite;
}): Promise<{ imageUrl: string; delivery: AdStudioDelivery }> {
  const { composite } = args;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (serviceKey && supabaseUrl) {
    try {
      const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
      const path = `ad-studio/${args.userId}/${Date.now()}-${args.niche.toLowerCase()}-${args.width}x${args.height}.${extensionFor(composite.contentType)}`;
      const { error } = await admin.storage.from(BRAND_BUCKET).upload(path, composite.bytes, {
        contentType: composite.contentType,
        upsert: false,
      });
      if (error) throw new Error(error.message);
      const { data } = admin.storage.from(BRAND_BUCKET).getPublicUrl(path);
      if (data?.publicUrl) return { imageUrl: data.publicUrl, delivery: 'storage' };
      throw new Error(`No public URL for ${path}`);
    } catch (error) {
      console.warn(`${LOG} storage rehost failed — delivering inline:`, error instanceof Error ? error.message : error);
    }
  } else {
    console.warn(`${LOG} SUPABASE_SERVICE_ROLE_KEY unset — delivering inline.`);
  }

  const base64 = Buffer.from(composite.bytes).toString('base64');
  return { imageUrl: `data:${composite.contentType};base64,${base64}`, delivery: 'inline' };
}

// ── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const auth = await authenticate();
    if (auth instanceof NextResponse) return auth;

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
    }

    const parsed = RequestSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const where = issue?.path?.length ? `${issue.path.join('.')}: ` : '';
      return NextResponse.json({ error: `${where}${issue?.message ?? 'Invalid request.'}` }, { status: 400 });
    }
    const body: AdStudioRequest = parsed.data;

    const sourceUrl = parsePublicImageUrl(body.imageUrl);
    if (!sourceUrl) {
      return NextResponse.json(
        { error: 'imageUrl must be a public https URL the studio can fetch.' },
        { status: 400 },
      );
    }

    // ── Niche Intelligence ────────────────────────────────────────────────
    const { preset, match } = resolveNichePreset({
      category: body.category,
      productTitle: body.productTitle,
      override: body.niche ?? null,
    });
    const format = AD_FORMATS[body.aspectRatio];
    const copy = composeEditorialCopy(preset, { productTitle: body.productTitle, variant: body.variant });
    const params = buildPhotoroomEditParams(preset, format, { seed: body.seed });
    const tenantDomain = formatTenantDomain(body.tenantDomain);

    const base: Omit<AdStudioRenderResult, 'mock' | 'mockReason' | 'imageUrl' | 'delivery' | 'seed'> = {
      ok: true,
      niche: preset.key,
      nicheLabel: preset.label,
      nicheDirection: preset.direction,
      matchedSignals: match.matched,
      aspectRatio: format.ratio,
      width: format.width,
      height: format.height,
      sourceImageUrl: sourceUrl.toString(),
      copy,
      productTitle: body.productTitle,
      displayTitle: toDisplayTitle(body.productTitle),
      price: body.price,
      priceLabel: formatDalasi(body.price) ?? '',
      tenantDomain,
      photoroom: {
        scenePrompt: preset.photoroom.scenePrompt,
        shadowMode: preset.photoroom.shadowMode,
        params,
      },
    };

    const respondMock = (mockReason: AdStudioMockReason) => {
      const result: AdStudioRenderResult = {
        ...base,
        mock: true,
        mockReason,
        imageUrl: sourceUrl.toString(),
        delivery: 'source',
        seed: body.seed ?? null,
      };
      return NextResponse.json(result, { status: 200 });
    };

    if (body.dryRun) return respondMock('dry_run');

    const apiKey = process.env.PHOTOROOM_API_KEY?.trim();
    if (!apiKey) {
      console.warn(`${LOG} PHOTOROOM_API_KEY unset — answering with the mock composite.`);
      return respondMock('photoroom_key_missing');
    }

    // ── Photoroom dispatch ────────────────────────────────────────────────
    const composite = await dispatchPhotoroom({ apiKey, imageUrl: sourceUrl.toString(), params });
    const delivered = await deliverComposite({
      userId: auth.userId,
      niche: preset.key,
      width: format.width,
      height: format.height,
      composite,
    });

    const result: AdStudioRenderResult = {
      ...base,
      mock: false,
      mockReason: null,
      imageUrl: delivered.imageUrl,
      delivery: delivered.delivery,
      seed: composite.seed ?? body.seed ?? null,
    };
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof PhotoroomError) {
      const payload: Record<string, unknown> = { error: error.message };
      if (error.retryAfter) payload.retry_after = error.retryAfter;
      return NextResponse.json(payload, { status: error.status });
    }
    console.error(`${LOG} error:`, error);
    return NextResponse.json({ error: 'Ad generation failed. Please try again.' }, { status: 500 });
  }
}
