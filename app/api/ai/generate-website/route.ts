import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { generateWithFallback } from '@/lib/llm';
import { ELITE_COPY_RULES } from '@/lib/adCopy';
import {
  SITE_TEMPLATES,
  TEMPLATE_KEYS,
  WebsiteConfigSchema,
  templateFromCategory,
  type TemplateKey,
} from '@/lib/siteTemplates';

// AI Website Generator — Advanced tier only. Studies the shop's inventory,
// picks the niche-matched template, writes every line of site copy in the
// elite voice, and upserts the result as the shop's website draft.
export const maxDuration = 120;

const WEBSITE_TIERS = ['advanced', 'flagship'];

export async function POST(req: Request) {
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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    // ── Tier gate ─────────────────────────────────────────────────────────
    const { data: shop } = await supabase
      .from('shops')
      .select('id, shop_name, shop_slug, logo_url, banner_url, bio, subscription_tier')
      .eq('id', user.id)
      .single();

    if (!shop) {
      return NextResponse.json({ error: 'Shop profile not found.' }, { status: 404 });
    }

    const tier = (shop.subscription_tier ?? '').toLowerCase().trim();
    if (!WEBSITE_TIERS.includes(tier)) {
      return NextResponse.json(
        { error: 'The AI Website Generator is an Advanced-tier feature. Upgrade to unlock your generated storefront.' },
        { status: 403 }
      );
    }

    // ── Optional template override ────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const templateOverride: string | undefined = body?.templateOverride;
    if (templateOverride && !(TEMPLATE_KEYS as readonly string[]).includes(templateOverride)) {
      return NextResponse.json(
        { error: `templateOverride must be one of: ${TEMPLATE_KEYS.join(', ')}.` },
        { status: 400 }
      );
    }

    // ── Inventory ─────────────────────────────────────────────────────────
    const { data: products } = await supabase
      .from('products')
      .select('id, name, description, category, price, image_url, ad_video_url, ad_hero_image_url')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30);

    if (!products || products.length === 0) {
      return NextResponse.json(
        { error: 'Add at least one product before generating your website.' },
        { status: 400 }
      );
    }

    // Dominant category → deterministic template hint for the prompt.
    const categoryCounts = new Map<string, number>();
    for (const p of products) {
      const c = (p.category ?? '').toLowerCase();
      if (c) categoryCounts.set(c, (categoryCounts.get(c) ?? 0) + 1);
    }
    const dominantCategory = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const heuristicTemplate = templateFromCategory(dominantCategory);

    const inventorySummary = products
      .slice(0, 15)
      .map((p) => `- ${p.name} (${p.category ?? 'uncategorised'}${p.price ? `, D${p.price}` : ''})${p.description ? `: ${String(p.description).slice(0, 120)}` : ''}`)
      .join('\n');

    const templateCatalog = Object.values(SITE_TEMPLATES)
      .map((t) => `- "${t.key}" — ${t.name} (${t.niche}): ${t.description}`)
      .join('\n');

    const templateConstraint = templateOverride
      ? `TEMPLATE CONSTRAINT: the seller has explicitly chosen the "${templateOverride}" template. You MUST set template_key to "${templateOverride}" and write niche_reasoning explaining how this template will be styled for their inventory.`
      : `TEMPLATE SELECTION: choose the single best template_key for this inventory. Heuristic suggestion based on the dominant category ("${dominantCategory ?? 'unknown'}"): "${heuristicTemplate}" — but override it if the actual product mix clearly fits another niche better. Explain your choice in niche_reasoning.`;

    // ── Prompt split for Anthropic cache_control ──────────────────────────
    // STATIC block (cachedSystem): every instruction that is byte-identical on
    // all requests — role, template catalog (built from SITE_TEMPLATES
    // constants), elite copy rules, and the full output field spec. This is
    // the massive stable prefix the ephemeral cache keys on.
    // DYNAMIC block (prompt): shop identity, inventory, and the per-request
    // template constraint — anything here in the cached block would silently
    // kill every cache hit.
    const cachedSystem = `You are the brand director for Sanndikaa, generating a COMPLETE premium storefront website for one of our sellers.

AVAILABLE TEMPLATES:
${templateCatalog}

Write every copy field in the elite voice. The site must read like a brand that has existed for years — confident, specific to THIS inventory, never generic. Reference actual product qualities (materials, ingredients, categories) from the inventory the user provides.

${ELITE_COPY_RULES}

(The 3-5 word limit above applies ONLY to cta_banner.button_label. Other fields follow their own length limits below.)

Return a JSON object:
- "template_key"     : one of ${TEMPLATE_KEYS.map((k) => `"${k}"`).join(' | ')}
- "niche_reasoning"  : 1-2 sentences on why this template fits this inventory
- "site": {
    "tagline"          : 3-8 word brand essence line (max 80 chars)
    "hero_headline"    : 4-10 word headline (max 90 chars) — sensory, not salesy
    "hero_subheadline" : 1-2 sentence supporting line (max 200 chars)
    "brand_story"      : 2-3 sentence origin/craft story in the brand's voice (max 600 chars)
    "value_props"      : EXACTLY 3 items, each { "title": max 60 chars, "body": one sentence max 200 chars }
    "collection_title" : 2-5 word collection heading (max 60 chars)
    "collection_intro" : one sentence introducing the products (max 240 chars)
    "cta_banner"       : { "headline": max 90 chars, "subtext": max 200 chars, "button_label": 2-5 words }
    "seo"              : { "title": max 70 chars including the shop name, "description": max 170 chars }
  }`;

    const prompt = `SHOP:
- Name: ${shop.shop_name}
${shop.bio ? `- Bio: ${shop.bio}` : ''}

INVENTORY (${products.length} products, first 15 shown):
${inventorySummary}

${templateConstraint}`;

    const { data: config, provider } = await generateWithFallback({
      schema: WebsiteConfigSchema,
      prompt,
      cachedSystem,
      callerName: 'generate-website',
    });

    // Belt-and-suspenders: enforce the override even if the model drifted.
    if (templateOverride) {
      config.template_key = templateOverride as TemplateKey;
    }

    console.log(`[generate-website] Config by ${provider} for shop ${shop.id}: template=${config.template_key} — ${config.niche_reasoning}`);

    // ── Upsert draft (preserve published status on regeneration) ──────────
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: existing } = await admin
      .from('shop_websites')
      .select('status')
      .eq('shop_id', shop.id)
      .maybeSingle();

    const { data: website, error: upsertError } = await admin
      .from('shop_websites')
      .upsert(
        {
          shop_id: shop.id,
          template_key: config.template_key,
          config,
          niche_reasoning: config.niche_reasoning,
          status: existing?.status === 'published' ? 'published' : 'draft',
          generated_at: new Date().toISOString(),
        },
        { onConflict: 'shop_id' }
      )
      .select()
      .single();

    if (upsertError || !website) {
      console.error('[generate-website] Upsert failed:', upsertError);
      return NextResponse.json({ error: 'Failed to save the generated website.' }, { status: 500 });
    }

    return NextResponse.json(website);
  } catch (error: any) {
    console.error('[generate-website] fatal:', error);
    const msg: string = error?.message || '';
    const isBusy =
      error?.status === 429 || error?.status === 503 ||
      msg.includes('429') || msg.includes('503') ||
      msg.toLowerCase().includes('overloaded') || msg.toLowerCase().includes('unavailable');
    if (isBusy) {
      return NextResponse.json(
        { error: 'The AI assistant is currently busy. Please try again in a moment.' },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: 'Failed to generate the website. Please try again.' }, { status: 500 });
  }
}
