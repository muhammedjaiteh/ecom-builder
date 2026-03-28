import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const ADMIN_EMAIL = 'admin@sanndikaa.com';

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Verify admin authentication
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user || user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get request data
    const { shopId, newTier } = await request.json();

    if (!shopId || !newTier) {
      return NextResponse.json({ error: 'Missing shopId or newTier' }, { status: 400 });
    }

    // Update the shop's subscription tier
    const { error } = await supabase
      .from('shops')
      .update({ subscription_tier: newTier })
      .eq('id', shopId);

    if (error) {
      console.error('Error updating tier:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in update-tier API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
