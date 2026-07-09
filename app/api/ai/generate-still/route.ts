import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { fal } from '@/lib/fal';
import { generateWithFallback } from '@/lib/llm';
import { ELITE_COPY_RULES } from '@/lib/adCopy';
import {
  AdPipelineError,
  createAdProgressStream,
  describeFalQueueUpdate,
  SSE_HEADERS,
  type AdProgressEvent,
  type FalQueueUpdate,
} from '@/lib/adProgress';

// Unified director schema — under the BiRefNet → IC-Light architecture, apparel and
// cosmetics now require the same output shape. The seller's foreground (product + any
// model + styling) is extracted whole; only the environment is generated.
const DirectorSchema = z.object({
  scene_prompt: z.string(),
  motion_prompt: z.string(),
  hook: z.string(),
  value_prop: z.string(),
  cta: z.string(),
}).superRefine((data, ctx) => {
  for (const f of ['scene_prompt', 'motion_prompt', 'hook', 'value_prop', 'cta'] as const) {
    if (!data[f] || data[f].trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [f], message: `${f} is required` });
    }
  }
});

// Director + BiRefNet run in parallel, then IC-Light composes the scene;
// comfortably under 60s, but keep 300s headroom for unusual cold-starts.
export const maxDuration = 300;

const CATEGORIES = ['apparel', 'cosmetics', 'electronics', 'food', 'other'] as const;
type Category = (typeof CATEGORIES)[number];

// Bulletproof URL extraction — Fal models return image URLs under several
// different keys depending on the model (image.url, images[0].url, image_url, url, etc.).
// The Fal client wraps everything in { data, requestId }; older shims hand back the raw payload,
// so we check both.
function extractFalImageUrl(result: any): string | null {
  if (!result) return null;
  const data = result.data ?? result;
  if (!data) return null;
  if (typeof data === 'string') return data;

  return (
    data.image?.url ||
    data.images?.[0]?.url ||
    data.image_url ||
    data.url ||
    data.output?.url ||
    data.output?.[0]?.url ||
    (typeof data.output === 'string' ? data.output : null) ||
    null
  );
}

function logFalFailure(stage: string, result: any) {
  console.error(
    `[generate-still] ${stage} — could not extract image URL. Full Fal response:`,
    JSON.stringify(result, null, 2)
  );
}

// Wraps fal.subscribe so 422/4xx failures surface the actual FastAPI `detail`
// array instead of opaque "[Object]" output. Re-throws so existing error flow is unchanged.
// The optional onQueueUpdate hook feeds the SSE progress stream — it never
// changes model inputs or outputs.
async function falSubscribeWithLogging<T = any>(
  modelId: string,
  input: Record<string, unknown>,
  stageLabel: string,
  onQueueUpdate?: (update: FalQueueUpdate) => void,
): Promise<T> {
  try {
    const result = (await fal.subscribe(modelId, { input, logs: false, onQueueUpdate })) as T;

    // ── Silent-failure detection (apparent-success responses with bad payloads) ──
    // Some Fal models return HTTP 200 + a valid URL pointing at a blank/black PNG
    // when their content filter triggers. We catch two signals before returning so
    // the UI sees a clean error instead of rendering a black image.
    const data = (result as any)?.data ?? result;

    // NSFW / content-filter trigger — Flux endpoints expose this on success.
    const nsfwFlagged =
      data?.has_nsfw_concepts?.[0] === true ||
      data?.has_nsfw_concepts === true ||
      data?.nsfw_detected === true ||
      data?.is_nsfw === true;
    if (nsfwFlagged) {
      console.error(
        `[generate-still] Fal ${modelId} (${stageLabel}) was content-filtered. Full response:`,
        JSON.stringify(data, null, 2)
      );
      // AdPipelineError carries this crafted copy all the way to the seller
      // instead of collapsing into the generic catch-all message.
      throw new AdPipelineError(
        `${stageLabel} output was blocked by the provider's content filter. Please retry or use a different photo.`,
        500
      );
    }

    // Suspiciously small file size = likely blank / near-empty image.
    // Real images are consistently >50KB; blank PNGs of any size compress to <2KB.
    // Check is defensive — only fires if the model exposes file_size at all.
    const imageField = data?.image ?? data?.images?.[0];
    const fileSize = imageField?.file_size;
    if (typeof fileSize === 'number' && fileSize < 2000) {
      console.error(
        `[generate-still] Fal ${modelId} (${stageLabel}) returned suspiciously small file (${fileSize} bytes) — likely blank/black. Full response:`,
        JSON.stringify(data, null, 2)
      );
      throw new AdPipelineError(
        `${stageLabel} returned an empty image. The model may have failed silently. Please retry.`,
        500
      );
    }

    return result;
  } catch (err: any) {
    const status = err?.status ?? err?.response?.status ?? 'unknown';
    const body = err?.body ?? err?.response?.body ?? err?.responseBody;
    console.error(`[generate-still] Fal ${modelId} (${stageLabel}) failed — HTTP ${status}`);
    console.error(`[generate-still] Fal error body:`, JSON.stringify(body ?? err, null, 2));
    if (err?.message) console.error(`[generate-still] Fal error message:`, err.message);
    throw err;
  }
}

