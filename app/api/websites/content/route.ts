import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { repairShopSlug } from '@/lib/slugify';
import {
  SiteBlockSchema,
  WebsiteConfigSchema,
  blocksToLegacySite,
  type WebsiteConfig,
} from '@/lib/siteTemplates';

// ─────────────────────────────────────────────────────────────────────────────
// Owner content API for shop_websites — the ONLY channel dashboards read or
// write the website row through. shop_websites has no versioned select
// policies, so browser-client reads return zero rows silently (the RLS trap
// behind the 307 saga); this route follows the publish route's exact
// cookie-auth + tier-gate + service-role pattern instead.
//
//   GET  → the owner's full row (or website: null when none exists yet).
//          Shared by the Site Editor, the AI Website Studio's initial load,
//          and the Online Store Pages/Navigation dashboards.
//   PUT  → { blocks }: validates the block array, recomputes the legacy
//          site.* mirror via blocksToLegacySite (seo.* preserved — fixed
//          field), writes config in ONE jsonb update, then runs the exact
//          revalidation block the publish route uses. Returns the updated row.
// ─────────────────────────────────────────────────────────────────────────────

const WEBSITE_TIERS = ['advanced', 'flagship'];

// v1 editor always sends the full block array. Unique ids protect the
// editor's node targeting and any future reorder tooling; the length ceiling
// bounds a hand-crafted payload.
const BlocksPayloadSchema = z.object({
  blocks: z.array(SiteBlockSchema).min(1).max(12).refine(
    (blocks) => new Set(blocks.map((b) => b.id)).size === blocks.length,
    { message: 'Block ids must be unique.' }
  ),
});

type OwnerGate =
  | { ok: true; shop: { id: string; shop_name: string | null; shop_slug: string | null } }
  | { ok: false; response: NextResponse };

// Exact auth + tier pattern from app/api/websites/publish/route.ts: verified
// cookie session → shops row keyed on the user id → tier gate.
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
        { error: 'The AI Website Generator is an Advanced-tier feature.' },
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

export async function GET() {
  try {
    const gate = await requireOwner();
    if (!gate.ok) return gate.response;

    const { data: website, error } = await getAdmin()
      .from('shop_websites')
      .select('*')
      .eq('shop_id', gate.shop.id)
      .maybeSingle();

    if (error) {
      console.error('[websites/content] read failed:', error);
      return NextResponse.json({ error: 'Failed to load your website.' }, { status: 500 });
    }

    // website: null is a valid state (nothing generated yet) — dashboards
    // render their empty states from it, never from a silent RLS zero-row.
    return NextResponse.json({ website: website ?? null });
  } catch (error) {
    console.error('[websites/content] GET fatal:', error);
    return NextResponse.json({ error: 'Failed to load your website.' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const gate = await requireOwner();
    if (!gate.ok) return gate.response;
    const shop = gate.shop;

    const body = await req.json().catch(() => null);
    const parsedPayload = BlocksPayloadSchema.safeParse(body);
    if (!parsedPayload.success) {
      const first = parsedPayload.error.issues[0];
      return NextResponse.json(
        { error: `Invalid content: ${first?.message ?? 'blocks failed validation.'}` },
        { status: 400 }
      );
    }
    const { blocks } = parsedPayload.data;

    const admin = getAdmin();

    // Law 2 slug safety: same write-repair the publish route runs, so the
    // revalidated paths below are the paths the live site actually serves.
    const canonicalSlug = await repairShopSlug(admin, shop);

    const { data: existing, error: readError } = await admin
      .from('shop_websites')
      .select('config')
      .eq('shop_id', shop.id)
      .maybeSingle();

    if (readError) {
      console.error('[websites/content] pre-update read failed:', readError);
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
      console.error(`[websites/content] stored config invalid for shop ${shop.id}:`, parsedConfig.error.issues);
      return NextResponse.json(
        { error: 'Your stored website configuration is invalid. Regenerate the site first.' },
        { status: 409 }
      );
    }

    // Both representations updated in ONE jsonb write: blocks are the source
    // of truth, site.* is the mirror (seo.* preserved by the adapter).
    const config: WebsiteConfig = {
      ...parsedConfig.data,
      site: blocksToLegacySite(blocks, parsedConfig.data.site),
      blocks,
    };

    const { data: updated, error: updateError } = await admin
      .from('shop_websites')
      .update({ config })
      .eq('shop_id', shop.id)
      .select()
      .single();

    if (updateError || !updated) {
      console.error('[websites/content] update failed:', updateError);
      return NextResponse.json({ error: 'Failed to save your changes.' }, { status: 500 });
    }

    console.log(`[websites/content] Shop ${shop.id} saved ${blocks.length} blocks`);

    // ── Cache bust: identical block to app/api/websites/publish/route.ts —
    // the edited copy must be visible on the live /site route immediately.
    // Path revalidation covers the concrete URL (query strings share the same
    // path entry); '/site/[slug]' clears the dynamic segment's route cache,
    // since the site page reads via supabase-js rather than tagged fetch. The
    // per-shop tag is inert today for the same reason — kept for when those
    // reads gain fetch tags. The omnichannel router's nested pages
    // (collections, product detail) share the same config, so they bust
    // together.
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
    // Next 16 signature: the 'max' profile expires the tag immediately —
    // equivalent to the legacy single-argument revalidateTag behavior.
    revalidateTag(`site:${shop.id}`, 'max');

    // Full row (dashboard contract) + the canonical slug for link minting.
    return NextResponse.json({ ...updated, shop_slug: canonicalSlug });
  } catch (error) {
    console.error('[websites/content] PUT fatal:', error);
    return NextResponse.json({ error: 'Failed to save your changes.' }, { status: 500 });
  }
}
