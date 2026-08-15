import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { slugify, slugifyWithFallback } from '@/lib/slugify';

// ─────────────────────────────────────────────────────────────────────────────
// HEAL API — the app-side safety net under the DB signup trigger.
//
// The AFTER INSERT ON auth.users trigger (sql/provisioning.sql) mints the
// shops row for every new account, but by design it degrades silently rather
// than block a signup. This endpoint repairs any resulting orphan: an
// authenticated user whose shops row (shops.id = auth.users.id) is missing.
// The dashboard vault door fires it non-blockingly when its shops fetch
// returns NULL.
//
// Contract (never throws uncaught — always classified JSON):
//   row exists   → 200 { healed: false, present: true }
//   row minted   → 200 { healed: true,  present: true, shop_slug }
//   not signed in→ 401 { error, code: 'unauthorized' }
//   db failures  → 500 { error, code: 'read_failed' | 'insert_failed' }
//
// Provisioning parity: shop_name/phone_number/subscription_tier/requested_plan
// are extracted from user_metadata exactly like public.provision_shop_row();
// slugs use lib/slugify.ts slugifyWithFallback with the same deterministic
// '-<first 6 id chars>' collision suffix as repairShopSlug.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic';

function metaString(meta: Record<string, unknown>, key: string): string | null {
  const value = meta[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function ensureShopRow(): Promise<NextResponse> {
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
      return NextResponse.json(
        { error: 'Unauthorized.', code: 'unauthorized' },
        { status: 401 }
      );
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fast path — the row exists, nothing to heal.
    const { data: existing, error: readError } = await admin
      .from('shops')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (readError) {
      console.error('[shops/ensure] read failed:', readError);
      return NextResponse.json(
        { error: 'Could not verify the shop profile.', code: 'read_failed' },
        { status: 500 }
      );
    }
    if (existing) {
      return NextResponse.json({ healed: false, present: true });
    }

    // Orphan — derive the row from signup metadata (same fallbacks as the
    // SQL provisioning core: email local-part, then 'My Boutique').
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const shopName =
      metaString(meta, 'shop_name') ??
      (user.email ? user.email.split('@')[0] : null) ??
      'My Boutique';

    let shopSlug = slugifyWithFallback(shopName, user.id);
    const { data: collision } = await admin
      .from('shops')
      .select('id')
      .eq('shop_slug', shopSlug)
      .neq('id', user.id)
      .maybeSingle();
    const idSuffix = slugify(user.id).replace(/-/g, '').slice(0, 6) || '0';
    if (collision) {
      shopSlug = `${shopSlug}-${idSuffix}`;
    }

    const row = {
      id: user.id,
      shop_name: shopName,
      shop_slug: shopSlug,
      phone: metaString(meta, 'phone_number'),
      subscription_tier: metaString(meta, 'subscription_tier') ?? 'pending',
      requested_plan: metaString(meta, 'requested_plan'),
      status: 'active',
    };

    // ON CONFLICT (id) DO NOTHING — a concurrent heal/trigger win is success.
    const { error: insertError } = await admin
      .from('shops')
      .upsert(row, { onConflict: 'id', ignoreDuplicates: true });

    if (insertError) {
      // Unique violation on shop_slug (collision race with another shop) —
      // one deterministic suffixed retry, mirroring repairShopSlug.
      if (insertError.code === '23505') {
        const suffixed = `${slugifyWithFallback(shopName, user.id)}-${idSuffix}`;
        const { error: retryError } = await admin
          .from('shops')
          .upsert({ ...row, shop_slug: suffixed }, { onConflict: 'id', ignoreDuplicates: true });
        if (!retryError) {
          console.log(`[shops/ensure] Healed orphan ${user.id} with suffixed slug "${suffixed}"`);
          return NextResponse.json({ healed: true, present: true, shop_slug: suffixed });
        }
        console.error('[shops/ensure] suffixed retry failed:', retryError);
      }
      console.error('[shops/ensure] insert failed:', insertError);
      return NextResponse.json(
        { error: 'Could not provision the shop profile.', code: 'insert_failed' },
        { status: 500 }
      );
    }

    console.log(`[shops/ensure] Healed orphaned account ${user.id} → shop "${shopSlug}"`);
    return NextResponse.json({ healed: true, present: true, shop_slug: shopSlug });
  } catch (error) {
    console.error('[shops/ensure] fatal:', error);
    return NextResponse.json(
      { error: 'Failed to verify the shop profile.', code: 'insert_failed' },
      { status: 500 }
    );
  }
}

export async function POST() {
  return ensureShopRow();
}

// GET mirrors POST so the heal can be invoked from a plain link/health check.
export async function GET() {
  return ensureShopRow();
}