function buildDirectorPrompt(
  product: { name: string; description: string | null },
  category: Category,
): string {
  const SCENE_DIRECTIONS: Record<Category, string> = {
    apparel: `SCENE DIRECTION (apparel): describe a luxury fashion-editorial backdrop — seamless cyclorama, soft natural light, refined materials (marble, linen-draped surfaces, brushed brass, raw concrete, warm wood). The seller's foreground will already contain the product and any model wearing it; design the backdrop to flatter without competing for attention. Avoid props that imply a different scale or context than the seller's subject.`,
    electronics: `SCENE DIRECTION (electronics): describe a minimalist premium tech studio — dark matte backdrop with a brushed-aluminum or smoked-glass surface, precise LED rim-light tracing the product's edges, clean mirror reflections beneath the device, floating light particles or micro-glints as the animatable element. Apple-launch aesthetic: restrained, geometric, high contrast. No clutter, no cables, no office props.`,
    food: `SCENE DIRECTION (food): describe a rustic-premium culinary scene — warm natural daylight from a side window, textured wood or stone table, fresh ingredients relevant to the product scattered artfully around the hero (herbs, citrus, grains, spices), linen napkin texture, appetizing steam or drizzle as the animatable element. Bon Appétit editorial standard: appetizing, tactile, real. Steam is encouraged here.`,
    other: `SCENE DIRECTION (general product): describe a clean premium studio still-life — gradient backdrop in a tone that complements the product, elevated pedestal or floating surface, one directional key light with a soft shadow, and at least one animatable atmospheric element (drifting particles, a ribbon of fabric, water ripples). Neutral luxury: let the product's own color story lead.`,
    cosmetics: `SCENE DIRECTION (cosmetics) — NICHE INTELLIGENCE BINDING:

The scene must match high-end beauty-industry studio photography (Sephora, Glossier, Aēsop, La Mer). Generic "smoke + rocks" defaults are FORBIDDEN.

VAPOR BAN — these words must NEVER appear in scene_prompt:
- "smoke", "smoky"
- "fog", "foggy"
- "clouds", "cloudy"
- "dust" (the word — "dust motes" inside motion_prompt remains allowed there)
- "vapor", "steam"
(Volumetric "haze" remains acceptable as a lighting atmospheric — that's a different visual concept.)

FLUID DYNAMICS — if the product is a serum, oil, cream, lotion, essence, toner, or any liquid/semi-liquid formulation (detect from product name/description), the scene_prompt MUST include all of:
- "dynamic macro fluid splash matching the product's color and texture"
- "floating cosmetic oil droplets" OR "weightless liquid pearls" (whichever fits the formulation)
- "clean studio color-gradient backdrop" (NOT a textured/rocky/smoky surface)
- Optional: "macro depth-of-field with selective focus on the splash"

ACTIVE INGREDIENT ANCHORING — read the product name AND description carefully. Detect the lead actives or product archetype and weave them ORGANICALLY into the scene assets:
- Organic / botanical / "natural" / herbal → "crisp floating botanical leaves" + "fresh green tones in the backdrop gradient"
- Vitamin C / "brightening" / "glow" → "glowing golden amber fluid ripples" + "warm golden backdrop gradient"
- Retinol / "anti-aging" / "renewal" → "luminous gold serum droplets" + "soft champagne-gold gradient"
- Hyaluronic / hydration / "moisture" / "dewy" → "weightless water pearls catching light" + "cool aqua-blue gradient"
- Niacinamide / "clarifying" / "pore" → "translucent crystalline droplets" + "soft pearl backdrop"
- Vitamin E / oils / cuticle / hair → "amber oil cascade with golden refraction" + "warm bronze gradient"
- Charcoal / detox / activated → "deep onyx liquid ribbons" + "graphite-to-black gradient" (NEVER "smoke")
- Floral / rose / lavender → "drifting petal of the relevant flower" + "soft tonal gradient matching the floral"
- Honey / propolis / royal jelly → "amber honey drips with light caustics" + "warm amber gradient"

The ingredient anchor must FEEL native to the scene — not pasted on. If the product description names no clear active, default to a clean macro fluid splash matching the bottle/jar color in a soft gradient backdrop. NEVER rocks, NEVER smoke, NEVER fog.

The motion_prompt must still animate at least one element from the scene_prompt per the four-pillar rules below (so the fluid splash, the petals, the droplets become the motion subject).`,
  };
  const sceneDirection = SCENE_DIRECTIONS[category];

  return `You are the creative director for Sanndikaa, an enterprise-grade African e-commerce platform.

Product: ${product.name}
${product.description ? `Description: ${product.description}` : ''}
Category: ${category}

Sanndikaa serves the premium African marketplace. Output must match the standard of elite Shopify and Amazon storefronts — Aēsop, Glossier, Loewe, Apple, Telfar. Confident, sensory, heritage-aware. NEVER discount-retailer voice.

The architecture: the seller's foreground (product + any model + shoes + styling) is extracted as a single pristine unit. Your scene_prompt builds the luxury environment around it. Your copy sells the product as worth buying before the customer sees the price.

Return a JSON object with exactly these keys:
- "scene_prompt"  : 30-60 word description of a photorealistic premium environment. Mention materials, lighting, atmosphere. Include AT LEAST ONE animatable element (petals, water ripples, mist, leaves, dust motes, fabric drift in the air) so the motion_prompt has something to set in motion.
- "motion_prompt" : 50-80 word agency-grade cinematography brief for the video step (Kling 1.6 Pro). Follow the MOTION_PROMPT RULES below — non-negotiable.
- "hook"          : 3-5 word scroll-stopping editorial line
- "value_prop"    : 3-5 word benefit / ingredient / craftsmanship cue
- "cta"           : 3-5 word quiet, confident call-to-action

${sceneDirection}

${ELITE_COPY_RULES}

MOTION_PROMPT RULES — ALL FOUR PILLARS REQUIRED, NO EXCEPTIONS:
(1) KINETIC SPEED RAMP — the move MUST change speed inside the shot. Use constructs like "fast push-in, hard deceleration at hero, then accelerated pull-back", "snap-zoom into locked hold then surge-out", "whip into freeze then ramp-back". A constant-speed move is FORBIDDEN.
(2) COMPOUND CAMERA — rotation MUST be combined with spatial translation. Acceptable moves: spiral push-in, orbit-while-craning-up, barrel-roll dolly, arc-and-tilt, corkscrew approach, helix retreat. Single-axis moves (pure dolly, pure pan, pure zoom) are FORBIDDEN.
(3) VOLUMETRIC / LIGHTING FX — animate the LIGHT itself. Required vocabulary: moving caustics across glass, sweeping anamorphic lens flare, shifting god-rays, refraction sparkle chasing the rotation, dynamic specular highlights, lighting "ignites" or "flares" as camera passes.
(4) IN-SCENE OBJECT MOTION — animate at least one background element FROM the scene_prompt: petals scatter from a virtual gust, water ripples outward from the base, mist curls around the subject, leaves shimmer, dust motes drift through god-rays. The motion_prompt MUST reference at least one element you wrote into scene_prompt.

BANNED WORDS in motion_prompt: slow, slowly, graceful, gracefully, subtle, subtly, gentle, gently, linear, smooth, smoothly, calm, calmly, steady, steadily, simple, basic, minimal, soft (when describing motion).
PREFERRED VERBS in motion_prompt: snap, whip, surge, arc, ramp, ignite, sweep, corkscrew, lash, accelerate, decelerate, punch, lock, crash.

Example output (apparel):
{"scene_prompt":"Seamless soft-beige cyclorama backdrop with golden-hour key light from the left, gentle volumetric haze hanging in the air, single tropical leaf casting a long shadow across raw concrete floor, shallow depth of field, refined linen-draped surfaces flanking the frame","motion_prompt":"Snap push-in with whipping clockwise spiral around the subject, hard deceleration locking on the garment as an anamorphic flare sweeps across the linen; volumetric caustics ignite over the fabric in time with the rotation, leaves shimmer and dust motes drift through god-rays; final accelerated pull-back reveals haze swirling outward while light flares punch through the cyclorama","hook":"Hand-Cut Linen, Stillness","value_prop":"Hand-Loomed In Lagos","cta":"Wear The Heritage"}

Example output (cosmetics — Niche Intelligence applied to a hydrating serum):
{"scene_prompt":"Clean cool-aqua to soft-white color-gradient studio backdrop, dynamic macro fluid splash of dewy translucent serum matching the bottle's clear hydrating texture, weightless water pearls catching directional light floating around the product, single drifting hibiscus petal at the right edge, macro depth-of-field with selective focus on the splash, gentle volumetric haze","motion_prompt":"Snap push-in with whipping clockwise spiral around the bottle, hard deceleration locking on the label as an anamorphic flare sweeps across the glass; volumetric caustics ignite over the bottle in time with the rotation, water pearls scatter outward from a virtual gust, hibiscus petal drifts past the lens; final accelerated pull-back reveals concentric ripples blooming through the splash while god-rays punch through the haze","hook":"Skin Drinks Light","value_prop":"Botanical Ferments Brighten","cta":"Begin The Ritual"}`;
}

