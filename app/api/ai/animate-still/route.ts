import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { fal } from '@/lib/fal';

// Kling (~40s) + Creatomate poll (~30s) — comfortably under 300s.
export const maxDuration = 300;

type Storyboard = { hook: string; value_prop: string; cta: string };

function extractFalVideoUrl(result: any): string | null {
  if (!result) return null;
  const data = result.data ?? result;
  if (!data) return null;
  if (typeof data === 'string') return data;

  return (
    data.video?.url ||
    data.videos?.[0]?.url ||
    data.video_url ||
    data.url ||
    data.output?.url ||
    data.output?.[0]?.url ||
    (typeof data.output === 'string' ? data.output : null) ||
    null
  );
}

function logFalFailure(stage: string, result: any) {
  console.error(
    `[animate-still] ${stage} — could not extract video URL. Full Fal response:`,
    JSON.stringify(result, null, 2)
  );
}

function buildCreatomateSource(videoUrl: string, sb: Storyboard) {
  return {
    output_format: 'mp4',
    width: 1080,
    height: 1920,
    duration: 5,
    elements: [
      // ── Layer 1: Kling video, full canvas, loops if shorter than 5s ──
      {
        type: 'video',
        source: videoUrl,
        time: 0,
        duration: 5,
        width: '100%',
        height: '100%',
        x: '50%',
        y: '50%',
        x_anchor: '50%',
        y_anchor: '50%',
        fit: 'cover',
        loop: true,
      },

      // ── Layer 2: Bottom-half darkening gradient for caption legibility ──
      {
        type: 'shape',
        path: 'M 0,55 L 100,55 L 100,100 L 0,100 Z',
        width: '100%',
        height: '100%',
        x: '50%',
        y: '50%',
        x_anchor: '50%',
        y_anchor: '50%',
        fill_color: 'rgba(0,0,0,0.35)',
      },

      // ── Layer 3: Hook caption (0 → 1.65s) — TikTok-style box ──
      {
        type: 'text',
        text: sb.hook,
        time: 0,
        duration: 1.65,
        width: '84%',
        height: 'auto',
        x: '50%',
        y: '74%',
        x_anchor: '50%',
        y_anchor: '0%',
        font_family: 'Montserrat',
        font_weight: '800',
        font_size: 64,
        fill_color: '#FFFFFF',
        stroke_color: '#000000',
        stroke_width: 2,
        text_alignment: 'center',
        line_height: '120%',
        background_color: 'rgba(0,0,0,0.65)',
        background_x_padding: '10%',
        background_y_padding: '8%',
        background_border_radius: 14,
        animations: [
          { type: 'fade', time: 0, duration: 0.3 },
          { type: 'slide', direction: 'up', distance: '50px', time: 0, duration: 0.4, easing: 'bounce' },
        ],
      },

      // ── Layer 4: Value prop (1.65 → 3.35s) ──
      {
        type: 'text',
        text: sb.value_prop,
        time: 1.65,
        duration: 1.7,
        width: '84%',
        height: 'auto',
        x: '50%',
        y: '74%',
        x_anchor: '50%',
        y_anchor: '0%',
        font_family: 'Montserrat',
        font_weight: '700',
        font_size: 58,
        fill_color: '#FFFFFF',
        stroke_color: '#000000',
        stroke_width: 2,
        text_alignment: 'center',
        line_height: '120%',
        background_color: 'rgba(0,0,0,0.65)',
        background_x_padding: '10%',
        background_y_padding: '8%',
        background_border_radius: 14,
        animations: [
          { type: 'fade', time: 0, duration: 0.3 },
          { type: 'slide', direction: 'up', distance: '50px', time: 0, duration: 0.4, easing: 'bounce' },
        ],
      },

      // ── Layer 5: CTA (3.35 → 5s) — gold accent box, pop-in ──
      {
        type: 'text',
        text: sb.cta,
        time: 3.35,
        duration: 1.65,
        width: '84%',
        height: 'auto',
        x: '50%',
        y: '72%',
        x_anchor: '50%',
        y_anchor: '0%',
        font_family: 'Montserrat',
        font_weight: '900',
        font_size: 72,
        fill_color: '#FFFFFF',
        stroke_color: '#000000',
        stroke_width: 3,
        text_alignment: 'center',
        line_height: '120%',
        background_color: 'rgba(230,180,0,0.9)',
        background_x_padding: '12%',
        background_y_padding: '10%',
        background_border_radius: 18,
        animations: [
          { type: 'scale', start_value: '70%', end_value: '100%', time: 0, duration: 0.4, easing: 'bounce' },
          { type: 'fade', time: 0, duration: 0.25 },
        ],
      },
    ],
  };
}

