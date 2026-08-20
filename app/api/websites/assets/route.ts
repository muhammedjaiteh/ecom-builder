import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { repairShopSlug } from '@/lib/slugify';
import {
  generateHeroAsset,
  generateLogoAsset,
  pickHeroSourceImage,
  type AssetProductSource,
} from '@/lib/siteAssets';
import { WebsiteConfigSchema, type SiteAssets, type WebsiteConfig } from '@/lib/siteTemplates';

// ─────────────────────────────────────────────────────────────────────────────
// On-demand website asset generation — POST { kind: 'hero' | 'logo' }.
// The Site Editor's "Generate with AI" slots fire this: SAME engine as the
// onboarding phase (lib/siteAssets — IC-Light hero reuse, SDK logo), but
// failures here are HONEST errors rather than silent skips: a seller who
// pressed the button deserves to know why nothing appeared.
//
// Owner-authed + tier-gated exactly like the content/publish routes; writes
// patch ONLY config.assets via service role — generated_at is untouched, so
// the mounted editor never loses unsaved copy edits over a remount.
// ─────────────────────────────────────────────────────────────────────────────

export const maxDuration = 120;

const WEBSITE_TIERS = ['advanced', 'flagship'];

type OwnerGate =
  | { ok: true; shop: { id: string; shop_name: string | null; shop_slug: string | null } }
  | { ok: false; response: NextResponse };

// Exact auth + tier pattern from app/api/websites/content/route.ts.
async function requireOwner(): Promise<OwnerGate> {
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
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) };
  }

  const { data: shop } = await supabase
    .from('shops')
    .select('id, shop_name, shop_slug, subscription_tier')
    .eq('id', user.id)
    .single();

  if (!shop) {
    return { ok: false, response: NextResponse.json({ error: 'Shop profile not found.' }, { status: 404 }) };
  }

  const tier = (shop.subscription_tier ?? '').toLowerCase().trim();
  if (!WEBSITE_TIERS.includes(tier)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'AI asset generation is an Advanced-tier feature.' },
        { status: 403 }
      ),
    };
  }

  return { ok: true, shop: { id: shop.id, shop_name: shop.shop_name, shop_slug: shop.shop_slug } };
}

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  try {
    const gate = await requireOwner();
    if (!gate.ok) return gate.response;
    const shop = gate.shop;

    const body = await req.json().catch(() => null);
    const kind: unknown = body?.kind;
    if (kind !== 'hero' && kind !== 'logo') {
      return NextResponse.json({ error: "kind must be 'hero' or 'logo'." }, { status: 400 });
    }

    if (!process.env.FAL_API_KEY && kind === 'hero') {
      return NextResponse.json({ error: 'Image engine not configured.' }, { status: 500 });
    }

    const admin = getAdmin();

    const { data: existing, error: readError } = await admin
      .from('shop_websites')
      .select('config')
      .eq('shop_id', shop.id)
      .maybeSingle();
    if (readError) {
      console.error('[websites/assets] read failed:', readError);
      return NextResponse.json({ error: 'Failed to load your website.' }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json(
        { error: 'No generated website found. Generate one first.' },
        { status: 404 }
      );
    }

    const parsedConfig = WebsiteConfigSchema.safeParse(existing.config);
    if (!parsedConfig.success) {
      console.error(`[websites/assets] stored config invalid for shop ${shop.id}:`, parsedConfig.error.issues);
      return NextResponse.json(
        { error: 'Your stored website configuration is invalid. Regenerate the site first.' },
        { status: 409 }
      );
    }
    const config: WebsiteConfig = parsedConfig.data;

    let generatedUrl: string;
    if (kind === 'hero') {
      // Law 4: only the seller's REAL product photo enters the pipeline.
      // Same dual-ownership match as every /site inventory read.
      const { data: products } = await admin
        .from('products')
        .select('id, name, image_url')
        .or(`shop_id.eq.${shop.id},user_id.eq.${shop.id}`)
        .order('created_at', { ascending: false })
        .limit(15);
      const source = pickHeroSourceImage((products ?? []) as AssetProductSource[]);
      if (!source) {
        return NextResponse.json(
          { error: 'Add a product with a photo first — the hero shot is composed from your real product image.' },
          { status: 400 }
        );
      }
      generatedUrl = await generateHeroAsset({ admin, shopId: shop.id, config, sourceImageUrl: source });
    } else {
      generatedUrl = await generateLogoAsset({
        admin,
        shopId: shop.id,
        shopName: shop.shop_name,
        config,
      });
    }

    // Merge-patch ONLY the touched slot; the other slot survives untouched.
    const assets: SiteAssets = {
      ...(config.assets ?? {}),
      [kind === 'hero' ? 'hero_image_url' : 'logo_url']: generatedUrl,
      generated_at: new Date().toISOString(),
    };

    const { data: updated, error: updateError } = await admin
      .from('shop_websites')
      .update({ config: { ...config, assets } })
      .eq('shop_id', shop.id)
      .select()
      .single();
    if (updateError || !updated) {
      console.error('[websites/assets] update failed:', updateError);
      return NextResponse.json({ error: 'The asset was generated but could not be saved. Please retry.' }, { status: 500 });
    }

    // Law 2 slug safety + the exact cache-bust block the content route runs —
    // the live site must serve the new asset on the very next request.
    const canonicalSlug = await repairShopSlug(admin, shop);
    revalidatePath(`/site/${canonicalSlug}`);
    revalidatePath(`/site/${canonicalSlug}/collections`);
    if (shop.shop_slug && shop.shop_slug !== canonicalSlug) {
      revalidatePath(`/site/${encodeURIComponent(shop.shop_slug)}`);
      revalidatePath(`/site/${encodeURIComponent(shop.shop_slug)}/collections`);
    }
    revalidatePath('/site/[slug]', 'page');
    revalidatePath('/site/[slug]/collections', 'page');
    revalidatePath('/site/[slug]/products/[id]', 'page');
    revalidateTag(`site:${shop.id}`, 'max');

    console.log(`[websites/assets] Shop ${shop.id} regenerated ${kind}: ${generatedUrl}`);
    return NextResponse.json({ ...updated, shop_slug: canonicalSlug });
  } catch (error) {
    console.error('[websites/assets] fatal:', error);
    const err = error as { status?: number; message?: string } | null;
    const msg = (err?.message ?? '').toLowerCase();
    const isBusy =
      err?.status === 429 || err?.status === 503 ||
      msg.includes('429') || msg.includes('503') ||
      msg.includes('overloaded') || msg.includes('unavailable') ||
      msg.includes('rate limit') || msg.includes('quota');
    if (isBusy) {
      return NextResponse.json(
        { error: 'The AI studio is currently busy. Please try again in a moment.' },
        { status: 429 }
      );
    }
    if (msg.includes('content filter') || msg.includes('moderation') || msg.includes('safety')) {
      return NextResponse.json(
        { error: 'The provider declined this generation. Try again — or upload your own image for this slot.' },
        { status: 422 }
      );
    }
    if (msg.includes('timeout') || msg.includes('aborted')) {
      return NextResponse.json(
        { error: 'Generation took too long and was stopped. Please try again.' },
        { status: 504 }
      );
    }
    return NextResponse.json({ error: 'Failed to generate the asset. Please try again.' }, { status: 500 });
  }
}
