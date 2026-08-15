import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { resolveAdmin } from '@/lib/adminGuard';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/pending — the CEO Approval Queue feed.
// Shops sitting at subscription_tier='pending' (signed up, invoice sent, cash
// not yet confirmed), oldest first — the seller who has waited longest is at
// the top. Strict-guarded (Wall 2), served by the service-role client.
// Deliberately lean columns: the queue card needs nothing else.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export type PendingShop = {
  id: string;
  shop_name: string | null;
  shop_slug: string | null;
  phone: string | null;
  requested_plan: string | null;
  created_at: string;
  status: string | null;
};

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    // CEO Vault — Wall 2 (AUTHORITATIVE): role AND pinned email, both
    // required before the service-role client is even constructed.
    if (authError || !user || !resolveAdmin(user).strict) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 403 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabaseAdmin
      .from('shops')
      .select('id, shop_name, shop_slug, phone, requested_plan, created_at, status')
      .eq('subscription_tier', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[admin-pending] query failed:', error);
      return NextResponse.json({ error: error.message || 'Failed to load the queue' }, { status: 500 });
    }

    return NextResponse.json({ shops: (data ?? []) as PendingShop[] });
  } catch (err) {
    console.error('[admin-pending] fatal:', err);
    return NextResponse.json({ error: 'Failed to load the approval queue.' }, { status: 500 });
  }
}
