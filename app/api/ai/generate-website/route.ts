import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { FLAGSHIP_CREATIVE_PROVIDER, generateWithFallback } from '@/lib/llm';
import { ELITE_COPY_RULES } from '@/lib/adCopy';
import { repairShopSlug, slugify } from '@/lib/slugify';
import { canUseStudio } from '@/lib/tiers';
import { runSiteAssetPhase } from '@/lib/siteAssets';
import {
  ACCENT_PRESET_SLOTS,
  ARCHETYPE_KEYS,
  ARCHETYPES,
  ConceptPairSchema,
  SITE_TEMPLATES,
  SiteConceptSchema,
  TEMPLATE_KEYS,
  WebsiteGenerationSchema,
  applyArchetype,
  applyGenerationLayout,
  archetypeLayoutBounds,
  buildPreviousDesign,
  classicLayoutBounds,
  generationToConfig,
  pickConceptArchetypes,
  templateFromCategory,
  type ArchetypeKey,
  type LayoutBounds,
  type SiteArchetype,
  type SiteConcept,
  type TemplateKey,
  type TestimonialSourceReview,
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
//
// ── INVOCATION ENVELOPE (raised 120 → 300 on 2026-09-02, claude-fable-5-1
// primary) ── one invocation carries everything below; the budgets must fit:
//   · LLM call (generateWithFallback, Fable primaryOverride): Fable's
//     adaptive-thinking turns run multi-minute, and a refusal/transient
//     cascade may serially fall through anthropic-fable → sonnet-5 → gemini
//     → gpt-4o-mini — budget ≈ 235s worst case.
//   · Config upsert + snapshot ritual + reviews read: single-digit seconds.
//   · Zero-click asset phase (runSiteAssetPhase): hero + logo in PARALLEL,
//     hard-capped by settle budgets at max(55s, 50s) = 55s — never more.
//   · Revalidation + response serialization: seconds.
//   ≈ 235 + 5 + 55 + 5 = 300. Clients must deadline ABOVE this envelope —
//   ALL steps, since the concepts step runs the same ≈235s-worst-case LLM
//   cascade (WebsiteGeneratorStudio CONSULT_TIMEOUT_MS 320s and
//   EXECUTE_TIMEOUT_MS 320s, MagicStorefrontBuilder GENERATION_TIMEOUT_MS
//   320s) so the server always self-reports first.
// PROMPT/CACHE LAW: the model switch alone opens a fresh prompt-cache
// namespace — prompt text stays BYTE-IDENTICAL, so the Fable namespace warms
// from the second call. cachedSystem + providerOptions.anthropic.cacheControl
// directives work unchanged on Fable.
export const maxDuration = 300;

// Tier gate: lib/tiers canUseStudio — Pro+ (Studio moved down to Pro,
// founder matrix 2026-08-29; legacy 'advanced' payers keep access).

/** Per-build lever bounds for the DYNAMIC prompt (entropy engine): the
 *  archetype's — or the classic template's — composition, accent presets,
 *  display faces, and the dialect facts, so the model is never promised a
 *  lever its layout does not render. Per-request by nature (depends on the
 *  chosen archetype/template) — it must NEVER enter cachedSystem. */
function describeLayoutBounds(bounds: LayoutBounds): string {
  const gated = bounds.serverGated.length > 0
    ? ` — ${bounds.serverGated.join(', ')} is filled from this shop's REAL reviews and dropped when none exist; name where it should sit if it does`
    : '';
  return [
    `- Sections available, default order: ${bounds.blockMix.join(' → ')}${gated}`,
    bounds.orderHonored
      ? '- block_order: honored — the page renders sections in your order (hero_banner first, product_grid present, no repeats; omitted sections ship hidden).'
      : '- block_order: this layout renders a FIXED anatomy — your order controls inclusion only (hero_banner first, product_grid present; omitted sections ship hidden).',
    bounds.carouselHonored
      ? '- product_grid_display: "grid" | "carousel"'
      : '- product_grid_display: not rendered on this layout (fixed benefit rows) — omit it.',
    `- theme_preset_index: ${bounds.accentPresets.map((p, i) => `${i} = ${p.name}${i === 0 ? ' (default)' : ''}`).join(' · ')}`,
    bounds.displayFonts.length > 0
      ? `- display_font: ${bounds.displayFonts.map((f, i) => `${f}${i === 0 ? ' (default)' : ''}`).join(' | ')}`
      : '- display_font: fixed on this layout (native grotesque) — omit it.',
  ].join('\n');
}

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

    // ── DEV HARNESS (local dry-run) ───────────────────────────────────────
    // Reachable ONLY when NODE_ENV !== 'production' AND the request carries
    // the header `x-sanndikaa-dev-harness: 1`. Production builds (Vercel,
    // `next build`/`next start`) set NODE_ENV=production, so this branch is
    // unreachable there BY CONSTRUCTION — it is not a runtime toggle and no
    // env var can enable it in a deployed build. In harness mode: the auth +
    // tier gates are skipped, seller data comes INLINE from body.sellerData,
    // and NOTHING is persisted — no slug repair, no upsert, no asset
    // generation, no revalidation. The LLM call is real (it costs real
    // tokens) so the entropy engine's structural decisions can be inspected
    // exactly as production would assemble them.
    const devHarness =
      process.env.NODE_ENV !== 'production' && req.headers.get('x-sanndikaa-dev-harness') === '1';
    const harnessBody: Record<string, unknown> | null = devHarness
      ? await req.clone().json().catch(() => ({}))
      : null;
    const harnessSeller = (harnessBody?.sellerData ?? null) as
      | { shop_name?: unknown; bio?: unknown; products?: unknown; reviews?: unknown }
      | null;
    if (devHarness) {
      console.warn('[generate-website] DEV HARNESS ACTIVE — gates skipped, dry-run, no writes.');
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user && !devHarness) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    // ── Tier gate ─────────────────────────────────────────────────────────
    const harnessShopName =
      typeof harnessSeller?.shop_name === 'string' && harnessSeller.shop_name.trim()
        ? harnessSeller.shop_name.trim()
        : 'Harness Boutique';
    const shop = devHarness
      ? {
          id: 'dev-harness-shop',
          shop_name: harnessShopName,
          shop_slug: slugify(harnessShopName),
          logo_url: null as string | null,
          banner_url: null as string | null,
          bio: typeof harnessSeller?.bio === 'string' ? harnessSeller.bio : null,
          subscription_tier: 'pro',
        }
      : (
          await supabase
            .from('shops')
            .select('id, shop_name, shop_slug, logo_url, banner_url, bio, subscription_tier')
            .eq('id', user!.id)
            .single()
        ).data;

    if (!shop) {
      return NextResponse.json({ error: 'Shop profile not found.' }, { status: 404 });
    }

    if (!devHarness && !canUseStudio(shop.subscription_tier)) {
      return NextResponse.json(
        { error: 'The AI Website Studio is a Pro-tier feature. Upgrade to unlock your generated storefront.' },
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

    // ── Variation seed (entropy engine — BOTH AI steps) ───────────────────
    // OPTIONAL on concepts AND execute. Concepts: a "Design New Concepts"
    // click mints a fresh seed client-side so the archetype pair AND the pitch
    // copy vary per click. Execute: the studio re-posts the SAME seed its
    // concepts were pitched under (coherence — the concept pitched under S is
    // built under S), and onboarding's one-click builder mints its own per
    // click, so no two generations are identical (founder mandate). Absent →
    // the unseeded legacy behavior (pre-seed clients stay valid). Validated
    // to a short safe token: it is folded into the pick hash AND echoed into
    // the DYNAMIC LLM prompt — never the cached block — so it must never
    // carry free-form text.
    const rawSeed: unknown = body?.variationSeed;
    let variationSeed: string | null = null;
    if (rawSeed !== undefined && rawSeed !== null) {
      const asString =
        typeof rawSeed === 'number' && Number.isFinite(rawSeed)
          ? String(rawSeed)
          : typeof rawSeed === 'string'
            ? rawSeed.trim()
            : null;
      if (asString === null || !/^[A-Za-z0-9._-]{1,64}$/.test(asString)) {
        return NextResponse.json(
          { error: 'variationSeed must be a short alphanumeric string or number.' },
          { status: 400 }
        );
      }
      variationSeed = asString;
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
    // Dev harness: never write — the synthesized slug is already canonical.
    const canonicalSlug = devHarness ? shop.shop_slug : await repairShopSlug(admin, shop);

    // ── Fast path: dashboard-initiated slug repair (no AI, no writes beyond
    // the repair itself). Lets "View Live Site" work for pre-existing
    // websites on plain dashboard load, without a generate/publish first —
    // including the collision case, where the repair suffixes the slug and
    // returns the value this shop actually owns.
    if (step === 'repair-slug') {
      return NextResponse.json({ step: 'repair-slug', shop_slug: canonicalSlug });
    }

    // ── Inventory ─────────────────────────────────────────────────────────
    type InventoryRow = {
      id: string;
      name: string;
      description: string | null;
      category: string | null;
      price: number | string | null;
      image_url: string | null;
      ad_video_url: string | null;
      ad_hero_image_url: string | null;
    };
    let products: InventoryRow[] | null = null;
    if (devHarness) {
      // Inline inventory from the harness body — synthesized ids, no media.
      const raw = Array.isArray(harnessSeller?.products) ? (harnessSeller!.products as unknown[]) : [];
      products = raw
        .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object' && typeof (p as Record<string, unknown>).name === 'string')
        .map((p, i) => ({
          id: `harness-product-${i + 1}`,
          name: p.name as string,
          description: typeof p.description === 'string' ? p.description : null,
          category: typeof p.category === 'string' ? p.category : null,
          price: typeof p.price === 'number' || typeof p.price === 'string' ? p.price : null,
          image_url: null,
          ad_video_url: null,
          ad_hero_image_url: null,
        }));
    } else {
      const { data } = await supabase
        .from('products')
        .select('id, name, description, category, price, image_url, ad_video_url, ad_hero_image_url')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(30);
      products = data as InventoryRow[] | null;
    }

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
    // STEP 1 — Design consultation: two distinct ARCHETYPE pitches (Pillar 3).
    // An archetype = (template base × theme preset × block mix) bundle; the
    // TWO pitched per shop come from pickConceptArchetypes — niche-fitting
    // candidates rotated by the shop-id hash, so two cosmetics shops are
    // pitched different pairs (deterministic variety, stable per shop). A
    // variationSeed (explicit regeneration) folds into that hash so repeat
    // clicks rotate the pair instead of replaying it.
    // ═══════════════════════════════════════════════════════════════════════
    if (step === 'concepts') {
      const [primary, secondary] = pickConceptArchetypes(shop.id, dominantCategory, variationSeed);

      // STATIC block (cachedSystem): byte-identical on every request — role,
      // the FULL archetype catalog (built from ARCHETYPES constants), copy
      // rules, and the output field spec. Changed ONCE for the archetype
      // pass and byte-stable from here — the per-request pair assignment
      // lives ONLY in `prompt`.
      const archetypeCatalog = Object.values(ARCHETYPES)
        .map((a) => `- "${a.key}" (renders on the "${a.template_key}" layout — ${SITE_TEMPLATES[a.template_key].name}): ${a.name}. ${a.vibe} Voice: ${a.copyDirection}`)
        .join('\n');

      const cachedSystem = `You are the creative director for Sanndikaa, running a design consultation for one of our sellers. Propose exactly TWO distinct premium storefront concepts they will choose between. This is positioning copy only — short, evocative, decisive. Do NOT write the full site.

THE ARCHETYPE CATALOG (each bundles a layout, a palette direction, and a voice):
${archetypeCatalog}

The user names the TWO archetypes to pitch. Write exactly one concept per named archetype, in the order given, honoring that archetype's vibe and voice precisely. Each concept must feel like it came from a different creative agency: different mood, different angle on the same inventory. Ground every line in the actual products (materials, ingredients, categories) the user provides.

${ELITE_COPY_RULES}

(The 3-5 word limit above is the voice standard, not a hard cap here. Each field follows its own length limit below.)

Return a JSON object:
- "niche_reasoning" : 1-2 sentences on this shop's niche and why these two directions suit it
- "concepts"        : EXACTLY 2 items, in the user's archetype order, each:
  {
    "template_key"     : the named archetype's layout key (one of ${TEMPLATE_KEYS.map((k) => `"${k}"`).join(' | ')})
    "archetype_key"    : the named archetype's key, verbatim
    "concept_name"     : evocative 2-4 word concept title (max 60 chars) — like an agency pitch name
    "tagline"          : 3-8 word brand essence line (max 80 chars)
    "vibe"             : 1-2 sentences describing the mood and feel of this direction (max 240 chars)
    "palette"          : short palette + styling summary, e.g. "Ivory, sage, hand-drawn serifs" (max 160 chars)
    "hero_headline"    : 4-10 word sample hero headline (max 90 chars) — sensory, not salesy
    "hero_subheadline" : 1-2 sentence sample hero support line (max 200 chars)
  }`;

      // CRITICAL CACHE LAW: the variation directive rides ONLY this dynamic
      // prompt — cachedSystem above stays byte-identical across requests so
      // the ephemeral prompt cache keeps hitting.
      const variationDirective = variationSeed
        ? `\n\nVARIATION SEED ${variationSeed} — this is an explicit REGENERATION: an earlier draft exists for this shop. Take a distinctly different creative angle this time (fresh concept names, fresh imagery, a different emotional register on the same inventory) — never repeat a previous pitch.`
        : '';

      const prompt = `SHOP:
- Name: ${shop.shop_name}
${shop.bio ? `- Bio: ${shop.bio}` : ''}

INVENTORY (${products.length} products, first 15 shown):
${inventorySummary}

PITCH THESE TWO ARCHETYPES, IN THIS ORDER:
1. "${primary.key}" — ${primary.name}
2. "${secondary.key}" — ${secondary.name}

NICHE CONTEXT: dominant category "${dominantCategory ?? 'unknown'}".${variationDirective}`;

      const { data: pair, provider } = await generateWithFallback({
        schema: ConceptPairSchema,
        prompt,
        cachedSystem,
        callerName: 'generate-website:concepts',
        // Flagship creative primary (claude-fable-5-1, website generation
        // only): refusals/transients cascade to sonnet-5 → gemini → 4o-mini.
        primaryOverride: FLAGSHIP_CREATIVE_PROVIDER,
      });

      // Belt-and-suspenders: deterministically PIN both concepts to the two
      // assigned archetypes (template + archetype key) even if the model
      // drifted — the pitch copy stays, the routing facts are ours.
      const assigned: [SiteArchetype, SiteArchetype] = [primary, secondary];
      pair.concepts.forEach((concept, i) => {
        concept.template_key = assigned[i].template_key;
        concept.archetype_key = assigned[i].key;
      });

      console.log(`[generate-website] Concepts by ${provider} for shop ${shop.id}: ${pair.concepts.map((c) => `${c.archetype_key}(${c.template_key})/"${c.concept_name}"`).join(' vs ')}`);

      return NextResponse.json({
        step: 'concepts',
        niche_reasoning: pair.niche_reasoning,
        concepts: pair.concepts,
        shop_slug: canonicalSlug,
      });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 2 — Execution: full pipeline for the chosen concept/template.
    // Archetype resolution (Pillar 3): a concept carrying archetype_key
    // executes as that bundle — theme preset + block mix applied after
    // generation. Concepts without it (pre-archetype clients, manual
    // templateOverride, the legacy no-step path) run the classic pipeline
    // byte-identically.
    // ═══════════════════════════════════════════════════════════════════════
    // Dev harness may name an archetype directly (no concept object needed).
    const harnessArchetypeKey =
      devHarness && typeof harnessBody?.archetype === 'string' ? harnessBody.archetype : null;
    const archetype: SiteArchetype | null =
      concept?.archetype_key
        ? ARCHETYPES[concept.archetype_key] ?? null
        : harnessArchetypeKey && (ARCHETYPE_KEYS as readonly string[]).includes(harnessArchetypeKey)
          ? ARCHETYPES[harnessArchetypeKey as ArchetypeKey]
          : null;

    // The archetype's base template ALWAYS wins over a drifted concept key —
    // the bundle is the contract the seller approved.
    const chosenTemplate: TemplateKey | undefined =
      archetype?.template_key ?? concept?.template_key ?? (templateOverride as TemplateKey | undefined);

    const archetypeDirection = archetype
      ? `\n\nARCHETYPE DIRECTION — the approved bundle is "${archetype.name}". ${archetype.vibe}\nVOICE: ${archetype.copyDirection}\nWrite the split_cta object for this site (see the field spec) — it renders as the two-panel conversion spread this archetype composes.`
      : '';

    const templateConstraint = concept
      ? `TEMPLATE CONSTRAINT: the seller approved the "${chosenTemplate ?? concept.template_key}" concept. You MUST set template_key to "${chosenTemplate ?? concept.template_key}" and write niche_reasoning explaining how this direction is styled for their inventory.

APPROVED CREATIVE DIRECTION — honor it precisely, refine and expand it into the full site, never contradict it:
- Concept: ${concept.concept_name}
- Tagline direction: ${concept.tagline}
- Vibe: ${concept.vibe}
- Palette & styling: ${concept.palette}
- Approved hero direction: "${concept.hero_headline}" — "${concept.hero_subheadline}"${archetypeDirection}`
      : chosenTemplate
        ? `TEMPLATE CONSTRAINT: the seller has explicitly chosen the "${chosenTemplate}" template. You MUST set template_key to "${chosenTemplate}" and write niche_reasoning explaining how this template will be styled for their inventory.`
        : `TEMPLATE SELECTION: choose the single best template_key for this inventory. Heuristic suggestion based on the dominant category ("${dominantCategory ?? 'unknown'}"): "${heuristicTemplate}" — but override it if the actual product mix clearly fits another niche better. Explain your choice in niche_reasoning.`;

    // ── Prompt split for Anthropic cache_control ──────────────────────────
    // STATIC block (cachedSystem): every instruction that is byte-identical on
    // all requests — the founder's ENTROPY ENGINE framing (<system_context>,
    // <architectural_rules>, <generation_task>), the template catalog (built
    // from SITE_TEMPLATES constants), elite copy rules, the brevity mandate,
    // and the full output field spec including the optional "layout" levers.
    // This is the massive stable prefix the ephemeral cache keys on. Changed
    // ONCE for the Phase-3 block model, ONCE for the Phase-8 brevity mandate,
    // ONCE for the archetype pass (split_cta), and ONCE MORE for the entropy
    // engine (founder sections + layout spec) — byte-stable again from here.
    // CACHE LAW: no per-request data inside. The only interpolations are
    // module constants (templateCatalog, TEMPLATE_KEYS, ELITE_COPY_RULES,
    // ACCENT_PRESET_SLOTS). The seed, the archetype, the shop, the inventory
    // and the layout BOUNDS are per-request and ride ONLY the dynamic prompt.
    // DYNAMIC block (prompt): <seller_data>, <chosen_archetype> (template
    // constraint / approved concept / archetype direction), <layout_bounds>,
    // and — when a seed was posted — the <entropy_engine> block. Anything
    // from there in the cached block would silently kill every cache hit.
    const cachedSystem = `<system_context>
Role: Principal E-Commerce Architect (Sanndikaa Studio).
Objective: Generate an elite, top 1% global e-commerce storefront for the provided seller.
Mandate: You are not filling out a template. You are engineering a bespoke, high-converting software interface. No two generations should ever be identical.
</system_context>

<architectural_rules>
1. Top-of-Food-Chain UX — already engineered; write for it:
   - Every page ships mobile-first: each product detail page carries a sticky bottom buy bar (price, variant chip, action button), the cart is a slide-out drawer (never a cart page), and every touch target is at least 44px. None of this is a field you output. Write copy that assumes this execution: lines that survive a phone screen, headlines that land above the fold, button labels that fit a thumb-width pill.
2. Dynamic Structural Permutation:
   - Analyze the <seller_data>. Do not just change the words — change the layout hierarchy to the seller's strengths through the "layout" object (field spec below): section order and inclusion, grid vs carousel for the collection, spacing and alignment rhythm per section, the accent preset, the display face. The <layout_bounds> in the user message state exactly what this build may draw from.
   - Visual-led inventory (fashion, craft, beauty, objects that sell on imagery): carousel collection, spacious rhythm, story late — let the products carry the page.
   - Spec-led inventory (tech, supplements, tools, anything bought on facts): grid collection, compact rhythm, value_props directly after the hero, story late.
3. Zero-Clutter Integrity:
   - NEVER use placeholder text (lorem ipsum) or generic marketing gibberish.
   - Write highly persuasive, niche-specific copy.
   - Use honest data. No fake countdown timers, invented counts, or fabricated reviews — testimonials are filled server-side from real reviews only.
</architectural_rules>

<generation_task>
Given the <seller_data> and <chosen_archetype> in the user message, output the complete, production-ready JSON structure mapping to our Next.js template anatomy — the field spec below. The user message also carries the <layout_bounds> and, when present, the <entropy_engine> seed.
</generation_task>

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
- "niche_reasoning"  : 1-2 sentences on why this template and your structural choices fit this inventory
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
- "seo"              : { "title": max 70 chars including the shop name, "description": target ~140 chars, max 170 }
- "split_cta"        : OPTIONAL — write it ONLY when the user's instructions ask for it. A two-panel conversion spread, distinct from "cta" (never repeat its copy): { "headline": target ~40 chars, max 90; "body": one sentence, target ~90 chars, max 200; "button_label": 2-5 words }
- "layout"           : OPTIONAL structural choices — every key optional, each validated against the <layout_bounds>; anything absent or outside them falls back to the default, so choose deliberately: {
    "block_order"          : ordered section types to show — hero_banner MUST be first, product_grid MUST be present, only types the bounds list, no repeats. Types you leave out ship hidden (the seller can restore them)
    "product_grid_display" : "grid" | "carousel"
    "block_padding"        : { <section type>: "compact" | "default" | "spacious" } — rhythm per section
    "block_align"          : { <section type>: "left" | "center" }
    "theme_preset_index"   : integer 0-${ACCENT_PRESET_SLOTS - 1} into the bounds' accent presets (0 = the default) — never a color value
    "display_font"         : one of the bounds' display faces
  }`;

    // ── Layout bounds (per-request → dynamic prompt) ───────────────────────
    // The archetype's blockMix/presets/faces, or the classic template's. When
    // the model picks the template itself (onboarding's one-click path) every
    // template's bounds are listed and the server applies the set matching
    // the returned template_key.
    const layoutBoundsText = archetype
      ? describeLayoutBounds(archetypeLayoutBounds(archetype))
      : chosenTemplate
        ? describeLayoutBounds(classicLayoutBounds(chosenTemplate))
        : TEMPLATE_KEYS
            .map((k) => `IF template_key is "${k}":\n${describeLayoutBounds(classicLayoutBounds(k))}`)
            .join('\n\n');

    // ── Entropy engine (per-request → dynamic prompt) ──────────────────────
    // The founder's block, mapped onto the REAL levers. Absent seed (a legacy
    // step-less body) → no block; the layout bounds still ride, so the
    // structural levers stay available to the model either way.
    const entropyEngine = variationSeed
      ? `

<entropy_engine>
Variation Seed: ${variationSeed}
Instruction: Use this seed to uniquely shuffle the section placements (block_order), alternate the accent mapping (theme_preset_index), rotate the typographic register (display_font) and the spacing/alignment rhythm (block_padding, block_align), and choose grid or carousel — all within the <layout_bounds> above. The resulting interface must be distinct from any previous generation for this niche, and the copy must take its own angle on the same inventory.
</entropy_engine>`
      : '';

    const prompt = `<seller_data>
SHOP:
- Name: ${shop.shop_name}
${shop.bio ? `- Bio: ${shop.bio}` : ''}

INVENTORY (${products.length} products, first 15 shown):
${inventorySummary}
</seller_data>

<chosen_archetype>
${templateConstraint}
</chosen_archetype>

<layout_bounds>
${layoutBoundsText}
</layout_bounds>${entropyEngine}`;

    const { data: generation, provider } = await generateWithFallback({
      schema: WebsiteGenerationSchema,
      prompt,
      cachedSystem,
      callerName: 'generate-website',
      // Flagship creative primary (claude-fable-5-1, website generation
      // only): refusals/transients cascade to sonnet-5 → gemini → 4o-mini.
      primaryOverride: FLAGSHIP_CREATIVE_PROVIDER,
    });

    // Deterministic assembly: block array with stable ids PLUS the legacy
    // site.* mirror via blocksToLegacySite — both representations stored
    // consistently, so block-driven templates and legacy consumers
    // (VitalityTemplate, tone bodies, seo metadata) read the same copy.
    let config = generationToConfig(generation);

    // Belt-and-suspenders: enforce the chosen template even if the model drifted.
    if (chosenTemplate) {
      config.template_key = chosenTemplate;
    }

    // ── Archetype application (Pillar 3) + entropy engine ─────────────────
    // Theme preset + block mix + the conditional new sections:
    //   · split_cta from the model's optional object (skipped when absent);
    //   · testimonials from REAL product reviews (rating ≥ 4 with substance)
    //     — the read is best-effort and a failure/empty result just means NO
    //     testimonials section (integrity law: never a fabricated quote —
    //     and the model's layout can only PLACE the slot, never conjure it).
    //   · the model's VALIDATED layout levers layered last (applyArchetype →
    //     applyGenerationLayout); anything absent/invalid falls back to the
    //     bundle default, so the pre-engine assembly is always the floor.
    // The classic path (no archetype) never enters this branch.
    if (archetype) {
      let reviewRows: TestimonialSourceReview[] | null = null;
      if (devHarness) {
        // Inline reviews from the harness body stand in for the reviews table.
        const raw = Array.isArray(harnessSeller?.reviews) ? (harnessSeller!.reviews as unknown[]) : [];
        reviewRows = raw
          .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
          .map((r) => ({
            rating: Number(r.rating),
            comment: typeof r.comment === 'string' ? r.comment : null,
            reviewer_name: typeof r.reviewer_name === 'string' ? r.reviewer_name : null,
            external_author: null,
            verified_purchase: r.verified_purchase === true,
          })) as TestimonialSourceReview[];
      } else try {
        const productIds = products.map((p) => p.id).filter(Boolean);
        if (productIds.length > 0) {
          const { data: reviews, error: reviewsError } = await admin
            .from('reviews')
            .select('rating, comment, reviewer_name, external_author, verified_purchase')
            .in('product_id', productIds)
            .gte('rating', 4)
            .order('created_at', { ascending: false })
            .limit(12);
          if (reviewsError) {
            console.warn('[generate-website] reviews read failed — testimonials skipped:', reviewsError.message);
          } else {
            reviewRows = (reviews ?? []) as TestimonialSourceReview[];
          }
        }
      } catch (reviewsFatal) {
        console.warn('[generate-website] reviews read threw — testimonials skipped:', reviewsFatal);
      }
      config = applyArchetype(config, archetype, generation, reviewRows);
      console.log(`[generate-website] Archetype "${archetype.key}" applied for shop ${shop.id}: blocks=[${(config.blocks ?? []).map((b) => b.type).join(', ')}]`);
    } else if (generation.layout) {
      // ── Entropy engine on the classic path ─────────────────────────────
      // No bundle to apply, but the structural levers still count — validated
      // against the CHOSEN template's classic bounds (five-block anatomy, the
      // template's own guard-cleared swatch table, curated faces). Absent
      // layout → this branch is skipped and the classic config is
      // byte-identical to the pre-engine pipeline.
      config = applyGenerationLayout(config, generation.layout, classicLayoutBounds(config.template_key));
    }

    if (generation.layout) {
      console.log(
        `[generate-website] Layout levers for shop ${shop.id} (${archetype ? archetype.key : `classic/${config.template_key}`}): ` +
        `${JSON.stringify(generation.layout)} → blocks=[${(config.blocks ?? []).map((b) => `${b.type}${b.hidden ? '(hidden)' : ''}`).join(', ')}] theme=${JSON.stringify(config.theme ?? null)}`
      );
    }

    console.log(`[generate-website] Config by ${provider} for shop ${shop.id}: template=${config.template_key} — ${config.niche_reasoning}`);

    // ── DEV HARNESS dry-run exit: return the assembled storefront BEFORE any
    // persistence (no upsert, no snapshot, no assets, no revalidation).
    if (devHarness) {
      return NextResponse.json({
        step: 'execute',
        dryRun: true,
        provider,
        archetype: archetype?.key ?? null,
        template_key: config.template_key,
        variationSeed,
        layout_bounds: layoutBoundsText,
        generation, // raw validated model output — including its "layout" levers
        config, // the assembled storefront config exactly as it would be upserted
      });
    }

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
    // Non-production builds surface the underlying error so local debugging
    // never has to guess behind the generic message. Production keeps the
    // generic copy only (NODE_ENV=production is set by every deployed build).
    const devDetail =
      process.env.NODE_ENV !== 'production'
        ? { detail: msg || String(error), status: err?.status ?? null }
        : {};
    if (isBusy) {
      return NextResponse.json(
        { error: 'The AI assistant is currently busy. Please try again in a moment.', ...devDetail },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to generate the website. Please try again.', ...devDetail },
      { status: 500 }
    );
  }
}
