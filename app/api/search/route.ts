import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { query, match_count = 10, match_threshold = 0.3 } = await request.json();

    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json({ error: 'query is required.' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key not configured.' },
        { status: 500 }
      );
    }

    // ── Embed the search query ────────────────────────────────────────────
    const genAI = new GoogleGenerativeAI(apiKey);
    const embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
    const result = await embeddingModel.embedContent(query.trim());
    const queryEmbedding = result.embedding.values;

    // ── Call the match_products RPC ───────────────────────────────────────
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: products, error } = await supabase.rpc('match_products', {
      query_embedding: queryEmbedding,
      match_threshold,
      match_count,
    });

    if (error) throw error;

    return NextResponse.json({ products: products ?? [] });
  } catch (error: any) {
    console.error('[search] fatal error:', error);

    const msg: string = error?.message || '';
    const isQuota =
      error?.status === 429 ||
      msg.includes('429') ||
      msg.toLowerCase().includes('quota') ||
      msg.toLowerCase().includes('rate limit');

    if (isQuota) {
      return NextResponse.json(
        { error: 'Search service is busy. Please try again in a moment.' },
        { status: 429 }
      );
    }

    return NextResponse.json({ error: 'Search failed. Please try again.' }, { status: 500 });
  }
}
