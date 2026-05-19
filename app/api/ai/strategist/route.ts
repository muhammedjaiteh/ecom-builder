import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────
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
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    // ── Fetch seller's inventory ──────────────────────────────────────────
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('name, category, price, description')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (productsError) throw productsError;

    if (!products || products.length === 0) {
      return NextResponse.json(
        { error: 'Add at least one product before generating a strategy.' },
        { status: 400 }
      );
    }

    // ── Build inventory summary for the prompt ────────────────────────────
    const inventoryList = products
      .map((p) => `• ${p.name} (${p.category ?? 'General'}, D${p.price})${p.description ? ` — ${p.description.slice(0, 80)}` : ''}`)
      .join('\n');

    // ── Call Gemini 2.5 Flash ─────────────────────────────────────────────
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key not configured.' },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `You are an expert luxury retail strategist for Sanndikaa, a premium African boutique marketplace. A seller has asked you to design a promotional discount strategy based on their current inventory.

Seller's current inventory:
${inventoryList}

Analyze the specific products — their categories, price points, and themes — and design one targeted promotional campaign.

Return ONLY a valid JSON object with no markdown fences, no explanation, nothing else:
{
  "code_name": "A catchy, memorable all-caps promo code with the discount baked in, e.g. GLOW20, SUMMERVIBES15, BEAUTY10 (6-14 characters)",
  "discount_percentage": A whole number between 10 and 30 that makes sense for this specific inventory,
  "strategy": "A confident 1-2 sentence explanation of WHY this specific discount will drive conversions for their current stock — reference the actual product categories or themes."
}`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

    let parsed: { code_name: string; discount_percentage: number; strategy: string };
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error('[strategist] JSON parse failed. Raw:', raw);
      return NextResponse.json(
        { error: 'AI returned an unexpected format. Please try again.' },
        { status: 500 }
      );
    }

    if (!parsed.code_name || !parsed.discount_percentage || !parsed.strategy) {
      return NextResponse.json(
        { error: 'AI response was incomplete. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      code_name: parsed.code_name.toUpperCase().replace(/\s+/g, ''),
      discount_percentage: Math.min(Math.max(Math.round(parsed.discount_percentage), 5), 50),
      strategy: parsed.strategy,
    });
  } catch (error: any) {
    console.error('[strategist] fatal error:', error);

    const msg: string = error?.message || '';
    const isQuota =
      error?.status === 429 ||
      msg.includes('429') ||
      msg.toLowerCase().includes('quota') ||
      msg.toLowerCase().includes('rate limit');

    if (isQuota) {
      return NextResponse.json(
        { error: 'The AI strategist is busy. Please try again in a moment.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate strategy. Please try again.' },
      { status: 500 }
    );
  }
}
