import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Replicate from 'replicate';

// ─── NICHE-AWARE STUDIO PROMPTS ───────────────────────────────────────────────
// Keyed by the niche string returned from /api/ai/upscale-caption.
// Each prompt is tuned for the visual language of that product category.
const NICHE_PROMPTS: Record<string, string> = {
  JEWELRY:
    'placed on a black silk cushion, soft directional side-lighting, shallow depth of field, ' +
    'macro jewellery product photography, rich dark background, 8K ultra-detail, editorial luxury',

  FASHION:
    'clean white seamless studio backdrop, soft diffused overhead lighting with subtle floor shadow, ' +
    'luxury fashion magazine aesthetic, Vogue editorial, minimal and elegant, 8K commercial product photography',

  BEAUTY:
    'luxury beauty editorial, white Carrara marble surface, soft diffused natural window light, ' +
    'scattered rose petals and water droplets, pastel pink and cream palette, spa-inspired, high-end cosmetics campaign',

  HOME_DECOR:
    'natural sunlight streaming through a window, placed on a white marble countertop, ' +
    'cozy lifestyle atmosphere, warm neutral tones, editorial home decor magazine aesthetic',

  TECH:
    'dark matte carbon fiber surface, dramatic neon accent lighting in electric blue and violet, ' +
    'futuristic premium electronics showcase, sharp reflective highlights, cyberpunk editorial, 8K',

  FOOD:
    'dark moody rustic wood surface with marble accents, professional overhead studio lighting, ' +
    'fresh ingredient props and herbs as accents, Michelin-star restaurant aesthetic, rich warm tones, deeply appetizing',

  DEFAULT:
    'clean white seamless studio background, professional product photography, ' +
    'soft even diffused lighting, subtle drop shadow, commercial photography quality, neutral and elegant presentation',
};

// ─── SAFE URL EXTRACTOR (mirrors remove-bg) ──────────────────────────────────
function extractUrl(output: unknown): string {
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) {
    const first = output[0];
    if (!first) return '';
    if (typeof first === 'string') return first;
    if (typeof (first as any).url === 'function') {
      const u = (first as any).url();
      return u?.href ?? u?.toString() ?? String(first);
    }
    return String(first);
  }
  if (output && typeof (output as any).url === 'function') {
    const u = (output as any).url();
    return u?.href ?? u?.toString() ?? String(output);
  }
  return String(output ?? '');
}

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

// Tell Vercel to allow up to 60 s for this function (requires Pro or higher).
// NOTE: lucataco/realvisxl-v2-img2img is a COLD model — cold boots can take
// 3+ minutes. If 60 s is still too short, consider Vercel Pro (up to 300 s)
// or migrate to a WARM model such as stability-ai/sdxl.
export const maxDuration = 60;

// ============================================================
// POST /api/ai/generate-bg
// Body:    { transparentImageUrl: string, niche: string, category?: string }
// Returns: { enhancedImageUrl: string, prompt: string, niche: string }
//
// Step 3 of the 3-step enhancement cascade.
// ============================================================
export async function POST(req: Request) {
  try {
    // ── AUTH ──────────────────────────────────────────────────
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

    // ── VALIDATE ──────────────────────────────────────────────
    const { transparentImageUrl, niche, category } = await req.json() as {
      transparentImageUrl?: string;
      niche?: string;
      category?: string;
    };

    if (!transparentImageUrl || typeof transparentImageUrl !== 'string' || !transparentImageUrl.startsWith('http')) {
      return NextResponse.json(
        { error: 'A valid transparentImageUrl is required.' },
        { status: 400 }
      );
    }
    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json({ error: 'AI service is not configured.' }, { status: 500 });
    }

    // ── RESOLVE NICHE PROMPT ──────────────────────────────────
    // niche comes from Step 1 (BLIP detection). category is a fallback.
    const resolvedNiche = niche ?? 'DEFAULT';
    const prompt = NICHE_PROMPTS[resolvedNiche] ?? NICHE_PROMPTS.DEFAULT;

    // ── RUN IMG2IMG BACKGROUND SYNTHESIS ─────────────────────
    const output = await replicate.run(
      'lucataco/realvisxl-v2-img2img:47e54eff7b805b79428ffcb4a972d29bf68199e53fc626455d10b1f0cc57fbbc' as `${string}/${string}:${string}`,
      {
        input: {
          image: transparentImageUrl,
          prompt,
          negative_prompt:
            'blurry, low quality, distorted product, text, watermark, logo, duplicate, deformed',
          strength: 0.6,
          guidance_scale: 8,
          num_inference_steps: 50,
          scheduler: 'DPMSolverMultistep',
        },
      }
    );

    const enhancedImageUrl = extractUrl(output);

    if (!enhancedImageUrl) {
      return NextResponse.json(
        { error: 'Background synthesis produced no output. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { enhancedImageUrl, prompt, niche: resolvedNiche },
      { status: 200 }
    );

  } catch (error) {
    console.error('[generate-bg] error:', error);
    const message = error instanceof Error ? error.message : 'Background generation failed.';

    const isRateLimit =
      (error as any)?.status === 429 ||
      (error as any)?.response?.status === 429 ||
      message.toLowerCase().includes('rate limit') ||
      message.includes('429') ||
      message.toLowerCase().includes('too many requests');

    if (isRateLimit) {
      return NextResponse.json(
        { error: 'AI Model Busy — rate limited. Retrying shortly...', retry_after: 7 },
        { status: 429 }
      );
    }

    // The RealVisXL model is COLD — cold boots can exhaust the function timeout.
    // Surface this as a retriable 503 so the client shows a helpful message.
    const isColdBootTimeout =
      message.toLowerCase().includes('timed out') ||
      message.toLowerCase().includes('timeout') ||
      message.toLowerCase().includes('prediction failed') ||
      message.toLowerCase().includes('starting');

    if (isColdBootTimeout) {
      return NextResponse.json(
        {
          error:
            'AI Studio is warming up (cold boot). Please retry in 30 seconds.',
          retry_after: 30,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    // No temp storage files are created in this route — nothing to clean up.
  }
}
