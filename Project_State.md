# Sanndikaa Project State

## Executive Summary

Sanndikaa generates premium, mobile-first storefronts for African merchants. The objective is storefronts that feel intentionally designed for the merchant's niche, inventory, and customers, never storefronts that look AI-generated.

| | |
|---|---|
| Current phase | Phase 10 — Storefront Architecture Engine |
| Current step | Phase 10G complete (assignment engine specified) |
| Current bottleneck | Architecture assignment |
| Current architectures | Classic, Counter, Gallery (Ritual-only), plus the Subtraction family |
| Assignment status | Not implemented. No merchant can reach Counter or Gallery today |
| Generation gate | `RITUAL_RECIPE_GENERATION_ENABLED = false` (closed) |
| Next milestone | Phase 10H — Assignment Engine Implementation |

## Phase 10 Current State

**Classic = Narrative Commerce.** Hero → Story → Collection → Trust → CTA. Always eligible. The floor every merchant can stand on.

**Counter = Catalog Commerce.** Shelf-header hero → sticky category strip → full counter wall → trust strip. Requires 6 priced products or 2 categories, and 70% pictured.

**Gallery = Desire Commerce.** Entrance hero → full-plate exhibits (2 to 6) → quiet bridge → notes → closing split CTA → quiet chrome. Requires hero media and 2 pictured exhibits. Rejected for menu-occasion merchants.

Status: Architectures implemented. Assignment engine not yet implemented. Generation gate remains closed.

Current bottleneck: Architecture assignment.

Next milestone: Phase 10H — Assignment Engine Implementation.

### How assignment works today

- Every generated row resolves to Classic (or Subtraction via `storefront_family`).
- Counter and Gallery are keyed by `layout_strategy.grid` values `counter` and `gallery`, which the prompt never offers and the generation guard strips while the gate is closed.
- Template routing runs before any architecture decision: archetype's template key, else the approved concept's, else the seller override, else a keyword heuristic that sends tech, home, general, and health to Vitality and fashion, jewelry, and bags to Editorial. Recipes are Ritual-only, so Counter's and Gallery's primary merchants reach Ritual only by consultation hash rotation or deliberate theme choice.
- Eligibility is evaluated only at render time by `resolveRitualComposition`. The generation route never calls it.

### Phase 10F conclusions (Assignment Engine Audit)

- Reliable generation-time signals: niche id, product count, priced count, pictured ratio, hero media, Ad Studio assets. Weak: category count (merchant-typed strings), review count, free-text niche. Unusable: bio, subscription tier, stock quantity (not selected by the route), image aspect ratio (never measured).
- Category map: Counter for Electronics, Pharmacy, General Retail, Home Goods, Beauty & Personal Care. Gallery for Jewellery, Fragrance, Fashion Boutique, Abayas, Artisan Goods. Classic for Cosmetics, Cakes & Bakery (menu-occasion), Event Services (holding layout only).
- Decision: hybrid with rules holding the veto. Rules compute the eligible set and the default; the model may only confirm within it.
- Routing conflicts: Electronics prefers Counter but routes to Vitality. Jewellery prefers Gallery but routes to Editorial. Subtraction family silently overrides any assigned grid value in `resolveRitualRecipe`.

### Phase 10G specification (Assignment Engine)

- Flow: signals → eligibility (existing `ritualRecipeEligibility`) → assignment (new pure function in `lib/siteTemplates.ts`) → template routing (Ritual when Counter or Gallery is assigned and no seller override, archetype pick, or concept exists) → one fixed-grid sentence in the template constraint → generation, with the grid written before `applyGenerationLayout`.
- Signal order: seller overrides, niche, hero media, pictured ratio, priced count, product count, category count (soft bonus only, normalised before counting).
- Tie-breaks: 12+ priced → Counter; under 7 priced with hero media → Gallery; otherwise Classic.
- Output object: architecture, template, confidence, reason, eligibility (reuses `RecipeEligibility`), signals, overriddenBy.
- Dashboard explanation lives in Online Store → Themes and is built only from the signals and eligibility reasons, never from model free text.
- Engine-side additions needed: category string normalisation and a total-product floor for Counter. Render rules stay untouched.
- Rollout: pure function with tests → wire behind the closed gate and log for a week → review distribution → dashboard explanation → open the gate → anti-clone screenshot check on the first ten live generations. No automatic upgrades of published sites at any step.

### Open-gate prerequisites

1. Assignment function exists and is called in the route before the prompt is built.
2. Prompt carries the assigned grid as a fixed constraint, not a free vocabulary choice.
3. Template routing honours the assignment.
4. Every generation logs recipe, eligibility, and reason.
5. Category normalisation before counting.
6. Dev-harness run covering one merchant per category, greyscale screenshot-compared per the anti-clone rule.

### Phase 10 roadmap

1. Phase 10H — Assignment engine implementation (pure, tested).
2. Routing update so assignments can reach Ritual.
3. Generation gate opened behind the engine.
4. Merchant recommendations in the dashboard from the same reason strings.
5. Occasion commerce (bakery, catering).
6. Lookbook commerce (fashion and abayas at scale).
7. Service commerce (event and booking merchants).

### Platform gaps (future architecture justified)

- Event Services and bookings: no SKUs, no wall, no exhibits. Justified once there are more than a handful of such merchants.
- Cakes & Bakery and catering: menu-occasion is a block order, not an architecture. Justified now.
- Fashion and Abayas above roughly 30 pieces with sizes: Gallery caps at 6, Counter has no variant anatomy. Medium priority.
- General Retail above roughly 60 SKUs: Counter's single sticky strip cannot carry department-store depth. Not yet justified.

