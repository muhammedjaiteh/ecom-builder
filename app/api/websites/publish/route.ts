import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { repairShopSlug } from '@/lib/slugify';

// Toggles the shop's generated website between draft and published.
const WEBSITE_TIERS = ['advanced', 'flagship'];

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
    const action: string | undefined = body?.action;
    if (action !== 'publish' && action !== 'unpublish') {
      return NextResponse.json({ error: 'action must be "publish" or "unpublish".' }, { status: 400 });
    }

    const { data: shop } = await supabase
      .from('shops')
      .select('id, shop_name, shop_slug, subscription_tier')
      .eq('id', user.id)
      .single();

    if (!shop) {
      return NextResponse.json({ error: 'Shop profile not found.' }, { status: 404 });
    }
    const tier = (shop.subscription_tier ?? '').toLowerCase().trim();
    if (!WEBSITE_TIERS.includes(tier)) {
      return NextResponse.json(
        { error: 'The AI Website Generator is an Advanced-tier feature.' },
        { status: 403 }
      );
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Law 2 slug safety: publishing must never advertise an unroutable /site
    // link — write-repair legacy slugs (spaces/uppercase) to canonical form.
    const canonicalSlug = await repairShopSlug(admin, shop);

    const { data: updated, error: updateError } = await admin
      .from('shop_websites')
      .update({
        status: action === 'publish' ? 'published' : 'draft',
        published_at: action === 'publish' ? new Date().toISOString() : null,
      })
      .eq('shop_id', shop.id)
      .select()
      .single();

    if (updateError || !updated) {
      console.error('[websites/publish] update failed:', updateError);
      return NextResponse.json(
        { error: 'No generated website found. Generate one first.' },
        { status: 404 }
      );
    }

    console.log(`[websites/publish] Shop ${shop.id} → ${updated.status}`);
    // Full row (dashboard contract) + the canonical slug for link minting.
    return NextResponse.json({ ...updated, shop_slug: canonicalSlug });
  } catch (error: any) {
    console.error('[websites/publish] fatal:', error);
    return NextResponse.json({ error: 'Failed to update publish state.' }, { status: 500 });
  }
}
