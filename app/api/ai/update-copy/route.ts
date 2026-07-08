import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { CopySchema } from '@/lib/adCopy';

// Lets the seller hand-edit hook/value_prop/cta on a preview_ready generation
// before committing to the (paid) animate step. animate-still reads the
// storyboard from the DB, so edits flow through automatically.
export async function PATCH(req: Request) {
  try {
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

    const body = await req.json();
    const videoAdId: string | undefined = body?.videoAdId;
    if (!videoAdId) {
      return NextResponse.json({ error: 'videoAdId is required.' }, { status: 400 });
    }

    const parsed = CopySchema.safeParse({
      hook: body?.hook,
      value_prop: body?.value_prop,
      cta: body?.cta,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'hook, value_prop and cta are required (1-60 characters each).' },
        { status: 400 }
      );
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: videoAd } = await admin
      .from('video_ads')
      .select('id, shop_id, status')
      .eq('id', videoAdId)
      .single();

    if (!videoAd) {
      return NextResponse.json({ error: 'Video ad not found.' }, { status: 404 });
    }
    if (videoAd.shop_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }
    if (videoAd.status !== 'preview_ready') {
      return NextResponse.json(
        { error: 'Copy can only be edited while the scene is in review.' },
        { status: 400 }
      );
    }

    const { data: updated, error: updateError } = await admin
      .from('video_ads')
      .update({ storyboard: parsed.data })
      .eq('id', videoAdId)
      .select()
      .single();

    if (updateError || !updated) {
      console.error('[update-copy] DB update failed:', updateError);
      return NextResponse.json({ error: 'Failed to save copy.' }, { status: 500 });
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('[update-copy] fatal:', error);
    return NextResponse.json({ error: 'Failed to update copy.' }, { status: 500 });
  }
}
