import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { slugifyWithFallback } from '@/lib/slugify';
import { resolveAdmin } from '@/lib/adminGuard';
import { classifyAdminAction, recordAdminAction } from '@/lib/adminAudit';

// Force Next.js to always fetch fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// --- GET: Fetch Shops and Mapped Emails (SECURED) ---
export async function GET() {
  try {
    // 1. Secure Authentication Check (Next.js 15 standard: cookies() is asynchronous)
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); }
        }
      }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    // CEO Vault — Wall 2 (AUTHORITATIVE): role AND pinned email, both
    // required before the service-role client is even constructed.
    if (authError || !user || !resolveAdmin(user).strict) {
      console.error("🚨 GET AUTH ERROR:", authError || "User failed the strict admin check");
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 403 });
    }

    // 2. Execute Data Fetch using God Mode
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: shops, error: shopsError } = await supabaseAdmin
      .from('shops')
      .select('*')
      .order('created_at', { ascending: false });

    if (shopsError) throw shopsError;

    const { data: userData } = await supabaseAdmin.auth.admin.listUsers();
    const users = userData?.users || [];

    const combinedShops = (shops || []).map(shop => {
      const owner = users.find(u => u.id === shop.id);
      
      return {
        ...shop,                           
        shop_name: shop.shop_name,
        owner_email: owner?.email || null
      };
    });

    return NextResponse.json({ shops: combinedShops });
  } catch (error) {
    console.error("GET Fatal Crash:", error);
    // Guarantee a valid JSON response even on fatal crash
    return NextResponse.json({ error: 'Failed to fetch. Server crashed.' }, { status: 500 });
  }
}

// --- PATCH: Total Control Updates (SECURED & ROBUST) ---
export async function PATCH(request: Request) {
  try {
    console.log("🚨 ADMIN UPDATE REQUEST INITIATED");

    // 1. Validate Request Body Immediately
    const body = await request.json();
    console.log("📦 PAYLOAD RECEIVED:", body);
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Critical failure: Missing shop ID' }, { status: 400 });
    }

    // 2. Secure Authentication Check (Lock out non-admins)
    // 🚨 Next.js 15 standard: cookies() is now ASYNCHRONOUS
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); }
        }
      }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    // CEO Vault — Wall 2 (AUTHORITATIVE): role AND pinned email, both
    // required before any service-role touch.
    if (authError || !user || !resolveAdmin(user).strict) {
      console.error("🚨 PATCH AUTH ERROR:", authError || "User failed the strict admin check");
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 403 });
    }

    // 3. Execute Update using God Mode
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Law 2 slug safety: this PATCH is the only in-repo write path for
    // shops.shop_slug. Normalize it so spaces/uppercase can never enter the DB
    // and break /site routing (never store an empty slug either).
    if (typeof updates.shop_slug === 'string') {
      updates.shop_slug = slugifyWithFallback(updates.shop_slug, id);
    }

    // Audit prelude: capture the tier BEFORE the mutation (from_tier for
    // admin_actions). maybeSingle never throws — a read failure degrades to a
    // null from_tier, never blocks the update.
    const touchesTierOrStatus =
      typeof updates.subscription_tier === 'string' || typeof updates.status === 'string';
    let priorTier: string | null = null;
    if (touchesTierOrStatus) {
      const { data: prior } = await supabaseAdmin
        .from('shops')
        .select('subscription_tier')
        .eq('id', id)
        .maybeSingle();
      priorTier = prior?.subscription_tier ?? null;
    }

    const { data, error } = await supabaseAdmin
      .from('shops')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) {
      // Log the specific database error for debugging
      console.error("🚨 SUPABASE DATABASE ERROR:", error);
      // Return the specific message so the admin knows exactly why it failed
      return NextResponse.json({ error: error.message || 'Database update failed' }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Shop update succeeded but no data was returned' }, { status: 500 });
    }

    // Audit trail (CEO Vault): one admin_actions row per tier/status mutation.
    // recordAdminAction swallows its own failures — audit can never fail the
    // approval of a seller who paid.
    if (touchesTierOrStatus) {
      const toTier =
        typeof updates.subscription_tier === 'string' ? updates.subscription_tier : priorTier;
      await recordAdminAction(supabaseAdmin, {
        admin_id: user.id,
        target_shop_id: id,
        action: classifyAdminAction({
          fromTier: priorTier,
          toTier,
          toStatus: typeof updates.status === 'string' ? updates.status : null,
        }),
        from_tier: priorTier,
        to_tier: toTier,
        notes: null,
      });
    }

    console.log("✅ UPDATE SUCCESS:", data);
    return NextResponse.json({ success: true, shop: data[0] });

  } catch (e) {
    // 🛡️ THE SAFETY LOCK: If *anything* unexpected happens, capture it and return clean JSON.
    // This prevents the generic browser "can't load page" crash.
    console.error("🚨 PATCH FATAL SERVER CRASH:", e);
    const message = e instanceof Error && e.message ? e.message : 'Server crashed during update';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}