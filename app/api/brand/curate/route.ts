import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// ─────────────────────────────────────────────────────────────────────────────
// Creative Director Agent — Server-side curation endpoint.
//
// 1. Authenticates merchant session via @supabase/ssr.
// 2. Transmits merchant's raw notes to Anthropic's Claude Sonnet 5.5.
// 3. Forces execution of the "sanndikaa_creative_director" tool schema.
// 4. Persists the curated tokens directly into shop_websites.
// ─────────────────────────────────────────────────────────────────────────────

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = 'claude-sonnet-5-5'; // Upgraded to Sonnet 5.5

// The Strict Sanndikaa Brand Bible System Prompt
const BRAND_BIBLE_SYSTEM_PROMPT = `You are a $50,000-a-month Creative Director at an elite luxury branding agency. Your job is to curate bespoke, ultra-premium e-commerce identities for independent boutiques on the Sanndikaa platform.

You do not write marketing copy. You write editorial truth. You act as a cynical, highly-paid fashion editor who despises salesy language, clutter, and desperation.

### RULE 1: THE LEXICON BAN (NEGATIVE CONSTRAINTS)
You are strictly forbidden from using the following words or any of their synonyms:
- Luxurious, luxury, premium, high-quality, exclusive, amazing, perfect, beautiful.
- Buy now, shop now, don't miss out, click here, sale.
- Affordable, cheap, bargain.

### RULE 2: THE SEMANTIC WHITELIST (POSITIVE CONSTRAINTS)
True luxury relies on provenance, material facts, and industrial weight. You must focus entirely on:
- Tactile feedback (e.g., "Heavy glass", "Friction zipper").
- Manufacturing origin (e.g., "Milled in Dakar", "Hand-poured").
- Physical measurements and material states (e.g., "12oz canvas", "Cold-pressed extraction").
- Restraint and negative space. Speak in absolutes.

### RULE 3: BREVITY ENFORCEMENT
- hero_kicker: Maximum 4 words. Stark and declarative.
- provenance_statement: Maximum 2 short sentences. State the origin.
- curation_heading: 1 to 3 words.
- material_truth_1 & material_truth_2: Maximum 8 words each. One physical fact per string.

### RULE 4: VISUAL CURATION
- palette_id: Select "banjul_forest" for organic/moody, "onyx_and_bone" for brutalist/streetwear, "terracotta_linen" for warm/skincare/textiles, or "midnight_chrome" for modern utility.
- typography_id: Select "editorial_serif" for heritage, "brutalist_mono" for streetwear, or "modernist_sans" for clean architectural lines.
- whatsapp_cta_tone: Select the conversion tone that matches the boutique's exclusivity.

### RULE 5: MERCHANT DATA INGESTION
You will receive raw, messy merchant input. Strip away all amateur marketing language and isolate only physical, material, or geographical facts.

### EXAMPLE EXECUTION
Merchant Input: "We sell amazing high quality leather bags for cheap! They are made in Italy and look super luxurious. Buy now for a great discount!"

Expected Output:
{
  "palette_id": "onyx_and_bone",
  "typography_id": "brutalist_mono",
  "hero_kicker": "Italian leather.",
  "provenance_statement": "Sourced and stitched in Florence. Built for daily friction.",
  "curation_heading": "The Archive",
  "material_truth_1": "Full-grain calfskin.",
  "material_truth_2": "Heavy oxidized brass hardware.",
  "whatsapp_cta_tone": "Inquire with the atelier"
}`;

// The Strict JSON Tool Schema
const CREATIVE_DIRECTOR_TOOL = {
  name: 'sanndikaa_creative_director',
  description: 'Curates the luxury tokens for the storefront matrix.',
  input_schema: {
    type: 'object',
    properties: {
      palette_id: {
        type: 'string',
        enum: ['onyx_and_bone', 'banjul_forest', 'terracotta_linen', 'midnight_chrome'],
        description: 'Select the pre-approved color palette.',
      },
      typography_id: {
        type: 'string',
        enum: ['editorial_serif', 'brutalist_mono', 'modernist_sans'],
        description: 'Select the pre-approved typography pairing.',
      },
      hero_kicker: {
        type: 'string',
        maxLength: 50,
        description: 'A stark, declarative 2-4 word statement. E.g., "Raw Gambian shea."',
      },
      provenance_statement: {
        type: 'string',
        maxLength: 120,
        description: 'Where and how it is made. Maximum two short sentences.',
      },
      curation_heading: {
        type: 'string',
        maxLength: 30,
        description: 'The title for the product grid. E.g., "The Edit", "The Atelier".',
      },
      material_truth_1: {
        type: 'string',
        maxLength: 60,
        description: 'One undeniable physical fact about the product.',
      },
      material_truth_2: {
        type: 'string',
        maxLength: 60,
        description: 'A second physical fact focusing on hardware or origin.',
      },
      whatsapp_cta_tone: {
        type: 'string',
        enum: [
          'Inquire with the atelier',
          'Reserve via WhatsApp',
          'Message the boutique',
          'Direct client inquiry',
        ],
        description: 'Luxury tone for the primary WhatsApp conversion button.',
      },
    },
    required: [
      'palette_id',
      'typography_id',
      'hero_kicker',
      'provenance_statement',
      'curation_heading',
      'material_truth_1',
      'material_truth_2',
      'whatsapp_cta_tone',
    ],
    additionalProperties: false,
  },
};

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  try {
    // 1. Session verification
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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.', code: 'unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const rawInput = body?.description?.trim();

    if (!rawInput || rawInput.length < 10) {
      return NextResponse.json(
        { error: 'Provide at least 10 characters detailing your products.', code: 'invalid_input' },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Creative engine is not configured.', code: 'not_configured' },
        { status: 503 }
      );
    }

    // 2. Call Anthropic with forced tool selection and updated Sonnet 5.5 headers
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1024,
        system: BRAND_BIBLE_SYSTEM_PROMPT,
        thinking: { type: 'between_tools' }, // Required to disable up-front thinking when forcing a tool on Sonnet 5.5
        tools: [CREATIVE_DIRECTOR_TOOL],
        tool_choice: { type: 'tool', name: 'sanndikaa_creative_director' },
        messages: [
          {
            role: 'user',
            content: `Merchant Inventory Description:\n"""\n${rawInput}\n"""`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[brand-curator] Anthropic API error:', response.status, errText);
      return NextResponse.json(
        { error: 'Failed to curate brand identity.', code: 'upstream_error' },
        { status: 502 }
      );
    }

    const payload = await response.json();
    const toolCall = payload.content?.find((block: { type: string }) => block.type === 'tool_use');

    if (!toolCall || toolCall.name !== 'sanndikaa_creative_director') {
      console.error('[brand-curator] Unexpected output format:', payload);
      return NextResponse.json(
        { error: 'Creative engine returned invalid tokens.', code: 'invalid_output' },
        { status: 502 }
      );
    }

    const curatedTokens = toolCall.input;

    // 3. Persist curated tokens to database using service-role client
    const admin = getAdmin();
    const { error: dbError } = await admin
      .from('shop_websites')
      .update({
        brand_tokens: curatedTokens,
        updated_at: new Date().toISOString(),
      })
      .eq('shop_id', user.id);

    if (dbError) {
      console.error('[brand-curator] Database save failed:', dbError);
      return NextResponse.json(
        { error: 'Failed to save curated identity.', code: 'db_error' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      tokens: curatedTokens,
    });
  } catch (error) {
    console.error('[brand-curator] Internal crash:', error);
    return NextResponse.json(
      { error: 'Internal server error.', code: 'internal' },
      { status: 500 }
    );
  }
}