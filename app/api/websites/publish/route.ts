import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { repairShopSlug, slugify } from '@/lib/slugify';
import { canUseStudio } from '@/lib/tiers';

// Toggles the shop's generated website between draft and published.
// Tier gate: lib/tiers canUseStudio — Pro+ (Studio moved down to Pro,
// founder matrix 2026-08-29; legacy 'advanced' payers keep access).

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
    if (!canUseStudio(shop.subscription_tier)) {
      return NextResponse.json(
        { error: 'The AI Website Studio is a Pro-tier feature. Upgrade to unlock it.' },
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

    // ── Cache bust: a publish/unpublish must be visible on the live /site
    // route immediately. Path revalidation covers the concrete URL (query
    // strings share the same path entry); '/site/[slug]' clears the dynamic
    // segment's route cache. The omnichannel router's nested pages
    // (collections, product detail) share the same visibility gate, so they
    // bust together.
    revalidatePath(`/site/${canonicalSlug}`);
    revalidatePath(`/site/${canonicalSlug}/collections`);
    if (shop.shop_slug && shop.shop_slug !== canonicalSlug) {
      // Slug was write-repaired mid-request: bust the pre-repair paths too,
      // encoded exactly as a legacy raw slug appears in a shared URL.
      revalidatePath(`/site/${encodeURIComponent(shop.shop_slug)}`);
      revalidatePath(`/site/${encodeURIComponent(shop.shop_slug)}/collections`);
    }
    revalidatePath('/site/[slug]', 'page');
    revalidatePath('/site/[slug]/collections', 'page');
    // Per-product pages cannot be enumerated here — the page-level call
    // clears the whole dynamic PDP segment.
    revalidatePath('/site/[slug]/products/[id]', 'page');
    // LIVE tag: the /site Data Cache (app/site/[slug]/siteData.ts) keys its
    // website-row/products entries on exactly this tag — the publish state
    // flip lands on the very next request. Next 16 signature: the 'max'
    // profile expires the tag immediately.
    revalidateTag(`site:${shop.id}`, 'max');
    // The slug→shop lookup caches under the NORMALIZED slug (shop id is the
    // lookup's result, so it can't carry the per-shop tag) — bust the
    // canonical entry and, after a mid-request repair, the pre-repair one.
    revalidateTag(`site:slug:${canonicalSlug}`, 'max');
    const preRepairSlug = slugify(shop.shop_slug);
    if (preRepairSlug && preRepairSlug !== canonicalSlug) {
      revalidateTag(`site:slug:${preRepairSlug}`, 'max');
    }

    // Full row (dashboard contract) + the canonical slug for link minting.
    return NextResponse.json({ ...updated, shop_slug: canonicalSlug });
  } catch (error) {
    console.error('[websites/publish] fatal:', error);
    return NextResponse.json({ error: 'Failed to update publish state.' }, { status: 500 });
  }
}
