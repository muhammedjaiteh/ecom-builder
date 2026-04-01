import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Force Next.js to always fetch fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ADMIN_EMAIL = 'muhammedjaiteh419@gmail.com';

// --- GET: Fetch Shops and Mapped Emails ---
export async function GET() {
  try {
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
    console.error("GET Error:", error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

// --- PATCH: Total Control Updates ---
export async function PATCH(request: Request) {
  try {
    console.log("🚨 ADMIN UPDATE REQUEST INITIATED");

    // 1. Secure Authentication Check (Next.js 15 standard)
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
      console.error("🚨 AUTH ERROR:", authError || "User is not admin");
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 403 });
    }

    // 2. Process Request Body
    const body = await request.json();
    console.log("📦 PAYLOAD RECEIVED:", body);
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing shop ID' }, { status: 400 });
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
      console.error("🚨 SUPABASE ERROR:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log("✅ UPDATE SUCCESS:", data);
    return NextResponse.json({ success: true, shop: data[0] });

  } catch (e: any) {
    console.error("🚨 FATAL CRASH:", e);
    return NextResponse.json({ error: e.message || 'Server crashed' }, { status: 500 });
  }
}