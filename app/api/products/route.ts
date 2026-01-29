import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const body = await request.json();

    // Insert into Database
    const { data, error } = await supabase
      .from("products")
      .insert([
        {
          store_id: body.store_id,
          name: body.name,
          price_d: body.price_d,
          image_url: body.image_url, // Now we save the image link!
        },
      ])
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, product: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}