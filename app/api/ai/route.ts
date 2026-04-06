import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const METERED_TIERS = ['starter', 'pro'];
const UNLIMITED_TIERS = ['advanced', 'flagship'];

export async function POST(req: Request) {
  try {
    // ========================================
    // 1. AUTHENTICATION: Identify the user
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
      console.warn('Unauthorized access attempt to /api/ai');
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to use AI features.' },
        { status: 401 }
      );
    }

    // ========================================
    // 2. TIER & CREDIT CHECK: Query user's shop
    // ========================================
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .select('id, subscription_tier, ai_credits')
      .eq('owner_email', user.email)
      .single();

    if (shopError || !shop) {
      console.error(`Shop not found for user ${user.email}:`, shopError);
      return NextResponse.json(
        { error: 'Shop profile not found. Please complete registration.' },
        { status: 404 }
      );
    }

    // ========================================
    // 3. ENFORCE TIER RESTRICTIONS
    // ========================================
    const tier = shop.subscription_tier?.toLowerCase() || '';

    // Block if user hasn't paid (pending or suspended)
    if (tier === 'pending' || tier === 'suspended') {
      return NextResponse.json(
        {
          error: 'Account not active. Please complete payment to unlock AI features.',
          tier: tier,
        },
        { status: 403 }
      );
    }

    // If metered tier (starter/pro), check credit balance
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
    // 4. PARSE REQUEST INPUT
    // ========================================
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invalid request. "prompt" is required and must be a non-empty string.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;

    // ========================================
    // 5. EXECUTION: Call OpenAI API
    // ========================================
    let description: string | null = null;

    if (apiKey) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content:
                  'You are an elite luxury fashion copywriter for a high-end boutique marketplace called Sanndikaa. Write a persuasive, SEO-optimized, luxury product description (under 80 words) with 3-4 bullet points at the end.',
              },
              {
                role: 'user',
                content: `Write a product description for: ${prompt}`,
              },
            ],
          }),
        });

        const data = await response.json();

        if (data.choices?.[0]?.message?.content) {
          description = data.choices[0].message.content;
        } else {
          console.warn(
            'OpenAI API returned incomplete response. Falling back to simulation.',
            data
          );
        }
      } catch (openAiError) {
        console.error('Failed to connect to OpenAI. Falling back to simulation.', openAiError);
      }
    } else {
      console.warn('OPENAI_API_KEY not configured. Running in simulation mode.');
    }

    // Fallback to simulation if OpenAI failed
    if (!description) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      description = `Experience the perfect blend of luxury and comfort with the ${prompt}. Crafted with premium materials, this piece elevates your everyday style. Featuring a sleek silhouette and unparalleled attention to detail, it is a must-have addition to your collection.\n\n• Premium quality materials\n• Designed for maximum comfort\n• Highly versatile and stylish\n• Limited District availability`;
    }

    // ========================================
    // 6. DEDUCTION: Decrement credits for metered tiers
    // ========================================
    if (METERED_TIERS.includes(tier)) {
      const { error: updateError } = await supabase
        .from('shops')
        .update({ ai_credits: shop.ai_credits - 1 })
        .eq('id', shop.id);

      if (updateError) {
        console.error(`Failed to decrement AI credits for shop ${shop.id}:`, updateError);
        // Log the error but still return the description (credit deduction is secondary)
        // In production, you might want to implement a retry mechanism or alerting
      }
    }

    // ========================================
    // 7. RETURN SUCCESS RESPONSE
    // ========================================
    return NextResponse.json(
      {
        description,
        creditsRemaining: METERED_TIERS.includes(tier) ? shop.ai_credits - 1 : null,
        tier,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Fatal API Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate description. Please try again.' },
      { status: 500 }
    );
  }
}