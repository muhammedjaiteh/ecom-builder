import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Create service role client - bypasses RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Query database table directly - bypasses RLS
    const { data, error } = await supabase
      .from('shops')
      .select('*');

    if (error) {
      console.error('Error fetching shops:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error in admin/shops API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
