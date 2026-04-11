import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Replicate from 'replicate';

// ============================================================
// SMART PROMPT ROUTER: Category → Premium photography prompt
// ============================================================
const CATEGORY_PROMPTS: Record<string, string> = {
  'Fashion': [
    'ultra-high-end fashion editorial background, clean white seamless studio backdrop,',
    'soft diffused overhead lighting with subtle floor shadow, luxury fashion magazine',
    'aesthetic, minimal and elegant, 8K commercial product photography',
  ].join(' '),

  'Sneakers': [
    'premium sneaker photography, pure white floating background, subtle ground reflection,',
    'dramatic side-key lighting with soft fill, sneaker culture editorial aesthetic,',
    'hyper-detailed, sharp, clean and modern studio look',
  ].join(' '),

  'Beauty & Wellness': [
    'luxury beauty editorial photography, white Carrara marble surface, soft diffused natural',
    'window light, scattered rose petals and water droplets as accents, pastel pink and cream',
    'color palette, spa-inspired, high-end cosmetics campaign quality',
  ].join(' '),

  'Home & Artisan': [
    'artisan lifestyle product photography, warm natural oak wood surface, soft afternoon',
    'window light casting gentle shadows, neutral linen textured backdrop, bohemian editorial,',
    'handcrafted and organic feel, warm earthy tones, home decor magazine aesthetic',
  ].join(' '),

  'Tech Accessories': [
    'cutting-edge tech product photography, dark matte carbon fiber surface background,',
    'dramatic neon accent lighting in deep electric blue and violet, futuristic sleek look,',
    'sharp reflective highlights, cyberpunk editorial, premium electronics showcase, 8K',
  ].join(' '),

  'Food & Culinary': [
    'premium food editorial photography, dark moody rustic wood surface with marble accents,',
    'professional overhead studio lighting, fresh ingredient props and herbs as accents,',
    'Michelin-star restaurant aesthetic, rich warm tones, deeply appetizing and luxurious',
  ].join(' '),
};

const FALLBACK_PROMPT =
  'clean white seamless studio background, professional product photography, ' +
  'soft even diffused lighting, subtle drop shadow, commercial photography quality, ' +
  'neutral and elegant presentation';

// ============================================================
// REPLICATE CLIENT
// ============================================================
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// ============================================================
// POST /api/ai/enhance
// Body: { imageUrl: string, category?: string }
// ============================================================
export async function POST(req: Request) {
  try {
    // ----------------------------------------------------------
    // 1. AUTHENTICATION — verify Supabase session
    // ----------------------------------------------------------
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

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to use AI image enhancement.' },
        { status: 401 }
      );
    }

    // ----------------------------------------------------------
    // 2. VALIDATE REQUEST BODY
    // ----------------------------------------------------------
    const body = await req.json();
    const { imageUrl, category } = body as { imageUrl?: string; category?: string };

    if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith('http')) {
      return NextResponse.json(
        { error: 'A valid imageUrl is required.' },
        { status: 400 }
      );
    }

    if (!process.env.REPLICATE_API_TOKEN) {
      console.error('REPLICATE_API_TOKEN is not configured.');
      return NextResponse.json(
        { error: 'Image enhancement service is not configured.' },
        { status: 500 }
      );
    }

    // ----------------------------------------------------------
    // 3. SMART PROMPT ROUTING
    // ----------------------------------------------------------
    const enhancementPrompt =
      (category && CATEGORY_PROMPTS[category]) ?? FALLBACK_PROMPT;

    // ----------------------------------------------------------
    // 4. STEP 1 — Strip background with cjwbw/rembg
    // ----------------------------------------------------------
    const bgRemovalOutput = await replicate.run(
      'cjwbw/rembg:fb8af171cfa1616ddcf1242c093f9c46bcada5ad7d1a9c3e2a17c82cff50bde7' as `${string}/${string}:${string}`,
      { input: { image: imageUrl } }
    );

    const transparentProductUrl: string = Array.isArray(bgRemovalOutput)
      ? (bgRemovalOutput[0] as string)
      : (bgRemovalOutput as unknown as string);

    if (!transparentProductUrl) {
      return NextResponse.json(
        { error: 'Background removal failed. Please try a different image.' },
        { status: 500 }
      );
    }

    // ----------------------------------------------------------
    // 5. STEP 2 — Synthesize premium background via img2img
    //    Model: stability-ai/stable-diffusion-img2img
    // ----------------------------------------------------------
    const enhancedOutput = await replicate.run(
      'stability-ai/stable-diffusion-img2img:15a3689ee13b0d2616e98820eca31d4af4a0e80d6214e27320c35f52f9d4c0d1' as `${string}/${string}:${string}`,
      {
        input: {
          image: transparentProductUrl,
          prompt: enhancementPrompt,
          negative_prompt:
            'blurry, low quality, distorted product, text, watermark, logo, duplicate',
          strength: 0.6,
          guidance_scale: 8,
          num_inference_steps: 50,
          scheduler: 'K-LMS',
        },
      }
    );

    const enhancedImageUrl: string = Array.isArray(enhancedOutput)
      ? (enhancedOutput[0] as string)
      : (enhancedOutput as unknown as string);

    if (!enhancedImageUrl) {
      return NextResponse.json(
        { error: 'Background synthesis failed. Please try again.' },
        { status: 500 }
      );
    }

    // ----------------------------------------------------------
    // 6. RETURN RESULT
    // ----------------------------------------------------------
    return NextResponse.json(
      {
        enhancedImageUrl,
        transparentProductUrl,
        category: category ?? 'default',
        prompt: enhancementPrompt,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('AI enhance route error:', error);
    return NextResponse.json(
      { error: 'Image enhancement failed. Please try again.' },
      { status: 500 }
    );
  }
}
