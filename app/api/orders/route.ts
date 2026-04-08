import { createClient } from "@supabase/supabase-js";
import { NextResponse, NextRequest } from "next/server";

const ALLOWED_STATUSES = ['new', 'processing', 'shipped', 'completed', 'cancelled'];

interface StatusUpdateRequest {
  orderId: string;
  status: string;
}

// PATCH /api/orders - Update order status
export async function PATCH(request: NextRequest) {
  try {
    const body: StatusUpdateRequest = await request.json();
    const { orderId, status } = body;

    // Validate required fields
    if (!orderId || !status) {
      return NextResponse.json(
        { error: 'Missing orderId or status' },
        { status: 400 }
      );
    }

    // Validate status
    const normalizedStatus = status.toLowerCase();
    if (!ALLOWED_STATUSES.includes(normalizedStatus)) {
      return NextResponse.json(
        {
          error: `Invalid status. Allowed statuses: ${ALLOWED_STATUSES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Get auth session from headers
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing authorization header' },
        { status: 401 }
      );
    }

    // Extract and verify the token
    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const verifyClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await verifyClient.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or expired token' },
        { status: 401 }
      );
    }

    // Create service client to verify ownership and update
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the order exists and belongs to the current user
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('id, shop_id, status, total_amount, fulfillment_method, created_at')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Verify the user owns the order
    if (order.shop_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You can only update your own orders' },
        { status: 403 }
      );
    }

    // Update the order status
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({ status: normalizedStatus })
      .eq('id', orderId)
      .select()
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update order status' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Order status updated to ${normalizedStatus}`,
      order: updatedOrder,
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/orders - Keep existing POST functionality
export async function POST(request: Request) {
  try {
    // 1. Initialize Supabase directly (just like we did in the page file)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const body = await request.json();

    // 2. Insert the order
    const { data, error } = await supabase
      .from("orders")
      .insert([
        {
          store_id: body.store_id,
          product_id: body.product_id,
          product_name: body.product_name,
          price_d: body.price_d,
          status: "new",
          fulfillment_method: body.fulfillment_method || 'delivery',
        },
      ])
      .select();

    if (error) {
      console.error("Supabase Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, order: data });
  } catch (err) {
    console.error("Server Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}