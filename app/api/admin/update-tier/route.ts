import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const ADMIN_EMAIL = 'muhammedjaiteh419@gmail.com';

export async function POST(request: Request) {
  try {
    // 1. Await cookies (Next.js 15 standard)
    const cookieStore = await cookies();
    
    // 2. Safely verify it is actually you (The Admin)
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

    if (!user || user.email?.toLowerCase().trim() !== ADMIN_EMAIL) {
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

    const { data, error } = await supabaseAdmin
      .from('shops')
      .update({ subscription_tier: targetTier })
      .eq('id', targetShopId)
      .select();

    if (error) {
      console.error('Database Update Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 5. Success! Return the updated shop to the frontend
    return NextResponse.json({ success: true, shop: data[0] });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