type StillPipelineContext = {
  admin: SupabaseClient;
  shopId: string;
  productId: string;
  category: Category;
  product: { id: string; name: string; description: string | null; image_url: string };
  // Mutable tracker so the failure path can mark the row failed even when the
  // pipeline throws after the insert.
  track: { videoAdId: string | null };
};

// The full still pipeline, shared by the JSON and SSE modes. `emit` is a
// no-op in JSON mode. Model ids, parameters, and the cutout → composite
// ordering (product-pixel integrity) are IDENTICAL to the pre-SSE pipeline.
async function executeStillPipeline(
  ctx: StillPipelineContext,
  emit: (event: AdProgressEvent) => void,
): Promise<Record<string, unknown>> {
  const { admin, shopId, productId, category, product, track } = ctx;

  // ── Stage 1: Director + BiRefNet in parallel (Law 3: render speed) ────
  // The two calls are fully independent — the director needs only the product
  // name/description; BiRefNet needs only the product photo. Running them
  // concurrently removes the entire BiRefNet latency (~3-5s) from the critical
  // path. Any failure here happens BEFORE the video_ads row exists, so the
  // failure handler simply returns an error with no row to mark failed.
  const directorPrompt = buildDirectorPrompt(product, category);
  console.log('[generate-still] Stage 1: Director + BiRefNet foreground extraction (parallel)');
  emit({ t: 'stage', key: 'directing' });
  // 'soft' — extraction runs in parallel with directing; it must not
  // auto-complete the directing row on the client checklist.
  emit({ t: 'stage', key: 'extracting', soft: true });

  const [{ data: director, provider }, isolateResult] = await Promise.all([
    generateWithFallback({
      schema: DirectorSchema,
      prompt: directorPrompt,
      callerName: 'generate-still',
    }).then((r) => {
      emit({ t: 'stage-done', key: 'directing' });
      emit({ t: 'detail', key: 'directing', message: 'Creative brief locked — scene, motion, and copy written.' });
      return r;
    }),
    // BiRefNet extracts the entire foreground subject — product + any model +
    // shoes + styling = a single pristine cutout. No diffusion model touches
    // the subject pixels at any point in the pipeline.
    falSubscribeWithLogging('fal-ai/birefnet', {
      image_url: product.image_url,
    }, 'BiRefNet', (update) => {
      const message = describeFalQueueUpdate(update, 'Foreground extraction');
      if (message) emit({ t: 'detail', key: 'extracting', message });
    }).then((r) => {
      emit({ t: 'stage-done', key: 'extracting' });
      emit({ t: 'detail', key: 'extracting', message: 'Product isolated — original pixels untouched.' });
      return r;
    }),
  ]);
  console.log(`[generate-still] Director generated by ${provider}:`, director);

  const cutoutUrl = extractFalImageUrl(isolateResult);
  if (!cutoutUrl) {
    logFalFailure('BiRefNet', isolateResult);
    throw new AdPipelineError(
      'Background removal failed. Please retry with a clearer product photo.',
      500
    );
  }
  console.log('[generate-still] BiRefNet cutout URL:', cutoutUrl);

  // ── Insert video_ads row ──────────────────────────────────────────────
  // Isolation is already done by insert time, so the row starts at the
  // 'composing' stage (the UI's STAGE_LABELS map matches).
  const { data: videoAd, error: insertError } = await admin
    .from('video_ads')
    .insert({
      shop_id: shopId,
      product_id: productId,
      category,
      status: 'pending',
      pipeline_stage: 'composing',
      scene_prompt: director.scene_prompt,
      motion_prompt: director.motion_prompt,
      storyboard: {
        hook: director.hook,
        value_prop: director.value_prop,
        cta: director.cta,
      },
    })
    .select()
    .single();

  if (insertError || !videoAd) {
    console.error('[generate-still] Insert failed:', insertError);
    throw new AdPipelineError('Failed to create video ad record.', 500);
  }
  track.videoAdId = videoAd.id;

  // ── Stage 2: IC-Light v2 — composite cutout into generated luxury scene ─
  // IC-Light only relights and composites; the subject pixels are preserved.
  console.log('[generate-still] Stage 2: IC-Light v2 scene composition');
  emit({ t: 'stage', key: 'composing' });
  emit({ t: 'detail', key: 'composing', message: 'Applying IC-Light studio relighting…' });
  const iclResult = await falSubscribeWithLogging('fal-ai/iclight-v2', {
    image_url: cutoutUrl,
    prompt: director.scene_prompt,
    // Law 3: 25 steps optimizes render latency while holding luxury asset quality.
    num_inference_steps: 25,
  }, 'IC-Light v2', (update) => {
    const message = describeFalQueueUpdate(update, 'Scene composition');
    if (message) emit({ t: 'detail', key: 'composing', message });
  });
  const heroImageUrl = extractFalImageUrl(iclResult);
  if (!heroImageUrl) {
    logFalFailure('IC-Light v2', iclResult);
    throw new Error('Scene composition failed: no image URL in IC-Light response.');
  }
  console.log('[generate-still] IC-Light hero URL:', heroImageUrl);
  emit({ t: 'stage-done', key: 'composing' });

  // ── Mark preview ready ────────────────────────────────────────────────
  emit({ t: 'stage', key: 'preview_ready' });
  const { data: updated, error: updateError } = await admin
    .from('video_ads')
    .update({
      hero_image_url: heroImageUrl,
      status: 'preview_ready',
      pipeline_stage: 'preview_ready',
    })
    .eq('id', videoAd.id)
    .select()
    .single();

  if (updateError || !updated) {
    console.error('[generate-still] Final update failed:', updateError);
    throw new AdPipelineError('Failed to save hero image.', 500);
  }
  emit({ t: 'stage-done', key: 'preview_ready' });

  return updated;
}

