import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { generateWithFallback } from '@/lib/llm';
import { ELITE_COPY_RULES } from '@/lib/adCopy';
import { repairShopSlug, slugify } from '@/lib/slugify';
import { runSiteAssetPhase } from '@/lib/siteAssets';
import {
  CONCEPT_TEMPLATE_KEYS,
  ConceptPairSchema,
  SITE_TEMPLATES,
  SiteConceptSchema,
  TEMPLATE_KEYS,
  WebsiteGenerationSchema,
  buildPreviousDesign,
  conceptTemplateFromCategory,
  generationToConfig,
  templateFromCategory,
  type SiteConcept,
  type TemplateKey,
} from '@/lib/siteTemplates';

// AI Website Generator — Advanced tier only. Two-step premium flow:
//   Step 1 ("concepts"): a fast design consultation. Studies the shop's
//     inventory and returns TWO distinct concepts (different templates, mock
//     positioning copy). Stateless — nothing is written except a slug repair.
//   Step 2 ("execute"): the seller picked a concept. Runs the full generation
//     pipeline for that template, honoring the approved creative direction,
//     and upserts the result as the shop's website draft.
//   "repair-slug": slug write-repair only — no AI call, no website writes.
//     The dashboard fires this on load when the stored slug is not canonical.
// Legacy contract preserved: a body without `step` executes directly (with the
// optional templateOverride), exactly as the original single-step generator.
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

    // ── Request body: step discriminator + optional concept/override ──────
    const body = await req.json().catch(() => ({}));
    const step: 'concepts' | 'execute' | 'repair-slug' =
      body?.step === 'concepts' ? 'concepts'
      : body?.step === 'repair-slug' ? 'repair-slug'
      : 'execute';

    const templateOverride: string | undefined = body?.templateOverride;
    if (templateOverride && !(TEMPLATE_KEYS as readonly string[]).includes(templateOverride)) {
      return NextResponse.json(
        { error: `templateOverride must be one of: ${TEMPLATE_KEYS.join(', ')}.` },
        { status: 400 }
      );
    }

    let concept: SiteConcept | null = null;
    if (step === 'execute' && body?.concept != null) {
      const parsedConcept = SiteConceptSchema.safeParse(body.concept);
      if (!parsedConcept.success) {
        return NextResponse.json(
          { error: 'The selected concept is invalid. Please run the design consultation again.' },
          { status: 400 }
        );
      }
      concept = parsedConcept.data;
    }

    // Service-role client: slug repair + website upsert.
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Law 2 slug safety: write-repair legacy slugs (spaces/uppercase from the
    // signup trigger) to the canonical lowercase-hyphenated form BEFORE the
    // client mints any /site link from this response. Runs ahead of the
    // inventory gate so a repair succeeds even for a shop with zero products.
    const canonicalSlug = await repairShopSlug(admin, shop);

    // ── Fast path: dashboard-initiated slug repair (no AI, no writes beyond
    // the repair itself). Lets "View Live Site" work for pre-existing
    // websites on plain dashboard load, without a generate/publish first —
    // including the collision case, where the repair suffixes the slug and
    // returns the value this shop actually owns.
    if (step === 'repair-slug') {
      return NextResponse.json({ step: 'repair-slug', shop_slug: canonicalSlug });
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

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 1 — Design consultation: two distinct concepts, no full pipeline.
    // The pitch is constrained to the TWO structurally distinct layouts
    // (CONCEPT_TEMPLATE_KEYS): 'ritual' = Minimal, 'editorial' = Editorial
    // magazine. 'vitality' remains render-valid for legacy rows/overrides but
    // is never offered here.
    // ═══════════════════════════════════════════════════════════════════════
    if (step === 'concepts') {
      const conceptCatalog = CONCEPT_TEMPLATE_KEYS
        .map((k) => {
          const t = SITE_TEMPLATES[k];
          return `- "${t.key}" — ${t.name} (${t.niche}): ${t.description}`;
        })
        .join('\n');

      // Concept-pair-safe heuristic for the dynamic hint below.
      const conceptHeuristic = conceptTemplateFromCategory(dominantCategory);

      // STATIC block (cachedSystem): byte-identical on every request — role,
      // layout catalog (built from SITE_TEMPLATES constants), copy rules,
      // and the output field spec. Per-request data lives ONLY in `prompt`.
      const cachedSystem = `You are the creative director for Sanndikaa, running a design consultation for one of our sellers. Propose exactly TWO distinct premium storefront concepts they will choose between. This is positioning copy only — short, evocative, decisive. Do NOT write the full site.

AVAILABLE LAYOUTS:
${conceptCatalog}

You MUST return exactly one concept per layout above — the two template_key values must be different, one for each layout. Each concept must feel like it came from a different creative agency: different mood, different angle on the same inventory. Ground every line in the actual products (materials, ingredients, categories) the user provides.

${ELITE_COPY_RULES}

(The 3-5 word limit above is the voice standard, not a hard cap here. Each field follows its own length limit below.)

Return a JSON object:
- "niche_reasoning" : 1-2 sentences on this shop's niche and why these two directions suit it
- "concepts"        : EXACTLY 2 items, each a DIFFERENT template_key, each:
  {
    "template_key"     : one of ${CONCEPT_TEMPLATE_KEYS.map((k) => `"${k}"`).join(' | ')}
    "concept_name"     : evocative 2-4 word concept title (max 60 chars) — like an agency pitch name
    "tagline"          : 3-8 word brand essence line (max 80 chars)
    "vibe"             : 1-2 sentences describing the mood and feel of this direction (max 240 chars)
    "palette"          : short palette + styling summary, e.g. "Ivory, sage, hand-drawn serifs" (max 160 chars)
    "hero_headline"    : 4-10 word sample hero headline (max 90 chars) — sensory, not salesy
    "hero_subheadline" : 1-2 sentence sample hero support line (max 200 chars)
  }`;

      const prompt = `SHOP:
- Name: ${shop.shop_name}
${shop.bio ? `- Bio: ${shop.bio}` : ''}

INVENTORY (${products.length} products, first 15 shown):
${inventorySummary}

NICHE HINT: dominant category "${dominantCategory ?? 'unknown'}" → heuristic layout "${conceptHeuristic}". Lead with the strongest-fit layout, then a genuinely different second direction.`;

      const { data: pair, provider } = await generateWithFallback({
        schema: ConceptPairSchema,
        prompt,
        cachedSystem,
        callerName: 'generate-website:concepts',
      });

      // Belt-and-suspenders: deterministically pin the pair to the two offered
      // layouts even if the model drifted (repeated a key, or reached for
      // 'vitality', which the shared SiteConceptSchema still accepts).
      const conceptKeys = CONCEPT_TEMPLATE_KEYS as readonly TemplateKey[];
      if (!conceptKeys.includes(pair.concepts[0].template_key)) {
        pair.concepts[0].template_key = conceptHeuristic;
      }
      const remaining = conceptKeys.find((k) => k !== pair.concepts[0].template_key)!;
      if (pair.concepts[1].template_key !== remaining) {
        pair.concepts[1].template_key = remaining;
      }

      console.log(`[generate-website] Concepts by ${provider} for shop ${shop.id}: ${pair.concepts.map((c) => `${c.template_key}/"${c.concept_name}"`).join(' vs ')}`);

      return NextResponse.json({
        step: 'concepts',
        niche_reasoning: pair.niche_reasoning,
        concepts: pair.concepts,
        shop_slug: canonicalSlug,
      });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 2 — Execution: full pipeline for the chosen concept/template.
    // ═══════════════════════════════════════════════════════════════════════
    const chosenTemplate: TemplateKey | undefined =
      concept?.template_key ?? (templateOverride as TemplateKey | undefined);

    const templateConstraint = concept
      ? `TEMPLATE CONSTRAINT: the seller approved the "${concept.template_key}" concept. You MUST set template_key to "${concept.template_key}" and write niche_reasoning explaining how this direction is styled for their inventory.

APPROVED CREATIVE DIRECTION — honor it precisely, refine and expand it into the full site, never contradict it:
- Concept: ${concept.concept_name}
- Tagline direction: ${concept.tagline}
- Vibe: ${concept.vibe}
- Palette & styling: ${concept.palette}
- Approved hero direction: "${concept.hero_headline}" — "${concept.hero_subheadline}"`
      : chosenTemplate
        ? `TEMPLATE CONSTRAINT: the seller has explicitly chosen the "${chosenTemplate}" template. You MUST set template_key to "${chosenTemplate}" and write niche_reasoning explaining how this template will be styled for their inventory.`
        : `TEMPLATE SELECTION: choose the single best template_key for this inventory. Heuristic suggestion based on the dominant category ("${dominantCategory ?? 'unknown'}"): "${heuristicTemplate}" — but override it if the actual product mix clearly fits another niche better. Explain your choice in niche_reasoning.`;

    // ── Prompt split for Anthropic cache_control ──────────────────────────
    // STATIC block (cachedSystem): every instruction that is byte-identical on
    // all requests — role, template catalog (built from SITE_TEMPLATES
    // constants), elite copy rules, and the full output field spec. This is
    // the massive stable prefix the ephemeral cache keys on. Changed ONCE for
    // the Phase-3 block model, ONCE more for the Phase-8 brevity mandate
    // (terseness exemption deleted; targets well under every cap; value_props
    // window 2-4), and byte-stable again from here — no per-request data
    // inside.
    // DYNAMIC block (prompt): shop identity, inventory, and the per-request
    // template constraint / approved concept — anything here in the cached
    // block would silently kill every cache hit.
    const cachedSystem = `You are the brand director for Sanndikaa, generating a COMPLETE premium storefront website for one of our sellers. The site is assembled from content blocks — you write the copy for every block.

AVAILABLE TEMPLATES:
${templateCatalog}

Write every copy field in the elite voice. The site must read like a brand that has existed for years — confident, specific to THIS inventory, never generic. Reference actual product qualities (materials, ingredients, categories) from the inventory the user provides.

${ELITE_COPY_RULES}

BREVITY MANDATE — BINDING FOR EVERY FIELD:
- Extreme brevity is the luxury register. Aim well under every cap below; whitespace is the product.
- No conversational filler, no marketing throat-clearing, no lead-ins ("Welcome to", "Discover our", "At [shop], we"). Open on the substance.
- Every field has a hard cap AND a TARGET well under it. Write to the target; the cap is a ceiling, never a goal.
- One idea per field. If a sentence can lose a clause and keep its meaning, lose the clause.

Return a JSON object:
- "template_key"     : one of ${TEMPLATE_KEYS.map((k) => `"${k}"`).join(' | ')}
- "niche_reasoning"  : 1-2 sentences on why this template fits this inventory
- "hero"             : the opening banner block — {
    "tagline"     : 3-6 word brand essence line (target ~30 chars, max 80)
    "headline"    : 4-8 word headline (target ~45 chars, max 90) — sensory, not salesy
    "subheadline" : ONE short sentence (target ~110 chars, max 200)
  }
- "value_props"      : the trust band block — 2 to 4 items (3 when unsure), each { "title": 2-4 words (target ~25 chars, max 60), "body": one tight sentence (target ~90 chars, max 200) }
- "product_grid"     : the collection section block — {
    "title" : 2-4 word collection heading (target ~20 chars, max 60)
    "intro" : one sentence introducing the products (target ~110 chars, max 240)
  }
- "story"            : the brand-story block — { "body": 2-3 short sentences of origin/craft in the brand's voice (target ~280 chars, max 600) }
- "cta"              : the closing banner block — { "headline": target ~40 chars, max 90; "subtext": one sentence, target ~90 chars, max 200; "button_label": 2-5 words }
- "seo"              : { "title": max 70 chars including the shop name, "description": target ~140 chars, max 170 }`;

    const prompt = `SHOP:
- Name: ${shop.shop_name}
${shop.bio ? `- Bio: ${shop.bio}` : ''}

INVENTORY (${products.length} products, first 15 shown):
${inventorySummary}

${templateConstraint}`;

    const { data: generation, provider } = await generateWithFallback({
      schema: WebsiteGenerationSchema,
      prompt,
      cachedSystem,
      callerName: 'generate-website',
    });

    // Deterministic assembly: block array with stable ids PLUS the legacy
    // site.* mirror via blocksToLegacySite — both representations stored
    // consistently, so block-driven templates and legacy consumers
    // (VitalityTemplate, tone bodies, seo metadata) read the same copy.
    const config = generationToConfig(generation);

    // Belt-and-suspenders: enforce the chosen template even if the model drifted.
    if (chosenTemplate) {
      config.template_key = chosenTemplate;
    }

    console.log(`[generate-website] Config by ${provider} for shop ${shop.id}: template=${config.template_key} — ${config.niche_reasoning}`);

    // ── Upsert draft (preserve published status on regeneration) ──────────
    const { data: existing } = await admin
      .from('shop_websites')
      .select('status, config')
      .eq('shop_id', shop.id)
      .maybeSingle();

    // ── THE SNAPSHOT RITUAL (Item 5) — written immediately before the
    // wholesale upsert whenever a prior config exists: the outgoing design
    // (copy edits, seller-added sections, theme, assets) survives as
    // config.previous, restorable from the studio hub. buildPreviousDesign
    // is non-recursive (the prior's own previous is never carried) and lax
    // (a legacy/invalid prior still snapshots — the restore route is the
    // strict gate).
    if (existing?.config) {
      const previous = buildPreviousDesign(existing.config);
      if (previous) config.previous = previous;
    }

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

    // ── Zero-click asset phase (EXECUTE step only — never for concepts) ────
    // Runs AFTER the copy/config upsert succeeded and patches the row via a
    // SECOND service-role update: a crash or timeout mid-assets can never
    // lose the saved site. Every failure inside runSiteAssetPhase is a
    // graceful skip (hero AND logo are gpt-image-2 over the OpenAI key —
    // the hero is a pure abstract atmosphere, so photo-less shops generate
    // too) — onboarding NEVER blocks on assets.
    let finalWebsite = website;
    try {
      const assets = await runSiteAssetPhase({
        admin,
        shop: { id: shop.id, shop_name: shop.shop_name },
        config,
      });
      if (assets) {
        const { data: patched, error: patchError } = await admin
          .from('shop_websites')
          .update({ config: { ...config, assets } })
          .eq('shop_id', shop.id)
          .select()
          .single();
        if (patchError || !patched) {
          console.warn('[generate-website] Asset patch failed (site itself is saved):', patchError);
        } else {
          finalWebsite = patched;
          console.log(`[generate-website] Assets attached for shop ${shop.id}: hero=${Boolean(assets.hero_image_url)} logo=${Boolean(assets.logo_url)}`);
        }
      }
    } catch (assetError) {
      // Belt-and-suspenders: the phase resolves-null by design, but even an
      // unexpected throw must never fail a generation that already saved.
      console.warn('[generate-website] Asset phase skipped:', assetError);
    }

    // ── Cache bust: the live /site route must serve this config on the very
    // next request. Path revalidation covers the concrete URL (query strings
    // like ?preview=1 share the same path entry); the '/site/[slug]' page-level
    // call clears the dynamic segment's route cache. The omnichannel router's
    // nested pages (collections, product detail) render the same config
    // through the same chrome, so they bust together.
    revalidatePath(`/site/${canonicalSlug}`);
    revalidatePath(`/site/${canonicalSlug}/collections`);
    if (shop.shop_slug && shop.shop_slug !== canonicalSlug) {
      // Slug was write-repaired mid-request: bust the pre-repair paths too,
      // encoded exactly as a legacy raw slug appears in a shared URL.
      revalidatePath(`/site/${encodeURIComponent(shop.shop_slug)}`);
      revalidatePath(`/site/${encodeURIComponent(shop.shop_slug)}/collections`);
    }
    revalidatePath('/site/[slug]', 'page');
    revalidatePath('/site/[slug]/collections', 'page');
    // Per-product pages cannot be enumerated here — the page-level call
    // clears the whole dynamic PDP segment.
    revalidatePath('/site/[slug]/products/[id]', 'page');
    // LIVE tag: the /site Data Cache (app/site/[slug]/siteData.ts) keys its
    // website-row/products entries on exactly this tag — the fresh config
    // lands on the very next request. Next 16 signature: the 'max' profile
    // expires the tag immediately.
    revalidateTag(`site:${shop.id}`, 'max');
    // The slug→shop lookup caches under the NORMALIZED slug (shop id is the
    // lookup's result, so it can't carry the per-shop tag) — bust the
    // canonical entry and, after a mid-request repair, the pre-repair one.
    revalidateTag(`site:slug:${canonicalSlug}`, 'max');
    const preRepairSlug = slugify(shop.shop_slug);
    if (preRepairSlug && preRepairSlug !== canonicalSlug) {
      revalidateTag(`site:slug:${preRepairSlug}`, 'max');
    }

    // Full row (dashboard contract, asset-patched when the phase produced
    // anything) + the canonical slug for link minting.
    return NextResponse.json({ ...finalWebsite, shop_slug: canonicalSlug });
  } catch (error) {
    console.error('[generate-website] fatal:', error);
    const err = error as { status?: number; message?: string } | null;
    const msg: string = err?.message || '';
    const isBusy =
      err?.status === 429 || err?.status === 503 ||
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
