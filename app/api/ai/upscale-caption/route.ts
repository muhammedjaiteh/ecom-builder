import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Replicate from 'replicate';

// ─── NICHE DETECTION ─────────────────────────────────────────────────────────
// Parses the BLIP caption to return a structured niche key.
// Falls back to the product category submitted from the form.
function detectNiche(caption: string, category?: string): string {
  const text = caption.toLowerCase().replace(/^caption:\s*/i, '');

  if (/watch|ring|necklace|bracelet|earring|jewel|diamond|pendant|bangle|gold chain/.test(text))
    return 'JEWELRY';
  if (/lipstick|perfume|serum|moisturizer|makeup|cosmetic|skincare|face cream|cologne|fragrance/.test(text))
    return 'BEAUTY';
  if (/phone|laptop|headphone|earphone|cable|charger|keyboard|mouse|gadget|electronic/.test(text))
    return 'TECH';
  if (/food|coffee|tea|drink|meal|fruit|vegetable|snack|bottle|jar/.test(text))
    return 'FOOD';
  if (/lamp|vase|candle|cushion|pillow|furniture|bowl|cup|mug|plant pot/.test(text))
    return 'HOME_DECOR';
  if (/dress|shirt|jacket|coat|pants|handbag|bag|purse|shoe|boot|sneaker|hat|scarf|clothing|garment/.test(text))
    return 'FASHION';

  // Fallback: use the category field from the form
  if (category) {
    const cat = category.toLowerCase();
    if (cat.includes('fashion') || cat.includes('sneaker')) return 'FASHION';
    if (cat.includes('beauty') || cat.includes('wellness')) return 'BEAUTY';
    if (cat.includes('home') || cat.includes('artisan')) return 'HOME_DECOR';
    if (cat.includes('tech')) return 'TECH';
    if (cat.includes('food') || cat.includes('culinary')) return 'FOOD';
  }

  return 'DEFAULT';
}

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

// ============================================================
// POST /api/ai/upscale-caption
// Body:    { imageUrl: string, category?: string }
// Returns: { hdImageUrl: string, niche: string, caption: string }
//
// Step 1 of the 3-step enhancement cascade.
// ─ Runs salesforce/blip to caption the image and detect the product niche.
// ─ (Optional upscaling) To enable Real-ESRGAN upscaling, uncomment the block
//   below once you have verified the current version hash from:
//   https://replicate.com/nightmareai/real-esrgan → "API" tab → "Version"
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
    const { imageUrl, category } = await req.json() as {
      imageUrl?: string;
      category?: string;
    };
    if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith('http')) {
      return NextResponse.json({ error: 'A valid imageUrl is required.' }, { status: 400 });
    }
    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json({ error: 'AI service is not configured.' }, { status: 500 });
    }

    // ── STEP 1A: CAPTION (niche detection) ────────────────────
    // salesforce/blip — image-to-text captioning
    // Version confirmed active: 2e1dddc8621f72155f24cf2e0adbde548458d3cab9f00c0139eea840d0ac4746
    const captionOutput = await replicate.run(
      'salesforce/blip:2e1dddc8621f72155f24cf2e0adbde548458d3cab9f00c0139eea840d0ac4746',
      { input: { image: imageUrl, task: 'image_captioning' } }
    );
    const caption = typeof captionOutput === 'string'
      ? captionOutput
      : String(captionOutput ?? '');

    const niche = detectNiche(caption, category);

    // ── STEP 1B: UPSCALE (optional — enable once hash is verified) ──
    // To activate: replace PASTE_VERIFIED_HASH_HERE with the real hash from
    // https://replicate.com/nightmareai/real-esrgan → API tab → Version
    //
    // const upscaleOutput = await replicate.run(
    //   'nightmareai/real-esrgan:PASTE_VERIFIED_HASH_HERE',
    //   { input: { image: imageUrl, scale: 2, face_enhance: false } }
    // );
    // const hdImageUrl = extractUrl(upscaleOutput) || imageUrl;
    //
    // Until a verified hash is in place, pass the original image to Step 2.
    const hdImageUrl = imageUrl;

    return NextResponse.json({ hdImageUrl, niche, caption }, { status: 200 });

  } catch (error) {
    console.error('[upscale-caption] error:', error);
    const message = error instanceof Error ? error.message : 'Vision analysis failed.';

    const isRateLimit =
      (error as any)?.status === 429 ||
      (error as any)?.response?.status === 429 ||
      message.toLowerCase().includes('rate limit') ||
      message.includes('429') ||
      message.toLowerCase().includes('too many requests');

    if (isRateLimit) {
      return NextResponse.json(
        { error: 'Rate limit reached. Retrying shortly...', retry_after: 7 },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
