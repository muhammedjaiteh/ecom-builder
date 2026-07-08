import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  const videoId = req.nextUrl.searchParams.get('videoId');
  if (!videoId) {
    return NextResponse.json({ error: 'videoId is required' }, { status: 400 });
  }

  // ── Auth: only the owning seller may poll a generation's status ──────────
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Read the row (admin client — RLS may block anon reads), then enforce
  // ownership BEFORE any status disclosure, Creatomate call, or DB write.
  const { data: row, error: dbError } = await admin
    .from('video_ads')
    .select('status, creatomate_render_id, shop_id')
    .eq('id', videoId)
    .single();

  if (dbError || !row) {
    return NextResponse.json({ error: 'Video record not found' }, { status: 404 });
  }
  if (row.shop_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  // Already resolved (e.g. webhook arrived in production) — return immediately.
  if (row.status === 'completed' || row.status === 'failed') {
    return NextResponse.json({ status: row.status });
  }

  // Render ID not stored yet (director route hasn't finished) — still pending.
  if (!row.creatomate_render_id) {
    return NextResponse.json({ status: 'pending' });
  }

  if (!process.env.CREATOMATE_API_KEY) {
    return NextResponse.json({ status: 'pending' });
  }

  // Ask Creatomate directly — no webhook required.
  const creatomateRes = await fetch(
    `https://api.creatomate.com/v1/renders/${row.creatomate_render_id}`,
    {
      headers: { Authorization: 'Bearer ' + process.env.CREATOMATE_API_KEY },
    }
  );

  if (!creatomateRes.ok) {
    console.error(`[render-status] Creatomate error ${creatomateRes.status} for render ${row.creatomate_render_id}`);
    return NextResponse.json({ status: 'pending' });
  }

  const render = await creatomateRes.json();
  const creatomateStatus: string = render.status;

  if (creatomateStatus === 'succeeded') {
    await admin
      .from('video_ads')
      .update({ status: 'completed', pipeline_stage: 'completed', video_url: render.url })
      .eq('id', videoId);
    return NextResponse.json({ status: 'completed', video_url: render.url as string });
  }

  if (creatomateStatus === 'failed') {
    await admin
      .from('video_ads')
      .update({ status: 'failed', pipeline_stage: 'failed' })
      .eq('id', videoId);
    return NextResponse.json({ status: 'failed' });
  }

  // planned / waiting / rendering — still in progress
  return NextResponse.json({ status: 'pending' });
}
