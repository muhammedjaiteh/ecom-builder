import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const METERED_TIERS = ['starter', 'pro'];

/**
 * POST /api/ai/generate-campaign
 * Generates a WhatsApp broadcast campaign message using AI
 * 
 * Required auth: Supabase JWT token in Authorization header
 * Deducts 1 credit from starter/pro tiers
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Verify token with Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const { productNames, shopName, shopSlug } = await request.json();

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

    // Fetch shop with tier and credits
    const { data: shop, error: shopError } = await supabaseAdmin
      .from('shops')
      .select('id, subscription_tier, ai_credits, shop_name, shop_slug')
      .eq('id', user.id)
      .single();

    if (shopError || !shop) {
      return NextResponse.json(
        { error: 'Shop not found' },
        { status: 404 }
      );
    }

    const tier = shop.subscription_tier || 'starter';

    // Block inactive accounts
    if (tier === 'pending' || tier === 'suspended') {
      return NextResponse.json(
        { error: 'Your account is not active. Please complete payment or contact support.' },
        { status: 403 }
      );
    }

    // Check credits for metered tiers
    if (METERED_TIERS.includes(tier)) {
      if (!shop.ai_credits || shop.ai_credits <= 0) {
        return NextResponse.json(
          {
            error: 'AI credit limit reached. Upgrade to Advanced tier for unlimited AI generation.',
            creditsRemaining: 0,
            tier
          },
          { status: 403 }
        );
      }
    }

    // Prepare the AI prompt
    const productList = productNames.join(', ');
    const userPrompt = `You are a high-converting Gambian marketer. Write a punchy, urgent WhatsApp broadcast mentioning these specific products: ${productList}. Keep it under 75 words max to avoid mobile URL crashes. Use friendly emojis. Make it compelling and urgent for a Gambian audience.`;

    // Call OpenAI API
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI configuration error' },
        { status: 500 }
      );
    }

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
            content: userPrompt
          }
        ],
        max_tokens: 150,
        temperature: 0.7
      })
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

    // Count words in AI message
    const wordCount = aiMessage.trim().split(/\s+/).length;
    if (wordCount > 75) {
      return NextResponse.json(
        {
          error: `AI message exceeded 75-word limit (${wordCount} words)`,
          suggestedMessage: aiMessage.split(' ').slice(0, 75).join(' ') + '...'
        },
        { status: 400 }
      );
    }

    // Append store link
    const storeLink = `\n\nShop here: sanndikaa.com/shop/${shop.shop_slug || 'store'}`;
    const finalMessage = aiMessage + storeLink;

    // Deduct credit for metered tiers
    if (METERED_TIERS.includes(tier)) {
      await supabaseAdmin
        .from('shops')
        .update({ ai_credits: shop.ai_credits - 1 })
        .eq('id', shop.id);
    }

    return NextResponse.json({
      message: finalMessage,
      aiContent: aiMessage,
      storeLink,
      creditsRemaining: METERED_TIERS.includes(tier) ? Math.max(0, shop.ai_credits - 1) : null,
      tier,
      wordCount
    });

  } catch (error) {
    console.error('Campaign generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate campaign message. Please try again.' },
      { status: 500 }
    );
  }
}
