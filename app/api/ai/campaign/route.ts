import { NextResponse, NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const METERED_TIERS = ['starter', 'pro'];

/**
 * POST /api/ai/campaign
 * Generate a WhatsApp broadcast campaign message using OpenAI
 * Auth: Uses session cookies from Supabase
 * Deducts 1 AI credit for starter/pro tiers
 */
export async function POST(request: NextRequest) {
  try {
    // ========================================
    // 1. AUTHENTICATION: Verify user via session cookies
    // ========================================
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
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to use AI features.' },
        { status: 401 }
      );
    }

    // ========================================
    // 2. PARSE REQUEST & VALIDATE INPUT
    // ========================================
    const body = await request.json();
    const { productNames, shopSlug } = body;

    if (!productNames || !Array.isArray(productNames) || productNames.length === 0) {
      return NextResponse.json(
        { error: 'At least one product is required' },
        { status: 400 }
      );
    }

    if (productNames.length > 5) {
      return NextResponse.json(
        { error: 'Maximum 5 products allowed' },
        { status: 400 }
      );
    }

    // ========================================
    // 3. QUERY SHOP & VERIFY TIER/CREDITS
    // ========================================
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .select('id, subscription_tier, ai_credits, shop_slug')
      .eq('id', user.id)
      .single();

    if (shopError || !shop) {
      console.error(`Shop not found for user ${user.id}:`, shopError);
      return NextResponse.json(
        { error: 'Shop profile not found. Please complete registration.' },
        { status: 404 }
      );
    }

    const tier = shop.subscription_tier?.toLowerCase() || '';

    // Block inactive accounts
    if (tier === 'pending' || tier === 'suspended') {
      return NextResponse.json(
        {
          error: 'Account not active. Please complete payment to unlock AI features.',
          tier,
        },
        { status: 403 }
      );
    }

    // Check credits for metered tiers
    if (METERED_TIERS.includes(tier)) {
      if (!shop.ai_credits || shop.ai_credits <= 0) {
        return NextResponse.json(
          {
            error: 'AI Credit limit reached. Please upgrade to Advanced for unlimited access.',
            creditsRemaining: 0,
          },
          { status: 403 }
        );
      }
    }

    // ========================================
    // 4. PREPARE & CALL OPENAI API
    // ========================================
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI configuration error' },
        { status: 500 }
      );
    }

    const productList = productNames.join(', ');
    const userPrompt = `You are a high-converting Gambian marketer. Write a punchy, urgent WhatsApp broadcast mentioning these specific products: ${productList}. Keep it under 75 words max to avoid mobile URL crashes. Use friendly emojis. Make it compelling and urgent for a Gambian audience.`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    });

    const openaiData = await openaiResponse.json();

    if (!openaiResponse.ok) {
      console.error('OpenAI API error:', openaiData);
      return NextResponse.json(
        { error: 'Failed to generate campaign message. Please try again.' },
        { status: 500 }
      );
    }

    const aiMessage = openaiData.choices?.[0]?.message?.content || '';

    if (!aiMessage) {
      return NextResponse.json(
        { error: 'No response from AI service' },
        { status: 500 }
      );
    }

    // ========================================
    // 5. VALIDATE WORD COUNT
    // ========================================
    const wordCount = aiMessage.trim().split(/\s+/).length;
    if (wordCount > 75) {
      return NextResponse.json(
        {
          error: `AI message exceeded 75-word limit (${wordCount} words)`,
          suggestedMessage: aiMessage.split(' ').slice(0, 75).join(' ') + '...',
        },
        { status: 400 }
      );
    }

    // ========================================
    // 6. DEDUCT CREDIT FOR METERED TIERS
    // ========================================
    if (METERED_TIERS.includes(tier)) {
      const { error: updateError } = await supabase
        .from('shops')
        .update({ ai_credits: shop.ai_credits - 1 })
        .eq('id', shop.id);

      if (updateError) {
        console.error(`Failed to decrement AI credits for shop ${shop.id}:`, updateError);
      }
    }

    // ========================================
    // 7. BUILD FINAL MESSAGE & RETURN
    // ========================================
    const storeLink = `\n\nShop here: sanndikaa.com/shop/${shopSlug || shop.shop_slug || 'store'}`;
    const finalMessage = aiMessage + storeLink;

    return NextResponse.json({
      message: finalMessage,
      aiContent: aiMessage,
      storeLink,
      creditsRemaining: METERED_TIERS.includes(tier) ? Math.max(0, shop.ai_credits - 1) : null,
      tier,
      wordCount,
    });

  } catch (error) {
    console.error('Campaign generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate campaign message. Please try again.' },
      { status: 500 }
    );
  }
}