// Marks the row failed (when one exists) and maps any pipeline error to the
// same { message, status } contract the pre-SSE catch block produced.
async function failStillPipeline(
  error: unknown,
  admin: SupabaseClient | null,
  track: { videoAdId: string | null },
): Promise<{ message: string; status: number }> {
  console.error('[generate-still] fatal error:', error);
  if (admin && track.videoAdId) {
    await admin
      .from('video_ads')
      .update({ status: 'failed', pipeline_stage: 'failed' })
      .eq('id', track.videoAdId);
  }

  const err = error as { status?: number; response?: { status?: number }; message?: string } | null;
  const msg: string = err?.message || '';
  const isBusy =
    err?.status === 429 || err?.status === 503 ||
    err?.response?.status === 429 || err?.response?.status === 503 ||
    msg.includes('429') || msg.includes('503') ||
    msg.toLowerCase().includes('quota') ||
    msg.toLowerCase().includes('rate limit') ||
    msg.toLowerCase().includes('too many requests') ||
    msg.toLowerCase().includes('overloaded') ||
    msg.toLowerCase().includes('unavailable');

  if (isBusy) {
    return {
      message: 'The AI assistant is currently busy. Please try again in a moment.',
      status: 429,
    };
  }

  if (error instanceof AdPipelineError) {
    return { message: error.message, status: error.status };
  }

  return { message: 'Failed to generate scene. Please try again.', status: 500 };
}

