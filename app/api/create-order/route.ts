import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { productName, price } = body;

    // 🧹 SANITIZER: Clean the price string
    // This turns "D100", "$100", or "100 Dalasi" into just "100"
    const cleanPriceString = String(price).replace(/[^0-9.]/g, ""); 
    const finalPrice = parseFloat(cleanPriceString) || 0; // Default to 0 if it fails completely

    // Connect to Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Insert the order
    const { data, error } = await supabase
      .from('orders')
      .insert([
        { 
          product_name: productName, 
          price: finalPrice, 
          status: 'pending'
        }
      ])
      .select();

    if (error) {
      console.error("Supabase Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, order: data });

  } catch (error: any) {
    console.error("Server Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}