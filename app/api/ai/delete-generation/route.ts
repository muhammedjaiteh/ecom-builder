import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Deletes one generation from the seller's Ad Studio gallery.
export async function POST(req: Request) {
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

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: videoAd } = await admin
      .from('video_ads')
      .select('id, shop_id')
      .eq('id', videoAdId)
      .single();

    if (!videoAd) {
      return NextResponse.json({ error: 'Generation not found.' }, { status: 404 });
    }
    if (videoAd.shop_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const { error: deleteError } = await admin
      .from('video_ads')
      .delete()
      .eq('id', videoAdId);

    if (deleteError) {
      console.error('[delete-generation] delete failed:', deleteError);
      return NextResponse.json({ error: 'Failed to delete generation.' }, { status: 500 });
    }

    console.log(`[delete-generation] Deleted ${videoAdId} for shop ${user.id}`);
    return NextResponse.json({ ok: true, deletedId: videoAdId });
  } catch (error: any) {
    console.error('[delete-generation] fatal:', error);
    return NextResponse.json({ error: 'Failed to delete generation.' }, { status: 500 });
  }
}
