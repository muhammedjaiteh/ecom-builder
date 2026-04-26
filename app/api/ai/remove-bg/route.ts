import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Replicate from 'replicate';

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

// Tell Vercel to allow up to 60 s for this function (requires Pro or higher).
export const maxDuration = 60;

// ─── SAFE URL EXTRACTOR ───────────────────────────────────────────────────────
// Replicate SDK v0.25+ returns FileOutput objects (not plain strings).
// FileOutput implements ReadableStream but also exposes .url() → URL and
// .toString() → the URL string. This function handles every known output shape:
//   • plain string          (older SDK / some models)
//   • FileOutput object     (newer SDK, single output)
//   • FileOutput[]          (newer SDK, array output)
//   • ReadableStream        (edge case — we fall back to String())
function extractUrl(output: unknown): string {
  if (typeof output === 'string') return output;

  if (Array.isArray(output)) {
    const first = output[0];
    if (!first) return '';
    if (typeof first === 'string') return first;
    // FileOutput — try .url() first, then .href, then coerce to string
    if (typeof (first as any).url === 'function') {
      const u = (first as any).url();
      return u?.href ?? u?.toString() ?? String(first);
    }
    return String(first);
  }

  // Single FileOutput
  if (output && typeof (output as any).url === 'function') {
    const u = (output as any).url();
    return u?.href ?? u?.toString() ?? String(output);
  }

  return String(output ?? '');
}

// ============================================================
// POST /api/ai/remove-bg
// Body:    { imageUrl: string }
// Returns: { transparentImageUrl: string }
//
// Step 2 of the 3-step enhancement cascade.
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
    const { imageUrl } = await req.json() as { imageUrl?: string };
    if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith('http')) {
      return NextResponse.json({ error: 'A valid imageUrl is required.' }, { status: 400 });
    }
    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json({ error: 'AI service is not configured.' }, { status: 500 });
    }

    // ── RUN BACKGROUND REMOVAL ────────────────────────────────
    const output = await replicate.run(
      'lucataco/remove-bg:95fcc2a26d3899cd6c2691c900465aaeff466285a65c14638cc5f36f34befaf1',
      { input: { image: imageUrl } }
    );

    const transparentImageUrl = extractUrl(output);

    if (!transparentImageUrl) {
      return NextResponse.json(
        { error: 'Background removal produced no output. Please try a different image.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ transparentImageUrl }, { status: 200 });

  } catch (error) {
    console.error('[remove-bg] error:', error);
    const message = error instanceof Error ? error.message : 'Background removal failed.';

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

    const isImageTooLarge =
      message.toLowerCase().includes('too large') ||
      message.toLowerCase().includes('payload') ||
      message.toLowerCase().includes('file size') ||
      (error as any)?.status === 413;

    if (isImageTooLarge) {
      return NextResponse.json(
        { error: 'Image Too Large — please use an image under 5 MB.' },
        { status: 413 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    // No temp storage files are created in this route — nothing to clean up.
  }
}
