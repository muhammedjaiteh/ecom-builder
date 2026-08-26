import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// ─────────────────────────────────────────────────────────────────────────────
// Marketplace search (Final UX Polish, Fix 3) — surgical relevance ranking.
//
// THE HISTORICAL MISS: every query went straight to the Gemini-embedding
// match_products RPC. Embeddings blend name + description, so "Women dress"
// surfaced cosmetics whose DESCRIPTIONS mention women — loose description
// matching promoted to primary results.
//
// THE NEW CONTRACT:
//   1. PRIMARY (lexical, deterministic): every query token must hit the
//      product's CATEGORY or TITLE (the storefront SiteSearch all-token
//      discipline — enforced in the DB query itself). Ranking: category
//      exact/prefix matches first, then title word/prefix matches, then title
//      substrings. Descriptions NEVER rank a primary result.
//   2. WEAK FALLBACK (semantic, explicitly labeled): only when ZERO products
//      cover all tokens through category/title does the embedding RPC run —
//      the response carries related:true and the client labels it "closest
//      matches" honestly. Kept (not deleted) because vibe queries like
//      "summer wedding outfit" have zero lexical hits by nature and dropping
//      them would kill the AI-stylist discovery path; the label is the fix.
//      Fallback failures degrade to an empty result set (the client's
//      designed no-matches state) — never a 500 for a fallback.
//
// Bonus (Law 3 adjacent): exact shopping queries no longer pay the Gemini
// embedding round trip at all — primaries resolve in one bounded DB read.
// No new deps, no embedding/pipeline changes.
// ─────────────────────────────────────────────────────────────────────────────

const PRIMARY_FETCH_LIMIT = 120;
const RESULT_LIMIT = 24;

// Same field parity as the homepage's product cards (id/name/price/images for
// the card, user_id/shop_id for the client's shop enrichment).
const PRODUCT_COLUMNS =
  'id, name, price, image_url, image_urls, category, stock_quantity, ad_video_url, ad_hero_image_url, user_id, shop_id';

type SearchRow = {
  id: string;
  name: string;
  category: string | null;
};

/** SiteSearch's tokenizer discipline: lowercase alphanumeric runs. Output is
 *  [a-z0-9]+ only — safe inside a PostgREST .or() filter by construction. */
function tokenize(query: string): string[] {
  return query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function words(field: string | null): string[] {
  return tokenize(field ?? '');
}

/** Category-first, title-second lexical score. All-token coverage is already
 *  guaranteed by the DB filter; this orders the covered set. */
function scoreProduct(row: SearchRow, tokens: string[], normalizedQuery: string): number {
  const catWords = words(row.category);
  const nameWords = words(row.name);
  const name = row.name.toLowerCase();
  let score = 0;

  // Whole-category exact/prefix vs the whole query — the strongest signal
  // ("beauty" → the Beauty shelf before any "beauty serum" title).
  const catNorm = catWords.join(' ');
  if (catNorm && normalizedQuery) {
    if (catNorm === normalizedQuery) score += 400;
    else if (catNorm.startsWith(normalizedQuery) || normalizedQuery.startsWith(catNorm)) score += 200;
  }

  for (const token of tokens) {
    if (catWords.includes(token)) score += 120;
    else if (catWords.some((w) => w.startsWith(token))) score += 80;

    if (nameWords.includes(token)) score += 40;
    else if (nameWords.some((w) => w.startsWith(token))) score += 25;
    else if (name.includes(token)) score += 10;
  }

  return score;
}

export async function POST(request: Request) {
  try {
    const { query, match_count = 10, match_threshold = 0.3 } = await request.json();

    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json({ error: 'query is required.' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const tokens = tokenize(query);

    // ── Primary pass: all-token lexical match over category ∪ title ────────
    if (tokens.length > 0) {
      let lexical = supabase.from('products').select(PRODUCT_COLUMNS).limit(PRIMARY_FETCH_LIMIT);
      // Chained .or() calls AND together: every token must hit name OR
      // category — the all-token primary discipline, enforced in the query.
      for (const token of tokens) {
        lexical = lexical.or(`name.ilike.%${token}%,category.ilike.%${token}%`);
      }
      const { data: primaries, error: lexicalError } = await lexical;
      if (lexicalError) {
        // A broken primary path is a real failure (not a fallback nicety).
        throw lexicalError;
      }

      if (primaries && primaries.length > 0) {
        const normalizedQuery = tokens.join(' ');
        const ranked = (primaries as unknown as SearchRow[])
          .map((row) => ({ row, score: scoreProduct(row, tokens, normalizedQuery) }))
          .sort((a, b) => b.score - a.score || a.row.name.localeCompare(b.row.name))
          .slice(0, RESULT_LIMIT)
          .map((r) => r.row);
        return NextResponse.json({ products: ranked, related: false });
      }
    }

    // ── Weak fallback: semantic embedding search, explicitly labeled ───────
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('[search] Gemini API key not configured — semantic fallback unavailable.');
      return NextResponse.json({ products: [], related: true });
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
      const result = await embeddingModel.embedContent(query.trim());
      const queryEmbedding = result.embedding.values;

      const { data: products, error } = await supabase.rpc('match_products', {
        query_embedding: queryEmbedding,
        match_threshold,
        match_count,
      });
      if (error) throw error;

      return NextResponse.json({ products: products ?? [], related: true });
    } catch (fallbackError) {
      // The fallback is best-effort by definition: degrade to the designed
      // zero-results state instead of a 500 (quota, cold model, RPC drift).
      console.error('[search] semantic fallback failed:', fallbackError);
      return NextResponse.json({ products: [], related: true });
    }
  } catch (error) {
    console.error('[search] fatal error:', error);
    return NextResponse.json({ error: 'Search failed. Please try again.' }, { status: 500 });
  }
}
