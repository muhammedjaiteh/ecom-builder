import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const ADMIN_EMAIL = 'muhammedjaiteh419@gmail.com';

type ShopRow = {
  id: string;
  seller_id: string;
  name: string;
  description: string | null;
  status: string;
  subscription_tier: string;
  created_at: string;
};

function getServiceSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase service role environment variables');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

export async function GET() {
  try {
    const supabaseAdmin = getServiceSupabase();

    const [{ data: shops, error: shopsError }, { data: usersData, error: usersError }] = await Promise.all([
      supabaseAdmin
        .from('shops')
        .select('id, seller_id, name, description, status, subscription_tier, created_at')
        .order('created_at', { ascending: false }),
      supabaseAdmin.auth.admin.listUsers(),
    ]);

    if (shopsError) {
      return NextResponse.json({ error: shopsError.message }, { status: 500 });
    }

    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 });
    }

    const usersById = new Map((usersData?.users || []).map((user) => [user.id, user.email ?? null]));

    const combinedShops = (shops || []).map((shop: ShopRow) => ({
      ...shop,
      owner_email: usersById.get(shop.seller_id) ?? null,
    }));

    return NextResponse.json({ shops: combinedShops }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ error: 'Missing Supabase auth environment variables' }, { status: 500 });
    }

    const supabaseAuth = createServerClient(supabaseUrl, anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // No-op in route handlers for this endpoint.
        },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();

    if (userError || !user || user.email?.toLowerCase().trim() !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { id, status, subscription_tier } = body as {
      id?: string;
      status?: string;
      subscription_tier?: string;
    };

    if (!id || !status || !subscription_tier) {
      return NextResponse.json(
        { error: 'id, status, and subscription_tier are required' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getServiceSupabase();

    const { data, error } = await supabaseAdmin
      .from('shops')
      .update({ status, subscription_tier })
      .eq('id', id)
      .select('id, seller_id, name, description, status, subscription_tier, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ shop: data }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
