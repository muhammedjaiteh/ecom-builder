import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const ADMIN_EMAIL = 'muhammedjaiteh419@gmail.com';

export async function GET() {
  try {
    // Await cookies in Next.js 15
    const cookieStore = await cookies();
    
    // Create regular Supabase client for auth verification
    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          storage: {
            getItem: (key: string) => {
              return cookieStore.get(key)?.value ?? null;
            },
            setItem: (key: string, value: string) => {
              // Not needed for GET requests
            },
            removeItem: (key: string) => {
              // Not needed for GET requests
            },
          },
        },
      }
    );
    
    // Verify admin authentication
    const { data: { user } } = await supabaseAuth.auth.getUser();
    
    if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Create service role client for bypassing RLS (God Mode)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Fetch all shops with service role key - bypasses RLS
    const { data: shops, error } = await supabaseAdmin
      .from('shops')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching shops:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ shops: shops || [] });
  } catch (error) {
    console.error('Error in admin/shops API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
