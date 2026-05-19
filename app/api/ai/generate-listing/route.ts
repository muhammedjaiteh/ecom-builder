import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const METERED_TIERS = ['starter', 'pro'];

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

    // ── Tier & credits ────────────────────────────────────────────────────
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .select('id, subscription_tier, ai_credits')
      .eq('id', user.id)
      .single();

    if (shopError || !shop) {
      return NextResponse.json({ error: 'Shop profile not found.' }, { status: 404 });
    }

    const tier = shop.subscription_tier?.toLowerCase() || '';

    if (tier === 'pending' || tier === 'suspended') {
      return NextResponse.json(
        { error: 'Account not active. Please complete payment to unlock AI features.' },
        { status: 403 }
      );
    }

    if (METERED_TIERS.includes(tier) && (!shop.ai_credits || shop.ai_credits <= 0)) {
      return NextResponse.json(
        { error: 'AI credit limit reached. Upgrade to Advanced for unlimited access.', creditsRemaining: 0 },
        { status: 403 }
      );
    }

    // ── Parse body ────────────────────────────────────────────────────────
    const { imageBase64, mimeType } = await req.json();
    if (!imageBase64) {
      return NextResponse.json({ error: 'imageBase64 is required.' }, { status: 400 });
    }

    // ── Gemini vision call ────────────────────────────────────────────────
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key not configured. Add GEMINI_API_KEY to your environment variables.' },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are a luxury e-commerce copywriter for Sanndikaa, a premium boutique marketplace. Analyze this product image carefully and generate compelling listing copy.

Return ONLY a valid JSON object — no markdown fences, no explanation, nothing else:
{
  "title": "A concise, premium product title (3-7 words, Title Case)",
  "description": "A compelling 2-3 sentence product description highlighting quality, materials, and appeal. Write in a confident, luxury tone suitable for a high-end African marketplace.",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
}`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: imageBase64, mimeType: mimeType || 'image/jpeg' } },
    ]);

    const raw = result.response.text().trim();
    // Strip any accidental markdown fences
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

    let parsed: { title: string; description: string; tags: string[] };
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error('[generate-listing] JSON parse failed. Raw:', raw);
      return NextResponse.json({ error: 'AI returned an unexpected format. Please try again.' }, { status: 500 });
    }

    if (!parsed.title || !parsed.description) {
      return NextResponse.json({ error: 'AI response was incomplete. Please try again.' }, { status: 500 });
    }

    // ── Deduct credit for metered tiers ───────────────────────────────────
    if (METERED_TIERS.includes(tier)) {
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      await admin.from('shops').update({ ai_credits: shop.ai_credits - 1 }).eq('id', shop.id);
    }

    return NextResponse.json({
      title: parsed.title,
      description: parsed.description,
      tags: parsed.tags || [],
      creditsRemaining: METERED_TIERS.includes(tier) ? Math.max(0, shop.ai_credits - 1) : null,
    });

  } catch (error: any) {
    console.error('[generate-listing] fatal error:', error);

    const msg: string = error?.message || '';
    const isQuota =
      error?.status === 429 ||
      error?.response?.status === 429 ||
      msg.includes('429') ||
      msg.toLowerCase().includes('quota') ||
      msg.toLowerCase().includes('rate limit') ||
      msg.toLowerCase().includes('too many requests');

    if (isQuota) {
      return NextResponse.json(
        { error: 'The AI assistant is currently busy. Please try again in a moment or write the description manually.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate listing. Please try again.' },
      { status: 500 }
    );
  }
}
