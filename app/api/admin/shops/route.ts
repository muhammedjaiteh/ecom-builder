import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const ADMIN_EMAIL = 'muhammedjaiteh419@gmail.com';

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies: cookies });
    
    // Verify admin authentication
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Fetch all shops - email should be stored in the shops table
    const { data: shops, error } = await supabase
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
