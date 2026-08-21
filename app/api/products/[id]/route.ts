import { createClient } from "@supabase/supabase-js";
import { revalidateTag } from "next/cache";
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

    // The caller's JWT rides the PostgREST call so the strict
    // products_owner_delete policy authorizes it as `authenticated` — the
    // previous bare anon-key client sent no JWT and would silently delete
    // zero rows under the versioned RLS. The explicit owner filter is
    // defense-in-depth on top of the policy.
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Delete the product where the ID matches AND the caller owns it
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Delete error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Cache bust: the /site routes serve this shop's catalog from the Data
    // Cache under this exact tag (app/site/[slug]/siteData.ts) — a deleted
    // product must disappear immediately. user.id IS the shop id.
    revalidateTag(`site:${user.id}`, 'max');

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[products/:id] fatal error:", err);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}