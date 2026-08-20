import { GoogleGenerativeAI } from '@google/generative-ai';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// Product create API. AUTH + INSERT both ride the cookie-authed server client
// (the publish-route pattern): the caller's JWT is attached to the PostgREST
// insert, so the strict products_owner_insert policy (RLS_PRODUCTS_ORDERS_
// SHOPS.sql) authorizes it as `authenticated`. The historical bare anon-key
// client is gone — it sent NO JWT, which only ever worked because the live
// DB's INSERT policy had drifted permissive (see sql/provisioning.sql
// SECTION 10, which kills that drift).
export async function POST(request: Request) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: async () => (await cookies()).getAll(),
          setAll: async (cookiesToSet) => {
            const cookieStore = await cookies();
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: Invalid or expired token' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, category, price, image_url, image_urls, colors, sizes, stock_quantity } = body;

    // ── Generate embedding ────────────────────────────────────────────────
    const apiKey = process.env.GEMINI_API_KEY;
    let embedding: number[] | null = null;

    if (apiKey && name) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
        const text = [name, category, description].filter(Boolean).join(' ');
        const result = await embeddingModel.embedContent(text);
        embedding = result.embedding.values;
      } catch (embErr) {
        console.error('[products] embedding generation failed (non-fatal):', embErr);
      }
    }

    // ── Insert product ────────────────────────────────────────────────────
    // shop_id is written alongside user_id (shops are keyed on the owner's
    // auth id, so they are the same value). Omitting shop_id minted "ghost"
    // rows invisible to the legacy /shop page's FK embed on shop_id.
    const { data, error } = await supabase
      .from('products')
      .insert([{
        user_id: user.id,
        shop_id: user.id,
        name,
        price,
        description,
        category,
        image_url,
        image_urls,
        colors,
        sizes,
        stock_quantity,
        ...(embedding ? { embedding } : {}),
      }])
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, product: data });
  } catch (err) {
    console.error('[products] fatal error:', err);
    const message = err instanceof Error ? err.message : 'Failed to save product.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
