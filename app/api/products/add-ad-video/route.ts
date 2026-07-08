import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Promotes a completed video_ad's assets to the public product page by writing
// `ad_video_url` + `ad_hero_image_url` directly to the products row. Ownership
// is enforced at every hop (video_ad must belong to caller; product must belong
// to caller; video_ad must reference the requested product).
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
    const { videoAdId, productId } = body as { videoAdId?: string; productId?: string };

    if (!videoAdId || !productId) {
      return NextResponse.json({ error: 'videoAdId and productId are required.' }, { status: 400 });
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // ── Load + authorize the video_ad ──────────────────────────────────────
    const { data: videoAd, error: videoAdError } = await admin
      .from('video_ads')
      .select('id, shop_id, product_id, status, hero_image_url, video_url')
      .eq('id', videoAdId)
      .single();

    if (videoAdError || !videoAd) {
      return NextResponse.json({ error: 'Video ad not found.' }, { status: 404 });
    }
    if (videoAd.shop_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }
    if (videoAd.product_id !== productId) {
      return NextResponse.json(
        { error: 'Video ad does not match the requested product.' },
        { status: 400 }
      );
    }
    if (videoAd.status !== 'completed' || !videoAd.hero_image_url || !videoAd.video_url) {
      return NextResponse.json(
        { error: 'Video ad is not ready — both the hero still and the final video must be present.' },
        { status: 400 }
      );
    }

    // ── Authorize the product ──────────────────────────────────────────────
    const { data: product, error: productError } = await admin
      .from('products')
      .select('id, user_id')
      .eq('id', productId)
      .single();

    if (productError || !product || product.user_id !== user.id) {
      return NextResponse.json({ error: 'Product not found or not yours.' }, { status: 404 });
    }

    // ── Write the ad URLs onto the product row ─────────────────────────────
    const { data: updated, error: updateError } = await admin
      .from('products')
      .update({
        ad_video_url: videoAd.video_url,
        ad_hero_image_url: videoAd.hero_image_url,
      })
      .eq('id', productId)
      .select('id, ad_video_url, ad_hero_image_url')
      .single();

    if (updateError || !updated) {
      console.error('[add-ad-video] DB update failed:', updateError);
      return NextResponse.json({ error: 'Failed to link assets to product.' }, { status: 500 });
    }

    console.log(
      `[add-ad-video] Linked video_ad ${videoAdId} → product ${productId} ` +
      `(video_url=${updated.ad_video_url?.slice(0, 60)}…, hero_image_url=${updated.ad_hero_image_url?.slice(0, 60)}…)`
    );

    return NextResponse.json({ ok: true, product: updated, videoAdId });
  } catch (error: any) {
    console.error('[add-ad-video] fatal:', error);
    return NextResponse.json({ error: 'Failed to link video.' }, { status: 500 });
  }
}
