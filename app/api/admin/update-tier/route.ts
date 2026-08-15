import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { resolveAdmin } from '@/lib/adminGuard';
import { classifyAdminAction, recordAdminAction } from '@/lib/adminAudit';

export async function POST(request: Request) {
  try {
    // 1. Await cookies (Next.js 15 standard)
    const cookieStore = await cookies();

    // 2. Verify the caller against the shared CEO Vault guard
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
        },
      }
    );

    const { data: { user } } = await supabaseAuth.auth.getUser();

    // CEO Vault — Wall 2 (AUTHORITATIVE): role AND pinned email, both
    // required before any service-role touch.
    if (!user || !resolveAdmin(user).strict) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 3. Get the data sent by your button click
    const body = await request.json();

    // The frontend might send it as 'shopId' or 'id', and 'tier' or 'subscription_tier'
    const targetShopId = body.shopId || body.id;
    const targetTier = body.tier || body.subscription_tier;

    if (!targetShopId || !targetTier) {
      return NextResponse.json({ error: 'Missing shop ID or tier data' }, { status: 400 });
    }

    // 4. Use God Mode to bypass security and force the update
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Audit prelude: capture the tier BEFORE the mutation. maybeSingle never
    // throws — a read failure degrades to a null from_tier, never blocks.
    const { data: prior } = await supabaseAdmin
      .from('shops')
      .select('subscription_tier')
      .eq('id', targetShopId)
      .maybeSingle();
    const priorTier: string | null = prior?.subscription_tier ?? null;

    const { data, error } = await supabaseAdmin
      .from('shops')
      .update({ subscription_tier: targetTier })
      .eq('id', targetShopId)
      .select();

    if (error) {
      console.error('Database Update Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Audit trail (CEO Vault): recordAdminAction swallows its own failures —
    // audit can never fail the approval of a seller who paid.
    await recordAdminAction(supabaseAdmin, {
      admin_id: user.id,
      target_shop_id: targetShopId,
      action: classifyAdminAction({ fromTier: priorTier, toTier: String(targetTier) }),
      from_tier: priorTier,
      to_tier: String(targetTier),
      notes: null,
    });

    // 5. Success! Return the updated shop to the frontend
    return NextResponse.json({ success: true, shop: data[0] });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