## Governing Rules

- Same-Theme Anti-Clone Rule (CLAUDE.md): two merchants selecting the same theme must not receive the same storefront skeleton by default. Palette, copy, spacing, and block-order changes do not count. A storefront fails if it stays recognisably identical in greyscale, with copy blurred, names hidden, at thumbnail size.
- Pipeline: Commerce Mode → Storefront Family → Composition Recipe → Visual System → Curated Palette.
- Byte-identical law: existing storefronts render unchanged. Published stores never auto-upgrade. No new columns or config fields for recipes.
- Meaningful variation comes from composition, merchandising hierarchy, navigation density, interaction pattern, card anatomy, media rhythm, and conversion flow.

## Key Discoveries

**The model, the prompts, and the archetypes are not the bottleneck. Composition is.** Founder testing across Food, Cosmetics, Marketplace, Electronics, and Bakery storefronts (Najat Cakes among them) showed high copy variation, improving concepts, and real ordering variation, yet storefronts still felt the same. Merchants judge uniqueness by interaction model, merchandising strategy, section density, product presentation, and overall composition. They do not perceive copy, palette, archetype, or block reordering as differentiation.

**Banjul Noir** was the first storefront that consistently felt fundamentally different. It behaves like an app, subtracts sections (Hero → Catalog) instead of adding them, makes products the primary content, and pairs that with dark surfaces, framed plates, mono metadata, sparse navigation, and scarcity language. The visual identity is secondary; interaction and composition are the differentiator. This became the Subtraction family and the model for Phase 10.

## Architectural Lessons

1. Routing bugs create bigger problems than weak AI models.
2. Merchants care more about layout and merchandising than copy.
3. Storefront families are more valuable than additional archetypes.
4. Subtraction can create more perceived quality than adding features.
5. Interaction patterns create stronger differentiation than visual themes.

## Do Not Reintroduce

- Bakery → Nightclub concepts
- Food → High Contrast Street routing
- Ignoring merchant archetype selection
- Mobile viewport overflow / wiggle
- Category routing inconsistencies
- Theme picker / niche incompatibility
- `storefront_family` overwrite bug
- Fixed Vitality body ordering

## Completed Milestones

| Milestone | Delivered |
|---|---|
| Pass 1 — Merchant Strategy & Content Integrity | Merchant strategy engine, content integrity rules, niche-aware generation foundations |
| Pass 2 — Generation Integration | Strategy and archetype integration, content cleaning pipeline |
| Pass 3 — Premium Storefront Presentation | Editorial, Ritual, and Vitality templates, category navigation, product collages, mobile-first improvements |
| Pass 3.1 — Storefront Polish | AI filler and footer cleanup, StoryClamp, theme-aware reviews, sticky CTA |
| Phase 4A — Conversion Foundations | PDP product rail, rich WhatsApp payloads, trust zone |
| Phase 5A — Consultation Alignment | Food & Culinary no longer routes into streetwear archetypes |
| Phase 5B — Theme Respect | Seller theme choices influence consultation concepts |
| Phase 5C — Category Alignment & Theme Guardrails | Bakery routing, niche-compatible theme picker, incompatible themes disabled not hidden |
| Phase 6A — Layout Strategy Metadata | `layout_strategy` schema, hero and grid strategy generation |
| Phase 6B — Layout Variation | Standard, split, and text-centric heroes; standard and featured-first grids; backward-compatible rendering |
| Phase 7A — Storefront Family Preservation | `storefront_family` survives generation, `applyArchetype`, `applyGenerationLayout`, and persists on `WebsiteConfig` |
| Phase 7B — Template Unchaining | Vitality respects `config.blocks` ordering; family ordering reaches the renderer |
| Phase 8A — Subtraction Family Foundation | Ritual-only `subtraction` family, full/showcase catalog mode, hidden-leftover strategy, guardrails, safe coercion to lifestyle-story on non-Ritual |
| Phase 10A–10B — Truth audit and recipe rules | Architectural convergence diagnosed; 10B.1 eligibility and fallback rules defined |
| Phase 10C — Ritual Recipe Engine Infrastructure | Recipe resolution (classic, product-first, gallery-led, subtraction), eligibility, render-time fallback, generation guard, gallery exhibit selection. No migration, no new columns, byte-identical snapshots |
| Phase 10D.1 — Counter recipe | Product-First cut in RitualTemplate and RitualChrome; generation defaults on absent keys |
| Phase 10D.2 — Gallery recipe | Gallery-Led "Vitrine" cut, quiet chrome, exhibit rhythm |
| Phase 10E — Architecture Assignment Audit | Per-architecture profiles, category evaluation, hybrid recommendation |
| Phase 10F — Assignment Engine Audit | Signal reliability, routing conflicts, open-gate readiness, platform gaps |
| Phase 10G — Assignment Engine Specification | Flow, signal order, eligibility, routing override, output object, dashboard copy, test matrix, rollout |

Phase 8B (Subtraction Family Rendering) was superseded by Phase 10 scope; its intent is carried by the Subtraction family and the Gallery recipe.

## Known Future Opportunities

- Better bakery hero imagery and food-specific CTA language (folded into occasion commerce)
- Conversion analytics and merchant intelligence
- Learning loops from storefront performance
