import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.replace("Bearer ", "");
    const verifyClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await verifyClient.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized: Invalid or expired token" }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
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