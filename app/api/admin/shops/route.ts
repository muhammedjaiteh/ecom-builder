import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Force Next.js to always fetch fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ADMIN_EMAIL = 'muhammedjaiteh419@gmail.com';

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
    
    if (authError || !user || user.email?.toLowerCase().trim() !== ADMIN_EMAIL) {
      console.error("🚨 GET AUTH ERROR:", authError || "User is not admin");
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
  } catch (error: any) {
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
    
    if (authError || !user || user.email?.toLowerCase().trim() !== ADMIN_EMAIL) {
      console.error("🚨 PATCH AUTH ERROR:", authError || "User is not admin");
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 403 });
    }

    // 3. Execute Update using God Mode
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

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

    console.log("✅ UPDATE SUCCESS:", data);
    return NextResponse.json({ success: true, shop: data[0] });

  } catch (e: any) {
    // 🛡️ THE SAFETY LOCK: If *anything* unexpected happens, capture it and return clean JSON.
    // This prevents the generic browser "can't load page" crash.
    console.error("🚨 PATCH FATAL SERVER CRASH:", e);
    return NextResponse.json({ error: e.message || 'Server crashed during update' }, { status: 500 });
  }
}