export async function POST(req: Request) {
  let videoAdId: string | null = null;
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

    // ── Parse body ────────────────────────────────────────────────────────
    const body = await req.json();
    const id: string | undefined = body?.videoAdId;
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'videoAdId is required.' }, { status: 400 });
    }
    videoAdId = id;

    // ── Env checks ────────────────────────────────────────────────────────
    if (!process.env.FAL_API_KEY) {
      return NextResponse.json({ error: 'Fal API key not configured.' }, { status: 500 });
    }
    if (!process.env.CREATOMATE_API_KEY) {
      return NextResponse.json({ error: 'Creatomate API key not configured.' }, { status: 500 });
    }

    admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // ── Load + authorize row ──────────────────────────────────────────────
    const { data: row, error: fetchError } = await admin
      .from('video_ads')
      .select('id, shop_id, hero_image_url, motion_prompt, storyboard, status')
      .eq('id', id)
      .single();

    if (fetchError || !row) {
      return NextResponse.json({ error: 'Video ad not found.' }, { status: 404 });
    }
    if (row.shop_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }
    if (!row.hero_image_url) {
      return NextResponse.json({ error: 'No hero image to animate.' }, { status: 400 });
    }
    const sb = row.storyboard as Storyboard | null;
    if (!sb?.hook || !sb?.value_prop || !sb?.cta) {
      return NextResponse.json({ error: 'Storyboard copy missing — regenerate the scene.' }, { status: 400 });
    }

    // ── Mark animating ────────────────────────────────────────────────────
    await admin
      .from('video_ads')
      .update({ status: 'pending', pipeline_stage: 'animating' })
      .eq('id', id);

    // ── Stage 1: Kling 1.6 Pro image-to-video ─────────────────────────────
    console.log('[animate-still] Stage 1: Kling 1.6 Pro');
    const klingResult = await fal.subscribe('fal-ai/kling-video/v1.6/pro/image-to-video', {
      input: {
        image_url: row.hero_image_url,
        prompt: row.motion_prompt || 'subtle cinematic camera motion, slow dolly-in, shallow depth of field',
        duration: '5',
        aspect_ratio: '9:16',
      },
      logs: false,
    });

    const klingVideoUrl = extractFalVideoUrl(klingResult);
    if (!klingVideoUrl) {
      logFalFailure('Kling 1.6 Pro', klingResult);
      throw new Error('Image-to-video failed: no video URL in Kling response.');
    }
    console.log('[animate-still] Kling video URL:', klingVideoUrl);

    // ── Stage 2: Creatomate caption overlay ───────────────────────────────
    const baseUrl = process.env.PUBLIC_APP_URL ?? `https://${req.headers.get('host')}`;
    const source = buildCreatomateSource(klingVideoUrl, sb);

    console.log('[animate-still] Stage 2: Creatomate render kickoff');
    const renderRes = await fetch('https://api.creatomate.com/v1/renders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + process.env.CREATOMATE_API_KEY,
      },
      body: JSON.stringify({
        webhook_url: `${baseUrl}/api/webhooks/video?videoId=${id}`,
        source,
      }),
    });

    if (!renderRes.ok) {
      const errorBody = await renderRes.text();
      console.error(`[animate-still] Creatomate ${renderRes.status}:`, errorBody);
      throw new Error(`Creatomate rejected the render (status ${renderRes.status}).`);
    }

    const renderPayload = await renderRes.json();
    const renderId = Array.isArray(renderPayload) ? renderPayload[0]?.id : renderPayload?.id;
    if (!renderId) {
      console.error('[animate-still] Creatomate returned no render id:', renderPayload);
      throw new Error('Creatomate did not return a render id.');
    }
    console.log('[animate-still] Creatomate render queued:', renderId);

    // Single roundtrip: persist the render id and flip the stage together
    // (previously two sequential DB writes on the hot path).
    await admin
      .from('video_ads')
      .update({ creatomate_render_id: renderId, pipeline_stage: 'finalizing' })
      .eq('id', id);

    // ── Poll Creatomate synchronously until done ──────────────────────────
    const POLL_INTERVAL_MS = 2000;
    const MAX_POLLS = 60; // ~120s of polling — total route stays under maxDuration
    let finalVideoUrl: string | null = null;

    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const statusRes = await fetch(`https://api.creatomate.com/v1/renders/${renderId}`, {
        headers: { Authorization: 'Bearer ' + process.env.CREATOMATE_API_KEY },
      });
      if (!statusRes.ok) continue;

      const render = await statusRes.json();
      if (render.status === 'succeeded') {
        finalVideoUrl = render.url;
        break;
      }
      if (render.status === 'failed') {
        console.error('[animate-still] Creatomate render failed:', render);
        throw new Error('Final caption overlay failed.');
      }
      // planned / waiting / rendering — keep polling
    }

    if (!finalVideoUrl) {
      // Took too long — return 202 so the webhook + render-status path can finish it.
      // The payload must mirror the row's actual DB state (status stays 'pending',
      // stage 'finalizing'): the client merges this response into its videoAd, and
      // its fallback polling only runs while status === 'pending'.
      console.log('[animate-still] Creatomate still rendering after max polls, falling back to webhook');
      return NextResponse.json(
        { id, creatomate_render_id: renderId, status: 'pending', pipeline_stage: 'finalizing' },
        { status: 202 }
      );
    }

    // ── Persist final video ───────────────────────────────────────────────
    const { data: updated, error: updateError } = await admin
      .from('video_ads')
      .update({
        video_url: finalVideoUrl,
        status: 'completed',
        pipeline_stage: 'completed',
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError || !updated) {
      console.error('[animate-still] Final update failed:', updateError);
      return NextResponse.json({ error: 'Failed to save final video.' }, { status: 500 });
    }

    return NextResponse.json(updated, { status: 200 });

  } catch (error: any) {
    console.error('[animate-still] fatal error:', error);
    if (admin && videoAdId) {
      await admin
        .from('video_ads')
        .update({ status: 'failed', pipeline_stage: 'failed' })
        .eq('id', videoAdId);
    }
    return NextResponse.json(
      { error: error?.message || 'Failed to animate the scene. Please try again.' },
      { status: 500 }
    );
  }
}
