import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function DELETE(
  request: Request,
  // Next.js 15 requires us to treat 'params' as a Promise
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params; // We wait for the ID

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Delete the product where the ID matches
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Delete error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}