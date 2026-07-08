import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { generateWithFallback } from '@/lib/llm';
import { CopySchema, buildCopyOnlyPrompt } from '@/lib/adCopy';

// Regenerates ONLY the ad copy (hook/value_prop/cta) for a preview_ready
// generation. LLM-only — no Fal charge, so sellers can iterate on the words
// without paying for a new scene.
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
      .select('id, shop_id, product_id, status')
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
        { error: 'Copy can only be regenerated while the scene is in review.' },
        { status: 400 }
      );
    }

    const { data: product } = await admin
      .from('products')
      .select('name, description')
      .eq('id', videoAd.product_id)
      .single();

    if (!product) {
      return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    }

    const { data: copy, provider } = await generateWithFallback({
      schema: CopySchema,
      prompt: buildCopyOnlyPrompt(product),
      callerName: 'regenerate-copy',
    });
    console.log(`[regenerate-copy] New copy by ${provider} for ${videoAdId}:`, copy);

    const { data: updated, error: updateError } = await admin
      .from('video_ads')
      .update({ storyboard: copy })
      .eq('id', videoAdId)
      .select()
      .single();

    if (updateError || !updated) {
      console.error('[regenerate-copy] DB update failed:', updateError);
      return NextResponse.json({ error: 'Failed to save new copy.' }, { status: 500 });
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('[regenerate-copy] fatal:', error);
    const msg: string = error?.message || '';
    const isBusy =
      error?.status === 429 || error?.status === 503 ||
      msg.includes('429') || msg.includes('503') ||
      msg.toLowerCase().includes('overloaded') || msg.toLowerCase().includes('unavailable');
    if (isBusy) {
      return NextResponse.json(
        { error: 'The AI assistant is currently busy. Please try again in a moment.' },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: 'Failed to regenerate copy.' }, { status: 500 });
  }
}
