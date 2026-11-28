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

/** TEMPORARY testing switch, env-controlled only (ENFORCE_QUOTA). 'true' =
 *  the 402 QUOTA_EXCEEDED gate is enforced; anything else = unlimited
 *  generations. No billing/quota code is removed. */
const ENFORCE_GENERATION_QUOTA = process.env.ENFORCE_QUOTA === 'true';
import {
MatrixWebsiteGenerationSchema,
  FEATURED_MAX,
  selectFeaturedProducts,
  ACCENT_PRESET_SLOTS,
  ARCHETYPE_KEYS,
  ARCHETYPES,
  ARCHITECTURES,
  ConceptPairSchema,
  DEFAULT_STOREFRONT_FAMILY,
  RITUAL_RECIPE_GENERATION_ENABLED,
  SITE_TEMPLATES,
  STOREFRONT_FAMILIES,
  STUDIO_NICHES,
  SUBTRACTION_TEMPLATE_KEY,
  SiteConceptSchema,
  TEMPLATE_KEYS,
  WebsiteGenerationSchema,
  applyArchetype,
  applyExpressionSelection,
  applyGenerationLayout,
  archetypeLayoutBounds,
  assignArchitecture,
  assignedRecipeGrid,
  alignAssignmentInputs,
  carryStorefrontDecision,
  composeVisualSystem,
  expressionFloorSignals,
  formatArchitectureAssignment,
  formatExpressionSelection,
  guardRecipeGridPick,
  isStorefrontDecision,
  selectGalleryExhibits,
  resolveHeroMedia,
  buildPreviousDesign,
  classicLayoutBounds,
  cleanStoreContent,
  generationToConfig,
  pickConceptArchetypes,
  templateFromCategory,
  type ArchetypeKey,
  type Architecture,
  type ArchitectureAssignment,
  type ExpressionSignals,
  type LayoutBounds,
  type SiteArchetype,
  type SiteConcept,
  type StorefrontDecision,
  type TemplateKey,
  type TestimonialSourceReview,
  type WebsiteConfig,
  type WebsiteGeneration,
  type WebsiteLayout,
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

/** Copy-integrity directives for the DYNAMIC prompt ONLY. Cache law: the
 *  cached prefix (cachedSystem) stays byte-identical, so this block rides the
 *  per-request user message next to <seller_data> in BOTH AI steps — the
 *  consultation pitches a hero_headline that execute is told to honor, so the
 *  rules must bind there too. Three mandates: inventory-specific language,
 *  never-invent business facts, and the four conversion questions every
 *  storefront must answer. Guidance only — no WebsiteConfig field is added or
 *  changed; the downstream cleanStoreContent() pass is the deterministic
 *  backstop for the banned labels. */
const COPY_INTEGRITY_DIRECTIVES = `<copy_integrity>
INVENTORY-SPECIFIC LANGUAGE:
- Every headline, section title and button label must derive from this shop's ACTUAL categories, products, materials or inventory named in <seller_data>.
- Avoid generic luxury-marketing labels. NEVER write: "The Edit", "The Ritual", "The Experience", "The Journey", "Begin the Ritual", "Begin the Edit", "Finish the Silhouette" — or any abstract label that could sit on any shop.
- Use concrete inventory language instead: name the category, the material, the product line or the use ("Shea Body Butters", "Shop Abayas", "Oud Attars, 12ml").

NEVER INVENT BUSINESS FACTS:
- Never state or imply: years in business, awards, certifications, founder stories, customer counts, local manufacturing, handmade / hand-crafted claims, or sourcing / origin claims.
- Use ONLY the verified information supplied in the shop, niche, category and product data of <seller_data>. If a fact is not supplied, omit it — do not estimate, hedge, or imply it.

FOUR QUESTIONS EVERY STOREFRONT MUST ANSWER CLEARLY:
1. What does this merchant sell? — the hero and the collection title name the actual categories.
2. What should I buy first? — the hero and the collection intro point to a concrete product or category.
3. Why trust this merchant? — value_props built from supplied facts only (delivery, pickup, stock, materials, ingredients) — never invented proof.
4. How do I order? — every button label names the action (e.g. "Shop Abayas", "Order via WhatsApp").

STORY ↔ FEATURED-PRODUCT CONSISTENCY (BINDING):
- <seller_data> lists FEATURED PRODUCTS — the exact pieces the storefront renders in the hero and the collection grid.
- story (body), product_grid.intro, hero copy and the concept "vibe" may name or describe ONLY products from that FEATURED list. Never build the narrative around a product that is in the wider inventory but absent from the FEATURED list — the customer cannot see it.
- Category-level language ("Kojic soaps", "Oud attars") is fine when it describes the FEATURED pieces; a named product must be one of them.
</copy_integrity>`;

// ─────────────────────────────────────────────────────────────────────────────
// Phase 14 WP4 — ROUTE INTEGRATION (A3). How POST consumes the WP1–WP3
// authority model: four pure, module-private steps. POST calls them and
// originates none of template_key, storefront_family or layout_strategy.grid.
//   · Gate CLOSED (RITUAL_RECIPE_GENERATION_ENABLED is false — production
//     today): routeAuthority returns null, and under a null authority every
//     other step hands back what it was given — the SAME generation reference,
//     no composition, no log line. The route is the pre-WP4 route.
//   · Gate OPEN: the decision assignArchitecture returned owns all three keys.
//     Its template is the one pinned. Its family and recipe grid are stamped
//     onto the generation's layout by the WP3 carrier BEFORE any existing
//     carrier reads that layout, whatever the model named. An archetype whose
//     template the decision changed keeps only its surviving look (the WP3
//     visual-system composition) under the assigned template.
//   · CLASSIC FLOOR (gate open, no usable decision — the engine threw, the
//     object is not a coherent StorefrontDecision, or reading it failed): the
//     seller's own template when one was chosen, else the route's category
//     heuristic, never the model's; the default family; no recipe grid; no
//     Subtraction.
// Nothing here changes a decision, a rule, the prompt, the resolver, the
// renderer or the persist call, and nothing here opens the gate.
// scripts/verifyArchitectureAssignment.ts lifts the code between the two WP4
// markers out of this file and RUNS it in both gate states, so the block must
// stay self-contained: the only outside names it may use are imports from
// '@/lib/siteTemplates'.
// ─────────────────────────────────────────────────────────────────────────────
// [WP4:BEGIN]
/** What the build follows when the gate is open. `decision` null = the
 *  Classic floor; `floor` then says why no decision could be used. */
type RouteAuthority = {
  decision: StorefrontDecision | null;
  /** The template the build is pinned to — the decision's, or the floor's. */
  template: TemplateKey;
  floor: 'missing' | 'invalid' | 'unreadable' | null;
};

/** WP4 step 1 — obtain the authority, BEFORE the template is pinned. Pure.
 *  Gate closed → null (nothing downstream changes). Gate open → the decision
 *  when it is usable, else the Classic floor on `floorTemplate` — the seller's
 *  chosen template, else the route's own category heuristic (the pre-WP4
 *  prompt hint). That heuristic is the one value the route still supplies
 *  itself, and only when Assignment gave it nothing to follow.
 *  A decision is usable only when it honours the StorefrontDecision contract:
 *  family, architecture and template are known values; Subtraction pairs with
 *  architecture 'classic'; and the template can render what is asked (Counter,
 *  Gallery and Subtraction are Ritual-only). This is a shape check on the
 *  object — no threshold, niche or eligibility rule is restated here.
 *  The three values are read once, inside the try: never throws. */
function routeAuthority(
  gateOpen: boolean,
  assignment: ArchitectureAssignment | null | undefined,
  floorTemplate: TemplateKey
): RouteAuthority | null {
  if (!gateOpen) return null;
  let decision: StorefrontDecision | null = null;
  let assignedTemplate: TemplateKey | null = null;
  let floor: RouteAuthority['floor'] = 'missing';
  if (assignment) {
    try {
      floor = 'invalid';
      if (typeof assignment === 'object' && isStorefrontDecision(assignment)) {
        const { family, architecture, template } = assignment;
        const ritualOnly = family === 'subtraction' || architecture !== 'classic';
        if (
          (STOREFRONT_FAMILIES as readonly string[]).includes(family) &&
          (ARCHITECTURES as readonly string[]).includes(architecture) &&
          (TEMPLATE_KEYS as readonly string[]).includes(template) &&
          (family !== 'subtraction' || architecture === 'classic') &&
          (!ritualOnly || template === SUBTRACTION_TEMPLATE_KEY)
        ) {
          decision = assignment;
          assignedTemplate = template;
          floor = null;
        }
      }
    } catch {
      decision = null;
      assignedTemplate = null;
      floor = 'unreadable';
    }
  }
  return decision && assignedTemplate
    ? { decision, template: assignedTemplate, floor: null }
    : { decision: null, template: floorTemplate, floor: floor ?? 'invalid' };
}

/** WP4 step 2 — carry the authority onto the model's generation. Pure.
 *  No authority (gate closed) → the SAME generation object back. Otherwise a
 *  copy whose template_key is the assigned template and whose layout went
 *  through the WP3 carrier: storefront_family and the recipe grid are the
 *  decision's (the Classic floor's when there is none), every other lever is
 *  the model's. The existing carriers then read this object unchanged. */
function carryAuthority<G extends Pick<WebsiteGeneration, 'template_key' | 'layout'>>(
  generation: G,
  authority: RouteAuthority | null
): G {
  if (!authority) return generation;
  return {
    ...generation,
    template_key: authority.template,
    layout: carryStorefrontDecision(generation.layout, authority.decision, { gateOpen: true }) ?? undefined,
  };
}

/** WP4 step 3 — an archetype under a template the decision changed. Pure.
 *  Returns null when there is nothing to recompose (no authority, no
 *  archetype, or the assigned template is the archetype's own — the existing
 *  applyArchetype path stands). Otherwise seats the archetype's SURVIVING look
 *  (WP3 composeVisualSystem) on the assigned template and runs the existing
 *  layout carrier under the composition's bounds: the assigned template's own
 *  section mix, the archetype's accents and faces only where they survive. */
function applyAssignedLook(
  config: WebsiteConfig,
  archetype: SiteArchetype | null,
  layout: WebsiteLayout | null | undefined,
  authority: RouteAuthority | null
): WebsiteConfig | null {
  if (!authority || !archetype || archetype.template_key === authority.template) return null;
  const look = composeVisualSystem(archetype, authority.template);
  const seated: WebsiteConfig = { ...config, template_key: look.templateKey };
  if (Object.keys(look.theme).length > 0) seated.theme = { ...look.theme };
  return applyGenerationLayout(seated, layout, look.bounds);
}

/** WP4 — the authority line an open gate logs: what the build was told to
 *  follow, composed from the authority alone. Pure. (POST adds one more line
 *  of its own when an archetype's look is carried under a changed template.) */
function describeRouteAuthority(authority: RouteAuthority, shopId: string): string {
  const d = authority.decision;
  return d
    ? `[generate-website] Assignment authority for shop ${shopId}: architecture=${d.architecture} template=${authority.template} family=${d.family} grid=${assignedRecipeGrid(d) ?? 'none'}`
    : `[generate-website] Assignment authority for shop ${shopId}: CLASSIC FLOOR (decision ${authority.floor}) template=${authority.template} family=${DEFAULT_STOREFRONT_FAMILY} grid=none`;
}
// [WP4:END]

// ─────────────────────────────────────────────────────────────────────────────
// Phase 14 WP5 — PROMPT ALIGNMENT (A6). What the execute-step model is TOLD,
// brought in line with what WP4 makes the build DO. One pure step, called by
// POST after it has built the closed-gate prompt and before the model call.
//   · Gate CLOSED (authority null — production today): the step returns the
//     SAME object it was handed. The model is sent the cached block and the
//     prompt POST built, byte for byte; the second cached block below is
//     never sent.
//   · Gate OPEN: the model is sent the second cached block and a prompt with
//     an <assignment> section. The authority's template, its family and — when
//     it owns one — its recipe grid are STATED as fixed; nothing asks the
//     model to choose them, and no template the build will not use is named.
//     The bounds shown are the bounds the build applies (the three cases of
//     assignedBuildBounds), and split_cta is asked for only when the archetype
//     bundle is the thing applied.
//   · CLASSIC FLOOR (gate open, no decision): the floor template and the
//     default family are stated the same way, and the collection grid stays
//     the model's presentation pick. Nothing sent at the floor mentions
//     Subtraction or a recipe grid — which is why the second cached block
//     names no template, family or grid value at all: those arrive only in
//     the <assignment> section.
// The step CONSUMES the authority: its template, whether it holds a decision,
// that decision's family, and the recipe grid lib derives from it — the same
// reads as the WP4 log line. It validates nothing, derives nothing, and never
// sees the assignment object, the gate, or the seller's own template pick.
// It changes no decision, carrier, pin, log line or persisted value, and the
// concepts step does not call it.
// scripts/verifyArchitectureAssignment.ts lifts the code between the two WP5
// markers and RUNS it in both gate states (together with POST's own prompt
// statements), so the block must stay self-contained: the only outside names
// it may use are lib exports, ELITE_COPY_RULES, and this file's
// describeLayoutBounds and COPY_INTEGRITY_DIRECTIVES.
// ─────────────────────────────────────────────────────────────────────────────
// [WP5:BEGIN]
/** The SECOND cached block — sent only with the gate open. CACHE LAW, as for
 *  the first: byte-stable. It is a module constant, built once from module
 *  constants (ELITE_COPY_RULES, ACCENT_PRESET_SLOTS), so no request value can
 *  reach it. It is the first block with its three selection passages removed
 *  (the template catalog, the storefront_family menu with its Subtraction
 *  rules, the section-order advice keyed to the commerce model) and the
 *  <assignment_authority> rule added. It names no template, no family and no
 *  recipe grid: the same bytes are sent at the Classic floor. */
const ASSIGNED_CACHED_SYSTEM = `<system_context>
Role: Principal E-Commerce Architect (Sanndikaa Studio).
Objective: Generate an elite, top 1% global e-commerce storefront for the provided seller.
Mandate: You are not filling out a template. You are engineering a bespoke, high-converting software interface powered by the $50k Matrix Engine. No two generations should ever be identical.
</system_context>

<assignment_authority>
Three structural facts are decided before you are called. They arrive in the <assignment> block of the user message and are FIXED for this build:
- The template. Set "template_key" to exactly the template <assignment> names.
- The storefront family. It is applied for you — never write "layout.storefront_family".
- The collection grid, when <assignment> marks it FIXED. It is applied for you — write "layout.layout_strategy.grid" ONLY when <assignment> marks the collection grid as YOURS.
Write the site for these facts. Do not replace or argue with them: a value you write for a fixed key is discarded. Where a creative direction in the user message and <assignment> differ, <assignment> stands.
</assignment_authority>

<architectural_rules>
1. Top-of-Food-Chain UX — already engineered; write for it:
   - Every page ships mobile-first: each product detail page carries a sticky bottom buy bar (price, variant chip, action button), the cart is a slide-out drawer (never a cart page), and every touch target is at least 44px. None of this is a field you output. Write copy that assumes this execution: lines that survive a phone screen, headlines that land above the fold, button labels that fit a thumb-width pill.
2. Dynamic Structural Permutation:
   - Analyze the <seller_data>. Do not just change the words — change the layout hierarchy to the seller's strengths through the "layout" object (field spec below): section order and inclusion, grid vs carousel for the collection, spacing and alignment rhythm per section, the accent preset, the display face. The <layout_bounds> in the user message state exactly what this build may draw from.
   - Visual-led inventory (fashion, craft, beauty, objects that sell on imagery): carousel collection, spacious rhythm — let the products carry the page.
   - Spec-led inventory (tech, supplements, tools, anything bought on facts): grid collection, compact rhythm.
3. Zero-Clutter Integrity:
   - NEVER use placeholder text (lorem ipsum) or generic marketing gibberish.
   - Write highly persuasive, niche-specific copy.
   - Use honest data. No fake countdown timers, invented counts, or fabricated reviews — testimonials are filled server-side from real reviews only.
4. Matrix Routing & Brand Tokens:
   - Select the most appropriate "matrix_theme" ("dakar-minimal" for fashion/apparel/luxury goods, "banjul-noir" for cosmetics/jewelry/artisanal crafts, "sahara-tech" for electronics/fitness/tools).
   - Output "brand_tokens" following character limits ruthlessly in a restrained, material-aware editorial tone.
</architectural_rules>

<generation_task>
Given the <seller_data>, the <assignment> and — when one is present — the <chosen_archetype> creative direction in the user message, output the complete, production-ready JSON structure mapping to our Next.js template anatomy — the field spec below. The user message also carries the <layout_bounds> and, when present, the <entropy_engine> seed.
</generation_task>

Write every copy field in the elite voice. The site must read like a brand that has existed for years — confident, specific to THIS inventory, never generic. Reference actual product qualities (materials, ingredients, categories) from the inventory the user provides.

${ELITE_COPY_RULES}

BREVITY MANDATE — BINDING FOR EVERY FIELD:
- Extreme brevity is the luxury register. Aim well under every cap below; whitespace is the product.
- No conversational filler, no marketing throat-clearing, no lead-ins ("Welcome to", "Discover our", "At [shop], we"). Open on the substance.
- Every field has a hard cap AND a TARGET well under it. Write to the target; the cap is a ceiling, never a goal.
- One idea per field. If a sentence can lose a clause and keep its meaning, lose the clause.

Return a JSON object:
- "template_key"     : the template <assignment> names, verbatim — assigned, never chosen
- "matrix_theme"     : one of "dakar-minimal" | "banjul-noir" | "sahara-tech"
- "brand_tokens"     : strict identity tokens object matching schema bounds
- "niche_reasoning"  : 1-2 sentences on how the assigned template and your structural choices fit this inventory
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
    "layout_strategy"      : OPTIONAL structural variants — select them DYNAMICALLY from the inventory and the vibe, never by default: {
        "hero" : "split" for high-fashion / editorial inventory (two-panel: type beside a tall 4:5 image) | "standard" full-bleed visual for bold, image-led products (food, objects, crafts, anything that sells on one hero shot) | "text-centric" for minimal or service-led vibes (consultancy, skincare clinics, bespoke tailoring) where the words carry the fold
        "grid" : ONLY when <assignment> marks the collection grid as YOURS — "masonry" when product imagery has varied aspect ratios or reads as lifestyle photography | "featured-first" when the <seller_data> shows one clear flagship product (a hero SKU, a signature piece, the top seller) that should lead oversized before the rest | "standard" for uniform catalogs of like-for-like items
      }
  }`;

/** What the assigned family means for the page — the first block's own
 *  wording for the three rhythms, now stated as a fact about ONE family (the
 *  model is told its family, never shown the list). */
const ASSIGNED_FAMILY_FACTS: Record<StorefrontDecision['family'], string> = {
  'lifestyle-story': 'It re-seats the core sections of <layout_bounds> in its rhythm — Hero → Story → Collection → Trust band → CTA (the boutique lookbook: narrative before catalog) — and a block_order you write still arranges them within the bounds.',
  'product-first': 'It re-seats the core sections of <layout_bounds> in its rhythm — Hero → Collection → Trust band → Story → CTA (shoppers land straight in the catalog) — and a block_order you write still arranges them within the bounds.',
  'menu-occasion': 'It re-seats the core sections of <layout_bounds> in its rhythm — Hero → Trust band → Story → Collection → CTA (occasion and vibe first, then the menu) — and a block_order you write still arranges them within the bounds.',
  subtraction: 'Only the hero and the collection render: every other section you write ships hidden (the seller can restore it), whatever block_order names.',
};

/** What an owned recipe grid means for the page (the layout carrier's own
 *  defaults for each: what ships hidden when no block_order names it). */
const ASSIGNED_GRID_FACTS: Record<NonNullable<ReturnType<typeof assignedRecipeGrid>>, string> = {
  counter: 'the full catalog behind a sticky category strip. Unless a block_order you write names them, the story and the closing banners ship hidden.',
  gallery: 'each piece shown at full-screen scale ahead of the catalog. Unless a block_order you write names it, the closing banner ships hidden.',
};

/** The execute-step prompt as the model call reads it — and the bounds text
 *  the dry-run harness reports. */
type ExecutePrompt = { cachedSystem: string; prompt: string; layoutBoundsText: string };

/** Everything the open-gate prompt says that is NOT authority: the seller
 *  data, the approved creative direction, the seed block. No template here. */
type AssignedPromptFacts = {
  shopName: string;
  shopBio: string | null;
  nicheLabel: string | null;
  featuredBlock: string;
  productCount: number;
  inventorySummary: string;
  concept: SiteConcept | null;
  archetype: SiteArchetype | null;
  entropyEngine: string;
};

/** The bounds an open-gate build applies — so the bounds the prompt shows.
 *  Pure. Three cases, the same three the build's tail takes:
 *    no archetype                     → the assigned template's classic bounds;
 *    archetype on its own template    → the archetype's bounds (the bundle is
 *                                       applied: `bundleApplied`);
 *    archetype on a changed template  → the WP3 composition's bounds (only the
 *                                       surviving look is seated — no bundle).
 *  "Changed" is the composition's own answer, not a comparison made here. */
function assignedBuildBounds(authority: RouteAuthority, archetype: SiteArchetype | null): { bounds: LayoutBounds; bundleApplied: boolean } {
  if (!archetype) return { bounds: classicLayoutBounds(authority.template), bundleApplied: false };
  const look = composeVisualSystem(archetype, authority.template);
  return look.templateChanged
    ? { bounds: look.bounds, bundleApplied: false }
    : { bounds: archetypeLayoutBounds(archetype), bundleApplied: true };
}

/** WP5 — the prompt the model is sent. Pure.
 *  No authority (gate closed) → the SAME object back: POST's closed-gate
 *  cached block, prompt and bounds text, untouched.
 *  Otherwise the second cached block and a prompt that states what the build
 *  will follow — the authority's template, its family (the default family at
 *  the Classic floor) and its recipe grid when it owns one — with the bounds
 *  that build applies. The seller data, the copy-integrity directives and the
 *  seed block are the closed-gate prompt's own text. */
function alignPromptToAuthority(closedGate: ExecutePrompt, authority: RouteAuthority | null, facts: AssignedPromptFacts): ExecutePrompt {
  if (!authority) return closedGate;

  const template = SITE_TEMPLATES[authority.template];
  const family = authority.decision ? authority.decision.family : DEFAULT_STOREFRONT_FAMILY;
  const recipeGrid = authority.decision ? assignedRecipeGrid(authority.decision) : null;
  const { bounds, bundleApplied } = assignedBuildBounds(authority, facts.archetype);
  const layoutBoundsText = describeLayoutBounds(bounds);

  const collectionGrid = recipeGrid
    ? `COLLECTION GRID — FIXED: "${recipeGrid}" — ${ASSIGNED_GRID_FACTS[recipeGrid]} Do not write layout_strategy.grid.`
    : 'COLLECTION GRID — YOURS: choose layout_strategy.grid from the field spec.';

  // The approved creative direction is copy, and it survives. What it no
  // longer carries is a template: the concept's own key is never repeated.
  const approvedDirection = facts.concept
    ? `APPROVED CREATIVE DIRECTION — the seller approved this concept. Honor it precisely, refine and expand it into the full site, never contradict it:
- Concept: ${facts.concept.concept_name}
- Tagline direction: ${facts.concept.tagline}
- Vibe: ${facts.concept.vibe}
- Palette & styling: ${facts.concept.palette}
- Approved hero direction: "${facts.concept.hero_headline}" — "${facts.concept.hero_subheadline}"`
    : '';
  // The archetype's voice survives on any template (WP3). Its split_cta
  // spread exists only where the bundle itself is applied.
  const archetypeDirection = !facts.archetype
    ? ''
    : bundleApplied
      ? `ARCHETYPE DIRECTION — the approved bundle is "${facts.archetype.name}". ${facts.archetype.vibe}\nVOICE: ${facts.archetype.copyDirection}\nWrite the split_cta object for this site (see the field spec) — it renders as the two-panel conversion spread this archetype composes.`
      : `ARCHETYPE DIRECTION — the approved direction is "${facts.archetype.name}". ${facts.archetype.vibe}\nVOICE: ${facts.archetype.copyDirection}`;
  const direction = [approvedDirection, archetypeDirection].filter((part) => part !== '').join('\n\n');
  const chosenArchetype = direction ? `<chosen_archetype>\n${direction}\n</chosen_archetype>\n\n` : '';

  const prompt = `<seller_data>
SHOP:
- Name: ${facts.shopName}
${facts.shopBio ? `- Bio: ${facts.shopBio}` : ''}
${facts.nicheLabel ? `- Declared niche: ${facts.nicheLabel} — the seller chose this niche explicitly; tailor the storefront to it` : ''}

${facts.featuredBlock}

INVENTORY (${facts.productCount} products, first 15 shown):
${facts.inventorySummary}
</seller_data>

<assignment>
TEMPLATE — FIXED: "${template.key}" (${template.name} — ${template.niche}). Set template_key to "${template.key}". Template reference: ${template.description}
STOREFRONT FAMILY — FIXED: "${family}". Assigned from this merchant's commerce model, never chosen by you. ${ASSIGNED_FAMILY_FACTS[family]}
${collectionGrid}
NICHE REASONING: write niche_reasoning explaining how the "${template.key}" template is styled for this inventory.
</assignment>

${chosenArchetype}<layout_bounds>
${layoutBoundsText}
</layout_bounds>

${COPY_INTEGRITY_DIRECTIVES}${facts.entropyEngine}`;

  return { cachedSystem: ASSIGNED_CACHED_SYSTEM, prompt, layoutBoundsText };
}
// [WP5:END]

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

    // ── Pre-generation selections (Studio Step 1A / 1B) ───────────────────
    // niche: the seller's explicitly chosen boutique niche — a STUDIO_NICHES
    // id (resolved to its label) or a short free-text category. It rides ONLY
    // the dynamic prompt (never cachedSystem — cache law) and supplements/
    // overrides the inventory-derived dominantCategory in BOTH AI steps.
    const rawNiche: unknown = body?.niche;
    let niche: string | null = null;
    if (rawNiche !== undefined && rawNiche !== null) {
      if (typeof rawNiche !== 'string' || rawNiche.trim().length > 64) {
        return NextResponse.json(
          { error: 'niche must be a string of at most 64 characters.' },
          { status: 400 }
        );
      }
      const cleaned = rawNiche.replace(/[\r\n\t<>]/g, ' ').replace(/\s+/g, ' ').trim();
      niche = cleaned || null;
    }
    const nicheKey = niche;
    const nicheLabel: string | null = nicheKey
      ? STUDIO_NICHES.find((n) => n.id === nicheKey.toLowerCase())?.label ?? nicheKey
      : null;

    // archetypeKey: the seller picked their Theme Archetype directly before
    // clicking Generate (one-call build, no consultation). Validated against
    // ARCHETYPE_KEYS; a concept's archetype_key still takes precedence.
    const rawArchetypeKey: unknown = body?.archetypeKey;
    let requestedArchetypeKey: ArchetypeKey | null = null;
    if (rawArchetypeKey !== undefined && rawArchetypeKey !== null) {
      if (
        typeof rawArchetypeKey !== 'string' ||
        !(ARCHETYPE_KEYS as readonly string[]).includes(rawArchetypeKey)
      ) {
        return NextResponse.json(
          { error: `archetypeKey must be one of: ${ARCHETYPE_KEYS.join(', ')}.` },
          { status: 400 }
        );
      }
      requestedArchetypeKey = rawArchetypeKey as ArchetypeKey;
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
      // Phase 14 WP2 (validator parity): read so the assignment's render
      // window carries the same stock the resolver's home read carries.
      // Optional — harness rows have none (unknown stock counts as in stock).
      stock_quantity?: number | null;
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
        .select('id, name, description, category, price, image_url, ad_video_url, ad_hero_image_url, stock_quantity')
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
    // Seller-declared niche (Studio Step 1A) wins over the inventory
    // heuristic; the inventory category stays as supplementary context.
    const effectiveCategory = nicheLabel ?? dominantCategory;
    const heuristicTemplate = templateFromCategory(effectiveCategory);
    const nicheContext = nicheLabel
      ? `seller-declared niche "${nicheLabel}" (inventory's dominant category: "${dominantCategory ?? 'unknown'}") — tailor every structural and copy decision to this niche`
      : `dominant category "${dominantCategory ?? 'unknown'}"`;

    // ── Generation quota (2 included; +2 per Studio Token) ────────────────
    // Gates BOTH AI steps (concepts + execute); only the execute step's
    // persist increments the counter. Skipped in the dev harness (nothing is
    // persisted there). Rows read before the quota migration runs (undefined
    // column 42703 / PGRST204) degrade gracefully to the 0-of-2 defaults.
    let generationsUsed = 0;
    let generationsLimit = 2;
    if (!devHarness) {
      const { data: quotaRow, error: quotaError } = await admin
        .from('shop_websites')
        .select('generations_used, generations_limit')
        .eq('shop_id', shop.id)
        .maybeSingle();
      if (quotaError) {
        const undefinedColumn =
          quotaError.code === '42703' ||
          quotaError.code === 'PGRST204' ||
          /generations_(used|limit)/.test(quotaError.message ?? '');
        if (!undefinedColumn) {
          console.error('[generate-website] Quota lookup failed:', quotaError);
          throw new Error('Failed to read the generation quota');
        }
        console.warn('[generate-website] Quota columns missing (migration pending) — defaulting to 0 of 2.');
      } else {
        generationsUsed = Number(quotaRow?.generations_used ?? 0);
        generationsLimit = Number(quotaRow?.generations_limit ?? 2);
      }
      if (!Number.isFinite(generationsUsed)) generationsUsed = 0;
      if (!Number.isFinite(generationsLimit)) generationsLimit = 2;
      // TEMPORARY testing switch, env-controlled only (ENFORCE_QUOTA). Mirrors
      // NEXT_PUBLIC_ENFORCE_QUOTA in WebsiteGeneratorStudio.tsx: unless
      // ENFORCE_QUOTA === 'true' the 402 gate below is skipped. The lookup and
      // counter write stay live so generations_used keeps tracking usage.
      if (ENFORCE_GENERATION_QUOTA && generationsUsed >= generationsLimit) {
        return NextResponse.json(
          {
            error:
              generationsLimit === 2
                ? 'You have used all 2 included website generations. Unlock +2 extra generations with a Studio Token.'
                : `You have used all ${generationsLimit} of your website generations. Unlock +2 extra generations with a Studio Token.`,
            code: 'QUOTA_EXCEEDED',
            generations_used: generationsUsed,
            generations_limit: generationsLimit,
          },
          { status: 402 }
        );
      }
    }

    const inventorySummary = products
      .slice(0, 15)
      .map((p) => `- ${p.name} (${p.category ?? 'uncategorised'}${p.price ? `, D${p.price}` : ''})${p.description ? `: ${String(p.description).slice(0, 120)}` : ''}`)
      .join('\n');

    // Story ↔ product grounding: mirror the renderer's featured window so the
    // copy describes what the page actually shows. app/site/[slug]/siteData.ts
    // readHomeProducts reads the 12 newest rows (created_at desc — the same
    // order as the read above), and Ritual/Editorial run selectFeaturedProducts
    // over that window for the hero + showcase. Prompt-only: nothing persisted.
    const featuredProducts = selectFeaturedProducts(
      products.slice(0, 12).map((p) => ({
        id: p.id,
        name: p.name,
        price: typeof p.price === 'number' ? p.price : null,
        description: p.description,
        image_url: p.image_url,
        ad_video_url: p.ad_video_url,
        ad_hero_image_url: p.ad_hero_image_url,
        category: p.category,
      })),
      FEATURED_MAX,
    );
    const featuredSummary = featuredProducts
      .map((p, i) => `${i + 1}. ${p.name} (${p.category ?? 'uncategorised'}${p.price ? `, D${p.price}` : ''})${p.description ? `: ${String(p.description).slice(0, 120)}` : ''}`)
      .join('\n');
    const featuredBlock = `FEATURED PRODUCTS (the ${featuredProducts.length} pieces the storefront displays in the hero and collection grid — story, product_grid intro and hero copy must reference ONLY these):
${featuredSummary}`;

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
    // clicks rotate the pair instead of replaying it. A seller-picked
    // archetype (Studio Step 1B) always leads the pair; its partner is drawn
    // from the same niche-safe pool (Phase 5B).
    // ═══════════════════════════════════════════════════════════════════════
    if (step === 'concepts') {
      const [primary, secondary] = pickConceptArchetypes(
        shop.id,
        effectiveCategory,
        variationSeed,
        requestedArchetypeKey
      );

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
    "vibe"             : 1-2 sentences of customer-facing brand story in this archetype's voice grounded in the real products (max 240 chars — never say "this concept" or describe design/colors)
    "palette"          : 1 short customer-facing sentence introducing the collection (max 160 chars — never list colors or fonts)
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

${featuredBlock}

INVENTORY (${products.length} products, first 15 shown):
${inventorySummary}

PITCH THESE TWO ARCHETYPES, IN THIS ORDER:
1. "${primary.key}" — ${primary.name}
2. "${secondary.key}" — ${secondary.name}

NICHE CONTEXT: ${nicheContext}.${variationDirective}

${COPY_INTEGRITY_DIRECTIVES}`;

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
    // Resolution order: the approved concept's archetype_key → the seller's
    // direct Theme Archetype pick (body.archetypeKey, Studio Step 1B) → the
    // dev harness's named archetype → classic path.
    const archetype: SiteArchetype | null =
      concept?.archetype_key
        ? ARCHETYPES[concept.archetype_key] ?? null
        : requestedArchetypeKey
          ? ARCHETYPES[requestedArchetypeKey]
          : harnessArchetypeKey && (ARCHETYPE_KEYS as readonly string[]).includes(harnessArchetypeKey)
            ? ARCHETYPES[harnessArchetypeKey as ArchetypeKey]
            : null;

    // The archetype's base template ALWAYS wins over a drifted concept key —
    // the bundle is the contract the seller approved.
    const chosenTemplate: TemplateKey | undefined =
      archetype?.template_key ?? concept?.template_key ?? (templateOverride as TemplateKey | undefined);

    // ── Phase 10H — architecture assignment (INFORMATIONAL) ───────────────
    // One pure call over the full inventory slice, the seller's niche and the
    // same hero-media resolution the renderer uses. While the recipe
    // generation gate is closed this object is LOGGED and nothing else: it
    // does not touch chosenTemplate, the prompt, the layout guard or the
    // persisted config. Phase 10I wires it into routing + the constraint.
    // Failures are swallowed — a recommendation must never block a build.
    // Phase 10L.4: two facts are carried OUT of this block for the expression
    // write that runs after the layout is applied — the assigned architecture
    // (log only) and the signals selectExpression reads. Both stay null when
    // the assignment is skipped, and a null signal set writes nothing.
    let assignedArchitecture: Architecture | null = null;
    let expressionSignals: ExpressionSignals | null = null;
    // Phase 14 WP4 (A3): the assignment object itself is carried out of this
    // block too — set the moment the engine answers, left null when it throws
    // or never runs. Read by routeAuthority below and by nothing else; with
    // the gate closed that step returns null, so this stays a log-only block.
    let obtainedAssignment: ArchitectureAssignment | null = null;
    try {
      const assignmentProducts = products.map((p) => ({
        id: p.id,
        name: p.name,
        price: typeof p.price === 'number' ? p.price : typeof p.price === 'string' && p.price.trim() !== '' && Number.isFinite(Number(p.price)) ? Number(p.price) : null,
        description: p.description,
        image_url: p.image_url,
        ad_video_url: p.ad_video_url,
        ad_hero_image_url: p.ad_hero_image_url,
        category: p.category,
      }));
      const forcedTemplate =
        archetype && concept?.archetype_key
          ? { template: archetype.template_key, source: 'concept' as const }
          : archetype
            ? { template: archetype.template_key, source: 'seller-archetype' as const }
            : concept?.template_key
              ? { template: concept.template_key, source: 'concept' as const }
              : chosenTemplate
                ? { template: chosenTemplate, source: 'seller-template' as const }
                : null;
      // Phase 14 WP2 — input + validator parity (inputs only). With the gate
      // CLOSED this hands back `nicheKey` untouched and no render window, so
      // the call below is the Phase 10H call byte for byte. With it OPEN an
      // undeclared niche (absent, or the Studio's preselected catch-all)
      // reaches the engine as no niche — the same input Studio and Onboarding
      // — and the engine judges the recipe verdicts on the slice the resolver
      // will hold: the newest rows, carrying stock. `assignmentProducts`
      // itself stays stock-less, so everything else the engine reads is
      // unchanged.
      const aligned = alignAssignmentInputs({
        niche: nicheKey,
        products: assignmentProducts.map((p, i) => ({ ...p, stock_quantity: products[i]?.stock_quantity ?? null })),
      });
      const assignment = assignArchitecture({
        niche: aligned.niche,
        dominantCategory,
        products: assignmentProducts,
        renderProducts: aligned.renderProducts,
        heroMedia: resolveHeroMedia(
          { id: shop.id, shop_name: shop.shop_name, shop_slug: shop.shop_slug, logo_url: shop.logo_url, banner_url: shop.banner_url, bio: shop.bio },
          null,
        ),
        forcedTemplate,
      });
      obtainedAssignment = assignment;
      // Phase 10I: structured, human-readable block (one fact per line) built
      // ONLY from the assignment object — architecture, template, confidence,
      // decision source, reason, signals, Counter/Gallery eligibility.
      console.log(
        formatArchitectureAssignment(assignment, {
          shopId: shop.id,
          gateOpen: RITUAL_RECIPE_GENERATION_ENABLED,
        }),
      );
      // Phase 10L.4: the 10K.3 §2 selection inputs — the engine's own niche
      // and normalised category count, the same dominantCategory it was
      // given, and the exhibit count over the same inventory slice.
      assignedArchitecture = assignment.architecture;
      expressionSignals = {
        niche: assignment.signals.niche,
        dominantCategory,
        categoryCount: assignment.signals.categoryCount,
        exhibits: selectGalleryExhibits(assignmentProducts).length,
      };
      // Phase 14 WP2 (validator parity): with the gate OPEN the two floor
      // inputs are re-counted on the render window, the way the resolver
      // re-counts them — so a selected expression cannot degrade on first
      // render. Gate closed → no window → the Phase 10L.4 values above stand.
      if (aligned.renderProducts) {
        expressionSignals = {
          ...expressionSignals,
          ...expressionFloorSignals({
            signals: assignment.signals,
            products: assignmentProducts,
            renderProducts: aligned.renderProducts,
          }),
        };
      }
    } catch (assignmentError) {
      console.warn('[generate-website] Architecture assignment skipped:', assignmentError);
    }

    // ── Phase 14 WP4 (A3) — the authority, obtained BEFORE the template is
    // pinned (and before anything is generated). Gate closed → null: every
    // WP4 step below is then a no-op and this request runs the pre-WP4 route.
    // Gate open → the decision above owns template_key, storefront_family and
    // the recipe grid; with no usable decision the Classic floor stands on the
    // seller's own template, else the category heuristic — never the model's.
    const authority = routeAuthority(
      RITUAL_RECIPE_GENERATION_ENABLED,
      obtainedAssignment,
      chosenTemplate ?? heuristicTemplate,
    );
    if (authority) {
      if (authority.decision) console.log(describeRouteAuthority(authority, shop.id));
      else console.warn(describeRouteAuthority(authority, shop.id));
    }

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
        ? `TEMPLATE CONSTRAINT: the seller has explicitly chosen the "${chosenTemplate}" template. You MUST set template_key to "${chosenTemplate}" and write niche_reasoning explaining how this template will be styled for their inventory.${archetypeDirection}`
        : `TEMPLATE SELECTION: choose the single best template_key for this inventory. Heuristic suggestion based on the ${nicheContext}: "${heuristicTemplate}" — but override it if the actual product mix clearly fits another niche better. Explain your choice in niche_reasoning.`;

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
Mandate: You are not filling out a template. You are engineering a bespoke, high-converting software interface powered by the $50k Matrix Engine. No two generations should ever be identical.
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
4. Matrix Routing & Brand Tokens:
   - Select the most appropriate "matrix_theme" ("dakar-minimal" for fashion/apparel/luxury goods, "banjul-noir" for cosmetics/jewelry/artisanal crafts, "sahara-tech" for electronics/fitness/tools).
   - Output "brand_tokens" following character limits ruthlessly in a restrained, material-aware editorial tone.
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
- "matrix_theme"     : one of "dakar-minimal" | "banjul-noir" | "sahara-tech"
- "brand_tokens"     : strict identity tokens object matching schema bounds
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
    "layout_strategy"      : OPTIONAL structural variants — select them DYNAMICALLY from the inventory and the vibe, never by default: {
        "hero" : "split" for high-fashion / editorial inventory (two-panel: type beside a tall 4:5 image) | "standard" full-bleed visual for bold, image-led products (food, objects, crafts, anything that sells on one hero shot) | "text-centric" for minimal or service-led vibes (consultancy, skincare clinics, bespoke tailoring) where the words carry the fold
        "grid" : "masonry" when product imagery has varied aspect ratios or reads as lifestyle photography | "featured-first" when the <seller_data> shows one clear flagship product (a hero SKU, a signature piece, the top seller) that should lead oversized before the rest | "standard" for uniform catalogs of like-for-like items
      }
    "storefront_family"    : ALWAYS set this — route the section rhythm by the merchant's COMMERCE MODEL, read from the <seller_data> inventory and niche, never by default:
        "lifestyle-story" : fashion, beauty, jewelry, fragrance, and luxury goods — Hero → Story → Collection → Trust band → CTA (the boutique lookbook: narrative before catalog)
        "product-first"   : tech, electronics, general marketplaces, and utility goods — Hero → Collection → Trust band → Story → CTA (shoppers land straight in the catalog)
        "menu-occasion"   : bakeries, cafes, catering, and restaurants — Hero → Trust band → Story → Collection → CTA (occasion and vibe first, then the menu)
        "subtraction"     : a high-confidence premium commerce layout that removes storytelling and marketing clutter in favour of a strong hero and a full catalog product wall. Best suited to luxury, visual, product-led brands where confidence comes from restraint rather than explanation.
      SUBTRACTION RULES: "subtraction" is available ONLY when template_key is "ritual" — NEVER select it for "editorial" or "vitality". Prefer it for luxury boutiques, jewellery, fragrance, premium cosmetics, artisan products, and highly visual product catalogs. Do not force it: keep choosing "lifestyle-story", "product-first", or "menu-occasion" whenever one of them fits the merchant better.
      SUBTRACTION DEFAULTS: when selecting "subtraction", prefer layout_strategy.grid = "masonry" and product_grid.catalog = "full" unless there is a specific reason a different configuration better serves the merchant.
  }`;

    // ── Layout bounds (per-request → dynamic prompt) ───────────────────────
    const layoutBoundsText = archetype
      ? describeLayoutBounds(archetypeLayoutBounds(archetype))
      : chosenTemplate
        ? describeLayoutBounds(classicLayoutBounds(chosenTemplate))
        : TEMPLATE_KEYS
            .map((k) => `IF template_key is "${k}":\n${describeLayoutBounds(classicLayoutBounds(k))}`)
            .join('\n\n');

    // ── Entropy engine (per-request → dynamic prompt) ──────────────────────
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
${nicheLabel ? `- Declared niche: ${nicheLabel} — the seller chose this niche explicitly; tailor the storefront to it` : ''}

${featuredBlock}

INVENTORY (${products.length} products, first 15 shown):
${inventorySummary}
</seller_data>

<chosen_archetype>
${templateConstraint}
</chosen_archetype>

<layout_bounds>
${layoutBoundsText}
</layout_bounds>

${COPY_INTEGRITY_DIRECTIVES}${entropyEngine}`;

    // ── Phase 14 WP5 (A6) — prompt alignment. The model is sent what this
    // step returns. Gate closed → the authority is null and the step returns
    // the SAME object it is handed here: the cachedSystem and prompt built
    // above, byte for byte (and the same bounds text for the dry-run harness).
    // Gate open → the second cached block and a prompt that states the
    // authority's template, family and recipe grid as fixed and shows the
    // bounds the build applies. The authority is all it reads of Assignment.
    const executePrompt = alignPromptToAuthority({ cachedSystem, prompt, layoutBoundsText }, authority, {
      shopName: shop.shop_name,
      shopBio: shop.bio,
      nicheLabel,
      featuredBlock,
      productCount: products.length,
      inventorySummary,
      concept,
      archetype,
      entropyEngine,
    });

    const { data: generation, provider } = await generateWithFallback({
      schema: MatrixWebsiteGenerationSchema,
      prompt: executePrompt.prompt,
      cachedSystem: executePrompt.cachedSystem,
      callerName: 'generate-website',
      primaryOverride: FLAGSHIP_CREATIVE_PROVIDER,
    });

    // Explicit destructuring isolates Matrix tokens from the WebsiteConfig blob
    const { brand_tokens, matrix_theme, ...modelGeneration } = generation;
    // Phase 14 WP4 (A3): `legacyGeneration` is what every carrier below reads.
    // Gate closed (authority null) it IS the model's generation — the same
    // object the destructuring above produced, as before WP4. Gate open it is
    // that generation with the assigned template and a layout that went
    // through the WP3 carrier, so the model's own template_key,
    // storefront_family and recipe grid never reach a carrier.
    const legacyGeneration = carryAuthority(modelGeneration, authority);
    let config = generationToConfig(legacyGeneration);

    // Belt-and-suspenders: enforce the chosen template even if the model drifted.
    if (chosenTemplate) {
      config.template_key = chosenTemplate;
    }
    // Phase 14 WP4 (A3): with the gate open the pinned template is
    // Assignment's — Ritual for Counter, Gallery and Subtraction whatever the
    // seller chose, the seller's own template when the decision is Classic.
    // Gate closed → authority is null and the pin above stands alone.
    if (authority) {
      config.template_key = authority.template;
    }

    // ── Archetype application (Pillar 3) + entropy engine ─────────────────
    // Phase 14 WP4 (A3): an archetype whose template the decision changed
    // cannot run applyArchetype (it would pin the archetype's own template and
    // strip the recipe under its bounds) — its surviving look is seated under
    // the assigned template instead. Null with the gate closed, with no
    // archetype, and whenever the assigned template is the archetype's own.
    const assignedLook = applyAssignedLook(config, archetype, legacyGeneration.layout, authority);
    if (assignedLook) {
      config = assignedLook;
      console.log(`[generate-website] Archetype "${archetype?.key}" look carried under assigned template "${config.template_key}" for shop ${shop.id}: blocks=[${(config.blocks ?? []).map((b) => b.type).join(', ')}]`);
    } else if (archetype) {
      let reviewRows: TestimonialSourceReview[] | null = null;
      if (devHarness) {
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
      config = applyArchetype(config, archetype, legacyGeneration, reviewRows);
      console.log(`[generate-website] Archetype "${archetype.key}" applied for shop ${shop.id}: blocks=[${(config.blocks ?? []).map((b) => b.type).join(', ')}]`);
    } else if (legacyGeneration.layout) {
      config = applyGenerationLayout(config, legacyGeneration.layout, classicLayoutBounds(config.template_key));
    }

    if (legacyGeneration.layout) {
      console.log(
        `[generate-website] Layout levers for shop ${shop.id} (${archetype ? archetype.key : `classic/${config.template_key}`}): ` +
        `${JSON.stringify(legacyGeneration.layout)} → blocks=[${(config.blocks ?? []).map((b) => `${b.type}${b.hidden ? '(hidden)' : ''}`).join(', ')}] theme=${JSON.stringify(config.theme ?? null)}`
      );
    }

    // ── Phase 10L.4 — expression persistence (10K.3 §2) ───────────────────
    // Runs AFTER generationToConfig and applyArchetype / applyGenerationLayout
    // (so the grid on the config is the one guardRecipeGridPick let through)
    // and BEFORE the cleanup pass, the dry-run return and the persist RPC.
    // layout_strategy.expression is written only for a Ritual, non-subtraction
    // row whose grid is 'counter' or 'gallery' and survives the guard; every
    // other row comes back as the same object, untouched. While the recipe
    // generation gate is closed no row carries a recipe grid, so this writes
    // nothing and only appends the expression block to the assignment log.
    // Failures are swallowed — an absent key renders the base expression.
    try {
      const survivingGrid = config.layout_strategy?.grid;
      const expressionWrite = applyExpressionSelection(config, {
        gridSurvivedGuard: guardRecipeGridPick(survivingGrid, config.template_key) === survivingGrid,
        signals: expressionSignals,
      });
      config = expressionWrite.config;
      console.log(
        formatExpressionSelection(expressionWrite, {
          shopId: shop.id,
          gateOpen: RITUAL_RECIPE_GENERATION_ENABLED,
          assigned: assignedArchitecture,
        }),
      );
    } catch (expressionError) {
      console.warn('[generate-website] Expression selection skipped:', expressionError);
    }

    // ── Content cleanup (pure — clone-then-clean, original never mutated) ──
    // The FINAL assembled config (template pinned, archetype / layout levers
    // applied) passes through cleanStoreContent before the dry-run return AND
    // before persistence, so harness output and the stored row agree. Only the
    // known cliché labels are swapped for inventory-concrete ones; body copy,
    // blocks, theme, assets and layout are untouched. primaryCategory feeds the
    // "Featured {category}" / "Shop {category}" variants: the seller-declared
    // niche label wins (skipped for the catch-all "general" niche, which would
    // read as a label), else the dominant inventory category in its stored
    // casing (dominantCategory itself is lowercased for counting).
    const dominantCategoryLabel =
      dominantCategory
        ? products.find((p) => (p.category ?? '').toLowerCase() === dominantCategory)?.category?.trim() || null
        : null;
    const primaryCategoryLabel =
      (nicheKey && nicheKey.toLowerCase() !== 'general' ? nicheLabel : null) ?? dominantCategoryLabel;
    config = cleanStoreContent(config, { primaryCategory: primaryCategoryLabel, shopName: shop.shop_name });

    console.log(`[generate-website] Config by ${provider} for shop ${shop.id}: template=${config.template_key} matrix=${matrix_theme} — ${config.niche_reasoning}`);

    if (devHarness) {
      return NextResponse.json({
        step: 'execute',
        dryRun: true,
        provider,
        archetype: archetype?.key ?? null,
        template_key: config.template_key,
        matrix_theme,
        brand_tokens,
        variationSeed,
        layout_bounds: executePrompt.layoutBoundsText,
        generation,
        config,
      });
    }

    const { data: existing, error: existingError } = await admin
      .from('shop_websites')
      .select('status, config')
      .eq('shop_id', shop.id)
      .maybeSingle();

    if (existingError) {
      console.error('[generate-website] Existing website lookup failed:', existingError);
      throw new Error('Failed to inspect existing website state');
    }

    if (existing?.config) {
      const previous = buildPreviousDesign(existing.config);
      if (previous) config.previous = previous;
    }

    // Unified transactional persistence
    const { data: website, error: rpcError } = await admin
      .rpc('persist_matrix_website', {
        p_shop_id: shop.id,
        p_template_key: config.template_key,
        p_config: config,
        p_brand_tokens: brand_tokens,
        p_niche_reasoning: config.niche_reasoning,
        p_matrix_theme: matrix_theme,
        p_generated_at: new Date().toISOString()
      });

    if (rpcError || !website) {
      console.error('[generate-website] Transactional persistence failed:', rpcError);
      throw new Error(`Website persistence failed: ${rpcError?.message}`);
    }
    let finalWebsite = website;

    // ── Quota counter ─────────────────────────────────────────────────────
    // The migrated persist_matrix_website increments generations_used inside
    // the upsert. When the returned row does not reflect used+1 (RPC and/or
    // columns not yet migrated in Supabase), make a best-effort direct write
    // so the counter still advances wherever the column exists; failures are
    // non-fatal (the site itself is saved). The response below ALWAYS
    // carries used+1 so the studio badge updates immediately either way.
    const nextGenerationsUsed = generationsUsed + 1;
    const persistedUsed = Number((website as { generations_used?: unknown }).generations_used);
    if (!Number.isFinite(persistedUsed) || persistedUsed < nextGenerationsUsed) {
      const { error: quotaWriteError } = await admin
        .from('shop_websites')
        .update({ generations_used: nextGenerationsUsed })
        .eq('shop_id', shop.id);
      if (quotaWriteError) {
        console.warn('[generate-website] Quota counter write skipped (migration pending):', quotaWriteError.message);
      }
    }

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
    const returnedUsed = Number((finalWebsite as { generations_used?: unknown }).generations_used);
    const returnedLimit = Number((finalWebsite as { generations_limit?: unknown }).generations_limit);
    return NextResponse.json({
      ...finalWebsite,
      generations_used: Number.isFinite(returnedUsed) ? Math.max(returnedUsed, nextGenerationsUsed) : nextGenerationsUsed,
      generations_limit: Number.isFinite(returnedLimit) ? returnedLimit : generationsLimit,
      shop_slug: canonicalSlug,
    });
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
