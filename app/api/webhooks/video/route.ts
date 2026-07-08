import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const payload = Array.isArray(body) ? body[0] : body;

    const videoId = req.nextUrl.searchParams.get('videoId');
    console.log(
      `[webhook/video] received videoId=${videoId} status=${payload?.status}`
    );

    if (!videoId) {
      return NextResponse.json({ error: 'videoId is required.' }, { status: 400 });
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (payload?.status === 'succeeded') {
      const { error } = await admin
        .from('video_ads')
        .update({ status: 'completed', pipeline_stage: 'completed', video_url: payload.url })
        .eq('id', videoId);

      if (error) {
        console.error('[webhook/video] DB update failed:', error);
        return NextResponse.json({ error: 'Failed to update video record.' }, { status: 500 });
      }

      return NextResponse.json({ ok: true });
    }

    if (payload?.status === 'failed') {
      const errorMessage =
        payload.error_message ??
        (Array.isArray(payload.errors) ? payload.errors.join('; ') : null);
      console.error(
        `[webhook/video] render failed for videoId=${videoId}:`,
        errorMessage ?? payload
      );

      const { error } = await admin
        .from('video_ads')
        .update({ status: 'failed', pipeline_stage: 'failed' })
        .eq('id', videoId);

      if (error) {
        console.error('[webhook/video] DB update failed:', error);
        return NextResponse.json({ error: 'Failed to update video record.' }, { status: 500 });
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true, skipped: true });
  } catch (error: any) {
    console.error('[webhook/video] fatal error:', error);
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
