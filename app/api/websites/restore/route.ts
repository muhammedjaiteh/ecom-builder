import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { repairShopSlug, slugify } from '@/lib/slugify';
import { canUseStudio } from '@/lib/tiers';
import {
  WebsiteConfigSchema,
  buildPreviousDesign,
  type WebsiteConfig,
} from '@/lib/siteTemplates';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/websites/restore — the snapshot ritual's RESTORE step (Item 5).
//
// Swaps config ↔ config.previous ATOMICALLY in one jsonb update:
//   1. The stored snapshot is re-validated STRICTLY (full WebsiteConfigSchema)
//      before it ever becomes the current config — the lax storage schema can
//      never leak an invalid config into service.
//   2. The OUTGOING current config is written into the restored config's
//      `previous` (one generation deep, non-recursive), so restore is itself
//      reversible: tapping Restore twice round-trips exactly.
//   3. generated_at is bumped: an open cockpit editor remounts onto the
//      restored config (keyed on generated_at), and offline-outbox entries
//      pinned to the pre-restore build are dropped honestly instead of
//      flushing stale blocks over the restored design.
//
// Same cookie-auth + tier-gate + service-role pattern as the content route,
// and the exact same revalidation block — the restored design must serve on
// the very next /site request.
// ─────────────────────────────────────────────────────────────────────────────

// Tier gate: lib/tiers canUseStudio — Pro+ (Studio moved down to Pro,
// founder matrix 2026-08-29; legacy 'advanced' payers keep access).

type OwnerGate =
  | { ok: true; shop: { id: string; shop_name: string | null; shop_slug: string | null } }
  | { ok: false; response: NextResponse };

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

  if (!canUseStudio(shop.subscription_tier)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'The AI Website Studio is a Pro-tier feature.' },
        { status: 403 }
      ),
    };
  }

  return { ok: true, shop: { id: shop.id, shop_name: shop.shop_name, shop_slug: shop.shop_slug } };
}

export async function POST() {
  try {
    const gate = await requireOwner();
    if (!gate.ok) return gate.response;
    const shop = gate.shop;

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Law 2 slug safety: same write-repair as the content route, so the
    // revalidated paths below are the paths the live site actually serves.
    const canonicalSlug = await repairShopSlug(admin, shop);

    const { data: existing, error: readError } = await admin
      .from('shop_websites')
      .select('config')
      .eq('shop_id', shop.id)
      .maybeSingle();

    if (readError) {
      console.error('[websites/restore] read failed:', readError);
      return NextResponse.json({ error: 'Failed to load your website.' }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'No generated website found.' }, { status: 404 });
    }

    const parsedConfig = WebsiteConfigSchema.safeParse(existing.config);
    if (!parsedConfig.success) {
      console.error(`[websites/restore] stored config invalid for shop ${shop.id}:`, parsedConfig.error.issues);
      return NextResponse.json(
        { error: 'Your stored website configuration is invalid. Regenerate the site first.' },
        { status: 409 }
      );
    }

    const rawPrevious = parsedConfig.data.previous;
    if (!rawPrevious) {
      return NextResponse.json({ error: 'No previous design is stored for this site.' }, { status: 404 });
    }

    // Strict gate: the snapshot must parse as a FULL valid config before it
    // becomes current. Its own nested `previous` (never written by our
    // writers — non-recursive law) is dropped defensively before validation.
    const candidate = { ...(rawPrevious as Record<string, unknown>) };
    delete candidate.previous;
    const restoredParse = WebsiteConfigSchema.safeParse(candidate);
    if (!restoredParse.success) {
      console.error(`[websites/restore] snapshot invalid for shop ${shop.id}:`, restoredParse.error.issues);
      return NextResponse.json(
        { error: 'The stored backup is no longer compatible with the current site format.' },
        { status: 409 }
      );
    }

    // Reversible swap: the outgoing config becomes the restored config's
    // previous (one generation deep — buildPreviousDesign never copies a
    // nested previous), so Restore ↔ Restore round-trips exactly.
    const outgoing = buildPreviousDesign(parsedConfig.data);
    const restored: WebsiteConfig = {
      ...restoredParse.data,
      ...(outgoing ? { previous: outgoing } : {}),
    };

    const { data: updated, error: updateError } = await admin
      .from('shop_websites')
      .update({
        config: restored,
        template_key: restored.template_key,
        niche_reasoning: restored.niche_reasoning,
        // Bump: remounts an open editor onto the restored config and drops
        // outbox entries pinned to the pre-restore build (see header).
        generated_at: new Date().toISOString(),
      })
      .eq('shop_id', shop.id)
      .select()
      .single();

    if (updateError || !updated) {
      console.error('[websites/restore] update failed:', updateError);
      return NextResponse.json({ error: 'Failed to restore your previous design.' }, { status: 500 });
    }

    console.log(`[websites/restore] Shop ${shop.id} restored previous design (template=${restored.template_key})`);

    // ── Cache bust: identical block to the content route — the restored
    // design must be visible on the live /site route immediately.
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
    revalidateTag(`site:slug:${canonicalSlug}`, 'max');
    const preRepairSlug = slugify(shop.shop_slug);
    if (preRepairSlug && preRepairSlug !== canonicalSlug) {
      revalidateTag(`site:slug:${preRepairSlug}`, 'max');
    }

    // Full row (dashboard contract) + the canonical slug for link minting.
    return NextResponse.json({ ...updated, shop_slug: canonicalSlug });
  } catch (error) {
    console.error('[websites/restore] POST fatal:', error);
    return NextResponse.json({ error: 'Failed to restore your previous design.' }, { status: 500 });
  }
}
