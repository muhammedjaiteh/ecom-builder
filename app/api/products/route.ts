import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const verifyClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await verifyClient.auth.getUser(token);
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
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await supabase
      .from('products')
      .insert([{
        user_id: user.id,
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
  } catch (err: any) {
    console.error('[products] fatal error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