export async function POST(req: Request) {
  const track: { videoAdId: string | null } = { videoAdId: null };
  let admin: SupabaseClient | null = null;

  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: async () => (await cookies()).getAll(),
          setAll: async (cookiesToSet) => {
            const cookieStore = await cookies();
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    const { data: shop } = await supabase.from('shops').select('id').eq('id', user.id).single();
    if (!shop) {
      return NextResponse.json({ error: 'Shop profile not found.' }, { status: 404 });
    }
    const shopId: string = shop.id;

    // ── Parse body ────────────────────────────────────────────────────────
    const body = await req.json();
    const productId: string | undefined = body?.productId;
    const rawCategory: string | undefined = body?.category;

    if (!productId || typeof productId !== 'string') {
      return NextResponse.json({ error: 'productId is required.' }, { status: 400 });
    }
    if (!rawCategory || !(CATEGORIES as readonly string[]).includes(rawCategory)) {
      return NextResponse.json(
        { error: `category must be one of: ${CATEGORIES.join(', ')}.` },
        { status: 400 }
      );
    }
    const category = rawCategory as Category;

    // ── Fetch product ─────────────────────────────────────────────────────
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, description, image_url')
      .eq('id', productId)
      .eq('user_id', user.id)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    }
    if (!product.image_url) {
      return NextResponse.json({ error: 'Product has no image to use as input.' }, { status: 400 });
    }

    // ── Env checks ────────────────────────────────────────────────────────
    if (!process.env.FAL_API_KEY) {
      return NextResponse.json({ error: 'Fal API key not configured.' }, { status: 500 });
    }

    admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const ctx: StillPipelineContext = {
      admin,
      shopId,
      productId,
      category,
      product: product as StillPipelineContext['product'],
      track,
    };

    // ── SSE mode — client opted in via Accept: text/event-stream ─────────
    // All auth/validation errors above still return plain JSON before the
    // stream starts. The terminal 'result' frame carries the exact payload
    // the JSON mode returns, so downstream client logic is unchanged.
    const wantsStream = (req.headers.get('accept') ?? '').includes('text/event-stream');
    if (wantsStream) {
      const { readable, send, close } = createAdProgressStream();
      const adminForStream = admin;

      void (async () => {
        try {
          const updated = await executeStillPipeline(ctx, send);
          send({ t: 'result', status: 200, payload: updated });
        } catch (error) {
          const { message, status } = await failStillPipeline(error, adminForStream, track);
          send({ t: 'error', status, error: message });
        } finally {
          close();
        }
      })();

      return new Response(readable, { status: 200, headers: SSE_HEADERS });
    }

    // ── JSON mode — identical contract to the pre-SSE route ──────────────
    const updated = await executeStillPipeline(ctx, () => {});
    return NextResponse.json(updated, { status: 200 });

  } catch (error) {
    const { message, status } = await failStillPipeline(error, admin, track);
    return NextResponse.json({ error: message }, { status });
  }
}
