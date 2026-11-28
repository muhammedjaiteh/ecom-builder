// ─────────────────────────────────────────────────────────────────────────────
// Phase 10H gate — proves the architecture assignment engine (Phase 10G
// spec) is deterministic, explainable, and INERT: every Phase 10G §7 test
// case lands on the expected architecture, and while the recipe generation
// gate is closed the engine cannot change a generation (guardRecipeGridPick
// still strips every recipe value; legacy rows still resolve to classic).
//
// Run (from repo root):
//   npx tsc scripts/verifyArchitectureAssignment.ts lib/siteTemplates.ts --outDir .verify-assign \
//     --module commonjs --target es2020 --moduleResolution node --esModuleInterop --skipLibCheck
//   node .verify-assign/scripts/verifyArchitectureAssignment.js
//
// Exits non-zero on any failure.
//
// Phase 14 WP1 (sections [11]–[20]) — the authority foundation. The engine
// takes the gate state as an input: CLOSED it returns the Phase 10H object
// unchanged (sections [1]–[10] above run untouched and prove it); OPEN it
// returns the full decision — family (Subtraction included), architecture,
// template, verdicts, fixed-marker reasons. Both states are proven here, and
// section [20] reads the source tree to prove only the generation route
// consumes the new fields (since WP4 — before it, nothing did). Run from the
// repo root (section [20] resolves paths from cwd).
//
// Phase 14 WP2 (sections [21]–[26]) — input + validator parity. An
// undeclared niche reaches the engine as no niche from Studio and Onboarding
// alike, and the recipe verdicts and expression floors are judged on the
// slice the resolver will hold (the newest rows, with stock). Inputs only:
// no rule changes, nothing wired, and inert while the gate is closed.
//
// Phase 14 WP3 (sections [27]–[32]) — the authority carriers. One pure step
// stamps the decision's family and recipe grid onto a layout whatever the
// model named; one pure step says what of an archetype's look survives under
// the assigned template. Since WP4 the generation route calls both; section
// [32] proves nothing else does.
//
// Phase 14 WP4 (sections [33]–[39]) — route integration (A3). The generation
// route now obtains the decision before it pins the template, hands the
// existing carriers a generation that went through the WP3 carrier, and falls
// to the Classic floor when no usable decision exists — all of it dormant
// while the gate is closed. The route's WP4 steps are LIFTED from its source
// and run here in both gate states (the script needs the `typescript` package
// at run time for that — the same one that compiles it). Sections [20] and
// [32] no longer say "nothing consumes" the WP1 / WP3 surface: they assert the
// generation route is its ONLY consumer. Sections [34]–[37] run the lifted
// steps inside a script-side mirror of POST's tail; section [39] is what ties
// that mirror to the real file — the route with WP4's edits reversed must be
// byte-identical (sha256) to the pre-WP4 route, so POST is the pre-WP4 POST
// plus exactly WP4's statements and nothing else.
//
// Phase 14 WP5 (sections [40]–[45]) — prompt alignment (A6). With the gate
// open the execute-step prompt follows the authority: the template, the
// storefront family and an owned recipe grid are STATED as fixed and the model
// is no longer asked to choose them; the bounds it is shown are the bounds the
// build applies; split_cta is asked for only when the archetype bundle is
// applied. With the gate closed the prompt step hands back the object it was
// given, so both AI steps send the pre-WP5 text byte for byte. The route's WP5
// block, its two prompt helpers and POST's own prompt statements are LIFTED
// and run here in both gate states — nothing below compares against a
// script-side copy of the prompt. Sections [33], [37] and [39] were re-pointed
// for WP5 (not removed): the authority now has one more reader, the closed-
// gate prompt statements end where the WP5 step begins, and the POST-identity
// proof reverses WP5's edits before WP4's against the SAME pre-WP4 hash.
// ─────────────────────────────────────────────────────────────────────────────

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { ELITE_COPY_RULES } from '../lib/adCopy';
import { TEMPLATE_THEMES, contrastRatio, judgeAccent } from '../lib/siteTheme';
import {
  ACCENT_PRESET_SLOTS,
  ARCHETYPES,
  ARCHETYPE_KEYS,
  ARCHITECTURES,
  ASSIGNMENT_REASON_MARKERS,
  ASSIGNMENT_RENDER_WINDOW,
  CLASSIC_BLOCK_MIX,
  DEFAULT_STOREFRONT_FAMILY,
  SITE_FONT_KEYS,
  SITE_TEMPLATES,
  STUDIO_NICHES,
  SUBTRACTION_TEMPLATE_KEY,
  SiteConceptSchema,
  SiteThemeSchema,
  TEMPLATE_KEYS,
  WebsiteConfigSchema,
  WebsiteGenerationSchema,
  applyArchetype,
  applyGenerationLayout,
  archetypeLayoutBounds,
  assignedRecipeGrid,
  carryStorefrontDecision,
  classicLayoutBounds,
  composeVisualSystem,
  generationToConfig,
  RITUAL_RECIPE_GENERATION_ENABLED,
  STOREFRONT_FAMILIES,
  STOREFRONT_FAMILY_REASON_MARKERS,
  SUBTRACTION_ASSIGNMENT_RULES,
  alignAssignmentInputs,
  applyExpressionSelection,
  assignArchitecture,
  assignArchitectureOrFloor,
  assignmentDecisionSource,
  describeArchitectureAssignment,
  expressionFloorSignals,
  formatArchitectureAssignment,
  formatExpressionSelection,
  groupCounterAisles,
  guardRecipeGridPick,
  isExpressionForArchitecture,
  isStorefrontDecision,
  normalizeCategoryForAssignment,
  resolveHeroMedia,
  resolveRitualComposition,
  resolveRitualRecipe,
  ritualRecipeEligibility,
  selectExpression,
  selectGalleryExhibits,
  templateFromCategory,
  type ArchitectureAssignment,
  type ArchitectureAssignmentInput,
  type ExpressionSignals,
  type HeroMedia,
  type LayoutBounds,
  type SiteArchetype,
  type SiteConcept,
  type SiteProduct,
  type StorefrontDecision,
  type TemplateKey,
  type WebsiteConfig,
  type WebsiteGeneration,
  type WebsiteLayout,
} from '../lib/siteTemplates';

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown): void {
  if (ok) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

type Spec = { priced?: boolean; pictured?: boolean; ad?: boolean; category?: string | null };
function inventory(count: number, spec: Spec = {}, perItem?: (i: number) => Spec): SiteProduct[] {
  return Array.from({ length: count }, (_, i) => {
    const s = { ...spec, ...(perItem ? perItem(i) : {}) };
    return {
      id: `p${i + 1}`,
      name: `Product ${i + 1}`,
      price: s.priced === false ? null : 100 + i,
      description: null,
      image_url: s.pictured === false ? null : `https://img/${i}.jpg`,
      ad_video_url: null,
      ad_hero_image_url: s.ad ? `https://ad/${i}.jpg` : null,
      category: s.category === undefined ? 'General' : s.category,
    };
  });
}
const banner: HeroMedia = { type: 'image', url: 'https://banner.jpg' };
const run = (input: ArchitectureAssignmentInput): ArchitectureAssignment => assignArchitecture(input);

console.log('\n[1] Phase 10G §7 test matrix');
{
  // Counter happy path — Electronics, 20 priced, 3 categories, 100% pictured.
  const a = run({ niche: 'tech', products: inventory(20, {}, (i) => ({ category: ['Phones', 'Laptops', 'Audio'][i % 3] })), heroMedia: banner });
  check('electronics → counter/ritual/high', a.architecture === 'counter' && a.template === 'ritual' && a.confidence === 'high', a);

  // Counter floor — Beauty & Personal Care, 6 priced, 1 category, 80% pictured.
  const b = run({ niche: 'cosmetics', products: inventory(10, {}, (i) => ({ pictured: i < 8, category: 'Soaps' })), heroMedia: null });
  check('beauty 10 priced / 1 category / 80% → classic (tie-break: under 12 priced)', b.architecture === 'classic', b);
  const b2 = run({ niche: 'cosmetics', products: inventory(12, {}, (i) => ({ pictured: i < 10, category: 'Soaps' })), heroMedia: null });
  check('beauty 12 priced / 1 category / 83% → counter/medium (tie-break)', b2.architecture === 'counter' && b2.confidence === 'medium', b2);

  // Counter rejected by imagery — General Retail, 30 priced, 50% pictured.
  const c = run({ niche: 'general', products: inventory(30, {}, (i) => ({ pictured: i % 2 === 0, category: ['A', 'B', 'C'][i % 3] })), heroMedia: banner });
  check('general retail 50% pictured → classic, names the 70% rule', c.architecture === 'classic' && c.confidence === 'low' && c.reason.includes('70%'), c);

  // Gallery happy path — Jewellery, 5 pictured, banner present.
  const d = run({ niche: 'jewelry', products: inventory(5, { category: 'Rings' }), heroMedia: banner });
  check('jewellery 5 pictured + banner → gallery/ritual', d.architecture === 'gallery' && d.template === 'ritual', d);
  const d2 = run({ niche: 'jewelry', products: inventory(5, { category: 'Rings' }, (i) => ({ ad: i === 0 })), heroMedia: banner });
  check('jewellery + Ad Studio hero → gallery/high', d2.architecture === 'gallery' && d2.confidence === 'high', d2);

  // Gallery rejected, no hero — Fragrance (home niche), 5 pictured, no banner.
  const e = run({ niche: 'home', dominantCategory: 'Fragrance', products: inventory(5, { category: 'Attars' }), heroMedia: null });
  check('fragrance, no hero → classic, names hero media', e.architecture === 'classic' && e.eligibility.gallery.reasons.some((r) => r.includes('hero media')), e);

  // Gallery rejected, few exhibits — Artisan Goods (free text), 1 pictured.
  const f = run({ niche: 'Artisan crafts', products: inventory(3, {}, (i) => ({ pictured: i === 0, category: 'Baskets' })), heroMedia: banner });
  check('artisan 1 pictured → classic/low (gallery preferred, ineligible)', f.architecture === 'classic' && f.confidence === 'low', f);

  // Menu-occasion rejection — Cakes & Bakery, 10 priced, banner.
  const g = run({ niche: 'food', products: inventory(10, {}, (i) => ({ category: ['Cakes', 'Cupcakes'][i % 2] })), heroMedia: banner });
  check('bakery → classic/high, both recipes rejected, editorial routing preserved',
    g.architecture === 'classic' && g.confidence === 'high' && !g.eligibility.counter.eligible && !g.eligibility.gallery.eligible && g.template === 'editorial', g);
  const g2 = run({ niche: 'Najat Cakes bakery', products: inventory(10), heroMedia: banner });
  check('free-text "bakery" → culinary rejection too', g2.architecture === 'classic' && g2.template === 'editorial', g2);

  // Seller override — Abayas with Editorial override, Gallery-eligible.
  const h = run({ niche: 'fashion', products: inventory(5, { category: 'Abayas' }), heroMedia: banner, forcedTemplate: { template: 'editorial', source: 'seller-template' } });
  check('abayas + editorial override → classic/editorial, overriddenBy seller-template, low',
    h.architecture === 'classic' && h.template === 'editorial' && h.overriddenBy === 'seller-template' && h.confidence === 'low', h);
  const h2 = run({ niche: 'fashion', products: inventory(5, { category: 'Abayas' }), heroMedia: banner, forcedTemplate: { template: 'ritual', source: 'seller-archetype' } });
  check('abayas + ritual archetype → gallery stands, overriddenBy recorded', h2.architecture === 'gallery' && h2.template === 'ritual' && h2.overriddenBy === 'seller-archetype', h2);

  // Electronics, no niche declared — free-text keyword path.
  const i = run({ niche: null, dominantCategory: 'electronics', products: inventory(15, {}, (k) => ({ category: ['Phones', 'Chargers'][k % 2] })), heroMedia: null });
  check('free-text electronics → counter/ritual', i.architecture === 'counter' && i.template === 'ritual', i);

  // Service merchant — event services, free text.
  const j = run({ niche: 'Event services', products: inventory(3, { category: 'Packages' }), heroMedia: banner });
  check('event services → classic/low, both rejected', j.architecture === 'classic' && j.confidence === 'low' && !j.eligibility.counter.eligible && !j.eligibility.gallery.eligible, j);

  // Cosmetics with a hero line and few pieces → gallery via tie-break.
  const k = run({ niche: 'cosmetics', products: inventory(4, { category: 'Serum' }), heroMedia: banner });
  check('cosmetics 4 pictured + banner → gallery/medium (tie-break)', k.architecture === 'gallery' && k.confidence === 'medium', k);

  // Cosmetics mid-size → classic, template stays the ritual hint.
  const l = run({ niche: 'cosmetics', products: inventory(8, { category: 'Serum' }), heroMedia: banner });
  check('cosmetics 8 priced + banner → classic/medium on ritual', l.architecture === 'classic' && l.confidence === 'medium' && l.template === 'ritual', l);

  // Counter total-product floor: 2 categories of 1 product each.
  const m = run({ niche: 'tech', products: inventory(2, {}, (k) => ({ category: ['A', 'B'][k] })), heroMedia: null });
  check('tech 2 products / 2 categories → classic (product floor)', m.architecture === 'classic' && m.eligibility.counter.reasons.some((r) => r.includes('4 products')), m);

  // Empty inventory never throws.
  const n = run({ niche: 'general', products: [], heroMedia: null });
  check('empty inventory → classic, no throw', n.architecture === 'classic' && n.signals.productCount === 0, n);
}

console.log('\n[2] Category normalisation (assignment only)');
{
  const norm = normalizeCategoryForAssignment;
  check('"Decor" / "decor " / "Decors" → one key', norm('Decor') === 'decor' && norm('decor ') === 'decor' && norm('Decors') === 'decor');
  check('Dresses → dress', norm('Dresses') === 'dress');
  check('Watches → watch', norm('Watches') === 'watch');
  check('Accessories → accessory', norm('Accessories') === 'accessory');
  check('Glass stays glass', norm('Glass') === 'glass');
  check('empty → null', norm('   ') === null && norm(null) === null);
  const a = run({ niche: 'home', products: inventory(12, {}, (i) => ({ category: ['Decor', 'decor', 'Decor '][i % 3] })), heroMedia: null });
  check('three casings count as one category', a.signals.categoryCount === 1, a.signals);
}

console.log('\n[3] Determinism + explanation');
{
  const input: ArchitectureAssignmentInput = { niche: 'tech', products: inventory(20, {}, (i) => ({ category: ['A', 'B', 'C'][i % 3] })), heroMedia: banner };
  const x = JSON.stringify(run(input));
  const y = JSON.stringify(run(input));
  check('same inputs → identical object', x === y);
  const desc = describeArchitectureAssignment(run(input));
  check('dashboard copy composed from the object', desc.title === 'Recommended architecture: Counter' && desc.why.includes('20 priced products') && desc.unlock === null, desc);
  const locked = describeArchitectureAssignment(run({ niche: 'jewelry', products: inventory(5, { category: 'Rings' }), heroMedia: null }));
  check('locked recipe surfaces an Unlock line', typeof locked.unlock === 'string' && locked.unlock.includes('Unlock Gallery'), locked);
}

console.log('\n[4] Zero effect while the gate is closed');
{
  check('RITUAL_RECIPE_GENERATION_ENABLED is still false', RITUAL_RECIPE_GENERATION_ENABLED === false);
  check('guard strips counter on ritual', guardRecipeGridPick('counter', 'ritual') === undefined);
  check('guard strips gallery on ritual', guardRecipeGridPick('gallery', 'ritual') === undefined);
  check('guard passes masonry untouched', guardRecipeGridPick('masonry', 'ritual') === 'masonry');
  const legacy = { template_key: 'ritual' as const, storefront_family: 'lifestyle-story' as const, layout_strategy: { hero: 'split' as const, grid: 'masonry' as const } };
  check('legacy ritual row resolves classic', resolveRitualRecipe(legacy) === 'classic');
  const comp = resolveRitualComposition({ config: legacy, products: inventory(12), heroMedia: banner });
  check('legacy composition returns raw hero + grid', comp.recipe === 'classic' && comp.hero === 'split' && comp.grid === 'masonry' && comp.fallback === null, comp);
}

console.log('\n[5] Phase 10I — assignment object unchanged (Phase 10H snapshots)');
{
  // Exact JSON the engine produced at the end of Phase 10H for three inputs.
  // Any drift in thresholds, confidence, wording or field order fails here.
  const snap = (input: ArchitectureAssignmentInput, expected: unknown) =>
    JSON.stringify(run(input)) === JSON.stringify(expected);
  check('electronics snapshot', snap(
    { niche: 'tech', products: inventory(20, {}, (i) => ({ category: ['Phones', 'Laptops', 'Audio'][i % 3] })), heroMedia: banner },
    { architecture: 'counter', template: 'ritual', confidence: 'high', reason: '20 priced products across 3 categories, 100% photographed. Buyers in this niche compare and scan, so the catalog is the page.', eligibility: { counter: { eligible: true, reasons: [] }, gallery: { eligible: true, reasons: [] } }, signals: { niche: 'tech', productCount: 20, pricedCount: 20, picturedRatio: 1, categoryCount: 3, heroMedia: true, adStudioAssets: 0 }, overriddenBy: null },
  ));
  check('jewellery snapshot', snap(
    { niche: 'jewelry', products: inventory(5, { category: 'Rings' }), heroMedia: banner },
    { architecture: 'gallery', template: 'ritual', confidence: 'medium', reason: '5 photographed pieces and a shop banner. Pieces in this niche sell on the image, so each gets a full plate.', eligibility: { counter: { eligible: false, reasons: ['needs 6 priced products or 2 categories (has 5 priced, 1 categories)'] }, gallery: { eligible: true, reasons: [] } }, signals: { niche: 'jewelry', productCount: 5, pricedCount: 5, picturedRatio: 1, categoryCount: 1, heroMedia: true, adStudioAssets: 0 }, overriddenBy: null },
  ));
  check('fragrance snapshot', snap(
    { niche: 'home', dominantCategory: 'Attars', products: inventory(5, { category: 'Attars' }), heroMedia: null },
    { architecture: 'classic', template: 'ritual', confidence: 'medium', reason: '5 priced products across 1 category, 100% photographed. Neither a counter nor a vitrine is clearly stronger, so the story leads.', eligibility: { counter: { eligible: false, reasons: ['needs 6 priced products or 2 categories (has 5 priced, 1 categories)'] }, gallery: { eligible: false, reasons: ['needs hero media (site hero image or shop banner)'] } }, signals: { niche: 'home', productCount: 5, pricedCount: 5, picturedRatio: 1, categoryCount: 1, heroMedia: false, adStudioAssets: 0 }, overriddenBy: null },
  ));
  const override = run({ niche: 'fashion', products: inventory(5, { category: 'Abayas' }), heroMedia: banner, forcedTemplate: { template: 'editorial', source: 'seller-template' } });
  check('override reason wording unchanged', override.reason === 'Gallery fits (5 photographed pieces and a shop banner) but the seller chose the "editorial" template, which has no recipes.', override.reason);
  const locked = run({ niche: 'jewelry', products: inventory(5, { category: 'Rings' }), heroMedia: null });
  check('locked-preference reason wording unchanged', locked.reason === 'Gallery fits this niche but is not yet unlocked: needs hero media (site hero image or shop banner).', locked.reason);
}

console.log('\n[6] Phase 10I — decision source + log formatter');
{
  const src = (input: ArchitectureAssignmentInput) => assignmentDecisionSource(run(input));
  check('niche preference → niche-preference', src({ niche: 'tech', products: inventory(20, {}, (i) => ({ category: ['A', 'B', 'C'][i % 3] })), heroMedia: banner }) === 'niche-preference');
  check('gallery preference → niche-preference', src({ niche: 'jewelry', products: inventory(5, { category: 'Rings' }), heroMedia: banner }) === 'niche-preference');
  check('counter tie-break → tie-break', src({ niche: 'cosmetics', products: inventory(12, {}, (i) => ({ pictured: i < 10, category: 'Soaps' })), heroMedia: null }) === 'tie-break');
  check('gallery tie-break → tie-break', src({ niche: 'cosmetics', products: inventory(4, { category: 'Serum' }), heroMedia: banner }) === 'tie-break');
  check('classic tie-break → tie-break', src({ niche: 'cosmetics', products: inventory(8, { category: 'Serum' }), heroMedia: banner }) === 'tie-break');
  check('menu-occasion → fallback', src({ niche: 'food', products: inventory(10), heroMedia: banner }) === 'fallback');
  check('service → fallback', src({ niche: 'Event services', products: inventory(3), heroMedia: banner }) === 'fallback');
  check('locked preference → fallback', src({ niche: 'jewelry', products: inventory(5, { category: 'Rings' }), heroMedia: null }) === 'fallback');
  check('forced editorial → seller-override', src({ niche: 'fashion', products: inventory(5, { category: 'Abayas' }), heroMedia: banner, forcedTemplate: { template: 'editorial', source: 'seller-template' } }) === 'seller-override');
  check('forced ritual keeps niche-preference', src({ niche: 'fashion', products: inventory(5, { category: 'Abayas' }), heroMedia: banner, forcedTemplate: { template: 'ritual', source: 'seller-archetype' } }) === 'niche-preference');

  const a = run({ niche: 'jewelry', products: inventory(5, { category: 'Rings' }), heroMedia: null });
  const block = formatArchitectureAssignment(a, { shopId: 'shop-1', gateOpen: RITUAL_RECIPE_GENERATION_ENABLED });
  const lines = block.split('\n');
  check('formatter is deterministic', block === formatArchitectureAssignment(a, { shopId: 'shop-1', gateOpen: RITUAL_RECIPE_GENERATION_ENABLED }));
  check('formatter: 7 lines, stable prefix', lines.length === 7 && lines[0] === '[architecture-assignment] shop=shop-1 gate=closed mode=observational', lines);
  check('formatter: architecture line carries confidence + decision source', lines[1] === '  architecture : classic (confidence low, decided by fallback)', lines[1]);
  // Classic on a jewellery niche recommends the existing keyword heuristic's
  // template (editorial) — the engine never re-routes Classic.
  check('formatter: template line carries overriddenBy', lines[2] === '  template     : editorial (recommended; overriddenBy none)', lines[2]);
  check('formatter: reason is the object reason verbatim', lines[3] === `  reason       : ${a.reason}`);
  check('formatter: signals line', lines[4] === '  signals      : niche=jewelry products=5 priced=5 pictured=100% categories=1 heroMedia=no adStudio=0', lines[4]);
  check('formatter: counter eligibility reuses engine wording', lines[5] === '  counter      : not eligible — needs 6 priced products or 2 categories (has 5 priced, 1 categories)', lines[5]);
  check('formatter: gallery eligibility reuses engine wording', lines[6] === '  gallery      : not eligible — needs hero media (site hero image or shop banner)', lines[6]);
  const eligibleBlock = formatArchitectureAssignment(run({ niche: 'tech', products: inventory(20, {}, (i) => ({ category: ['A', 'B', 'C'][i % 3] })), heroMedia: banner }), { shopId: 's', gateOpen: false });
  check('formatter: eligible recipes print "eligible"', eligibleBlock.includes('  counter      : eligible\n') && eligibleBlock.endsWith('  gallery      : eligible'));
  check('formatter: object fields untouched (7 keys, same order)', Object.keys(a).join(',') === 'architecture,template,confidence,reason,eligibility,signals,overriddenBy', Object.keys(a));
}

console.log('\n[7] Phase 10L.3 — expression selection (10K.3 §2)');
{
  const pick = (i: Parameters<typeof selectExpression>[0]) => selectExpression(i);
  const base = { dominantCategory: null, categoryCount: 0, exhibits: 0 };

  // Counter
  const c1 = pick({ ...base, architecture: 'counter', niche: 'cosmetics', categoryCount: 4 });
  check('C1 routine by niche (cosmetics)', c1.expression === 'routine' && c1.reason === 'Routine Counter: cosmetics, 4 aisles', c1);
  check('C1 routine by niche (wellness)', pick({ ...base, architecture: 'counter', niche: 'wellness', categoryCount: 3 }).expression === 'routine');
  const c1short = pick({ ...base, architecture: 'counter', niche: 'cosmetics', categoryCount: 2 });
  check('C1 needs 3 categories — 2 falls to item', c1short.expression === 'item' && c1short.reason === 'Item Counter: cosmetics, 2 aisles', c1short);
  const c2 = pick({ ...base, architecture: 'counter', niche: null, dominantCategory: 'Skin Care', categoryCount: 3 });
  check('C2 routine by vocabulary fallback', c2.expression === 'routine' && c2.reason === 'Routine Counter: Skin Care, 3 aisles', c2);
  check('C2 needs 3 categories', pick({ ...base, architecture: 'counter', niche: null, dominantCategory: 'Skin Care', categoryCount: 2 }).expression === 'item');
  check('C2 never fires when a niche resolved (niche wins)', pick({ ...base, architecture: 'counter', niche: 'tech', dominantCategory: 'Skin Care', categoryCount: 5 }).expression === 'item');
  const c3 = pick({ ...base, architecture: 'counter', niche: 'tech', dominantCategory: 'Phones', categoryCount: 5 });
  check('C3 item default (tech)', c3.expression === 'item' && c3.reason === 'Item Counter: tech, 5 aisles', c3);
  check('C3 item default (no niche, non-routine category)', pick({ ...base, architecture: 'counter', niche: null, dominantCategory: 'Phones', categoryCount: 5 }).expression === 'item');
  const c3bare = pick({ ...base, architecture: 'counter', niche: null, categoryCount: 1 });
  check('C3 item default (no niche, no category)', c3bare.expression === 'item' && c3bare.reason === 'Item Counter: no niche, 1 aisle', c3bare);

  // Gallery
  const g1 = pick({ ...base, architecture: 'gallery', niche: 'jewelry', exhibits: 4 });
  check('G1 scale by niche (jewelry)', g1.expression === 'scale' && g1.reason === 'Scale Gallery: jewelry, 4 photographed pieces', g1);
  check('G1 scale by niche (fashion)', pick({ ...base, architecture: 'gallery', niche: 'fashion', exhibits: 3 }).expression === 'scale');
  const g1short = pick({ ...base, architecture: 'gallery', niche: 'jewelry', exhibits: 2 });
  check('G1 needs 3 exhibits — 2 falls to atmosphere', g1short.expression === 'atmosphere' && g1short.reason === 'Atmosphere Gallery: jewelry, 2 photographed pieces', g1short);
  const g2 = pick({ ...base, architecture: 'gallery', niche: null, dominantCategory: 'Gold Rings', exhibits: 3 });
  check('G2 scale by vocabulary fallback', g2.expression === 'scale' && g2.reason === 'Scale Gallery: Gold Rings, 3 photographed pieces', g2);
  check('G2 needs 3 exhibits', pick({ ...base, architecture: 'gallery', niche: null, dominantCategory: 'Gold Rings', exhibits: 2 }).expression === 'atmosphere');
  check('G2 never fires when a niche resolved (niche wins)', pick({ ...base, architecture: 'gallery', niche: 'home', dominantCategory: 'Gold Rings', exhibits: 6 }).expression === 'atmosphere');
  const g3 = pick({ ...base, architecture: 'gallery', niche: 'home', dominantCategory: 'Oud', exhibits: 6 });
  check('G3 atmosphere default (home)', g3.expression === 'atmosphere' && g3.reason === 'Atmosphere Gallery: home, 6 photographed pieces', g3);
  check('G3 atmosphere default (no niche, non-scale category)', pick({ ...base, architecture: 'gallery', niche: null, dominantCategory: 'Oud', exhibits: 6 }).expression === 'atmosphere');

  // No expression outside Counter / Gallery
  const classic = pick({ architecture: 'classic', niche: 'cosmetics', dominantCategory: 'Skin Care', categoryCount: 9, exhibits: 9 });
  check('classic → no expression, no reason', classic.expression === undefined && classic.reason === null, classic);
  const sub = pick({ architecture: 'subtraction', niche: 'jewelry', dominantCategory: 'Gold', categoryCount: 9, exhibits: 9 });
  check('subtraction → no expression, no reason', sub.expression === undefined && sub.reason === null, sub);

  // Determinism + no cross-architecture output, swept over every input shape.
  const niches = [null, 'cosmetics', 'fashion', 'jewelry', 'home', 'food', 'wellness', 'tech', 'general'] as const;
  let deterministic = true;
  let inFamily = true;
  for (const architecture of ['counter', 'gallery'] as const) {
    for (const niche of niches) {
      for (const dominantCategory of [null, 'Skin Care', 'Gold Rings', 'Phones']) {
        for (const n of [0, 2, 3, 8]) {
          const input = { architecture, niche, dominantCategory, categoryCount: n, exhibits: n };
          const a = pick(input);
          if (JSON.stringify(a) !== JSON.stringify(pick({ ...input }))) deterministic = false;
          const allowed = architecture === 'counter' ? ['routine', 'item'] : ['atmosphere', 'scale'];
          if (!a.expression || !allowed.includes(a.expression) || !a.reason) inFamily = false;
        }
      }
    }
  }
  check('selection is deterministic across the full sweep', deterministic);
  check('counter only yields routine|item, gallery only atmosphere|scale, always with a reason', inFamily);

  // Chained from the real assignment object (signals only, no new rules).
  const routineShop = run({ niche: 'wellness', products: inventory(12, {}, (i) => ({ category: ['Serums', 'Creams', 'Oils'][i % 3] })), heroMedia: banner });
  const chained = pick({ architecture: routineShop.architecture, niche: routineShop.signals.niche, dominantCategory: 'Serums', categoryCount: routineShop.signals.categoryCount, exhibits: 0 });
  check('assignment → selection: wellness counter with 3 aisles is Routine', routineShop.architecture === 'counter' && chained.expression === 'routine', { a: routineShop.architecture, chained });
}

console.log('\n[8] Phase 10L.3 — resolver expression support + render-time degrade (10K.3 §3)');
{
  type Cfg = Parameters<typeof resolveRitualComposition>[0]['config'];
  const aisles = (n: number) => inventory(12, {}, (i) => ({ category: ['Serums', 'Creams', 'Oils', 'Soaps'][i % n] }));
  // `expression` is deliberately untyped here: the resolver must validate a
  // value it did not parse (unknown strings, another architecture's value).
  const cfg = (grid: 'counter' | 'gallery', expression?: unknown): Cfg =>
    ({
      template_key: 'ritual',
      storefront_family: 'lifestyle-story',
      layout_strategy: expression === undefined ? { grid } : { grid, expression },
    }) as Cfg;
  const counter = (expression: unknown, products: SiteProduct[]) => resolveRitualComposition({ config: cfg('counter', expression), products, heroMedia: banner });
  const gallery = (expression: unknown, products: SiteProduct[]) => resolveRitualComposition({ config: cfg('gallery', expression), products, heroMedia: banner });
  const unpicturedAisles = () => inventory(12, { pictured: false }, (i) => ({ category: ['A', 'B', 'C'][i % 3] }));

  // Accept + validate against the architecture
  const routine = counter('routine', aisles(3));
  check('counter + routine + 3 categories → routine', routine.recipe === 'product-first' && routine.expression === 'routine' && routine.expressionFallback === null, routine);
  const item = counter('item', aisles(1));
  check('counter + item → item', item.recipe === 'product-first' && item.expression === 'item' && item.expressionFallback === null, item);
  const scale = gallery('scale', inventory(3));
  check('gallery + scale + 3 exhibits → scale', scale.recipe === 'gallery-led' && scale.expression === 'scale' && scale.expressionFallback === null, scale);
  const atmosphere = gallery('atmosphere', inventory(6));
  check('gallery + atmosphere → atmosphere', atmosphere.expression === 'atmosphere' && atmosphere.expressionFallback === null, atmosphere);

  // Required degrades
  const routineShort = counter('routine', aisles(2));
  check('routine with fewer than 3 categories → item', routineShort.recipe === 'product-first' && routineShort.expression === 'item' && routineShort.expressionFallback === 'routine needs 3 categories (has 2)', routineShort);
  const routinePlural = counter('routine', inventory(12, {}, (i) => ({ category: ['Serum', 'Serums', ' serums ', 'Cream'][i % 4] })));
  check('routine counts NORMALISED categories (Serum/Serums/ serums = 1)', routinePlural.expression === 'item' && routinePlural.expressionFallback === 'routine needs 3 categories (has 2)', routinePlural);
  const scaleShort = gallery('scale', inventory(2));
  check('scale with fewer than 3 exhibits → atmosphere', scaleShort.recipe === 'gallery-led' && scaleShort.expression === 'atmosphere' && scaleShort.expressionFallback === 'scale needs 3 exhibits (has 2)', scaleShort);
  const scaleUnpictured = gallery('scale', inventory(6, {}, (i) => ({ pictured: i < 2 })));
  check('scale counts EXHIBITS, not products (6 products, 2 pictured)', scaleUnpictured.expression === 'atmosphere', scaleUnpictured);

  // Absent / unknown / cross-architecture → base expression
  const absentC = counter(undefined, aisles(4));
  check('counter, no expression → item (current render), no reason', absentC.expression === 'item' && absentC.expressionFallback === null, absentC);
  const absentG = gallery(undefined, inventory(6));
  check('gallery, no expression → atmosphere (current render), no reason', absentG.expression === 'atmosphere' && absentG.expressionFallback === null, absentG);
  const unknownC = counter('banded', aisles(4));
  check('counter, unknown expression → item', unknownC.expression === 'item' && unknownC.expressionFallback === 'unknown expression is not a Counter expression', unknownC);
  const unknownG = gallery(42, inventory(6));
  check('gallery, unknown expression → atmosphere', unknownG.expression === 'atmosphere' && unknownG.expressionFallback === 'unknown expression is not a Gallery expression', unknownG);
  const crossC = counter('scale', aisles(4));
  check('counter + scale → item (no cross-architecture)', crossC.recipe === 'product-first' && crossC.expression === 'item' && crossC.expressionFallback === "'scale' is not a Counter expression", crossC);
  const crossG = gallery('routine', inventory(6));
  check('gallery + routine → atmosphere (no cross-architecture)', crossG.recipe === 'gallery-led' && crossG.expression === 'atmosphere' && crossG.expressionFallback === "'routine' is not a Gallery expression", crossG);
  check('counter + atmosphere → item', counter('atmosphere', aisles(4)).expression === 'item');
  check('gallery + item → atmosphere', gallery('item', inventory(6)).expression === 'atmosphere');

  // Classic / Subtraction / non-ritual → no expression, even when one is written
  const classic = resolveRitualComposition({ config: { template_key: 'ritual', storefront_family: 'lifestyle-story', layout_strategy: { hero: 'split', grid: 'masonry', expression: 'routine' } }, products: aisles(4), heroMedia: banner });
  check('classic → no expression', classic.recipe === 'classic' && classic.expression === undefined && classic.expressionFallback === null, classic);
  const sub = resolveRitualComposition({ config: { template_key: 'ritual', storefront_family: 'subtraction', layout_strategy: { grid: 'counter', expression: 'routine' } }, products: aisles(4), heroMedia: banner });
  check('subtraction → no expression', sub.recipe === 'subtraction' && sub.expression === undefined && sub.expressionFallback === null, sub);
  const editorial = resolveRitualComposition({ config: { template_key: 'editorial', storefront_family: 'lifestyle-story', layout_strategy: { grid: 'gallery', expression: 'scale' } }, products: inventory(6), heroMedia: banner });
  check('non-ritual template → no expression', editorial.recipe === 'classic' && editorial.expression === undefined, editorial);

  // Architecture degrade runs first and wins: a recipe that fell to classic carries no expression.
  const counterFell = counter('routine', unpicturedAisles());
  check('counter ineligible → classic, no expression', counterFell.requested === 'product-first' && counterFell.recipe === 'classic' && counterFell.expression === undefined && counterFell.expressionFallback === null && counterFell.fallback !== null, counterFell);
  const galleryFell = resolveRitualComposition({ config: cfg('gallery', 'scale'), products: inventory(6), heroMedia: null });
  check('gallery ineligible → classic, no expression', galleryFell.requested === 'gallery-led' && galleryFell.recipe === 'classic' && galleryFell.expression === undefined && galleryFell.expressionFallback === null, galleryFell);

  // Existing resolver output is untouched by the expression key.
  const strip = (c: ReturnType<typeof resolveRitualComposition>) => JSON.stringify({ requested: c.requested, recipe: c.recipe, hero: c.hero, grid: c.grid, fallback: c.fallback });
  check('counter: requested/recipe/hero/grid/fallback identical with and without expression',
    strip(routine) === strip(counter(undefined, aisles(3))) && strip(routineShort) === strip(counter(undefined, aisles(2))) && strip(counterFell) === strip(counter(undefined, unpicturedAisles())));
  check('gallery: requested/recipe/hero/grid/fallback identical with and without expression',
    strip(scale) === strip(gallery(undefined, inventory(3))) && strip(scaleShort) === strip(gallery(undefined, inventory(2))) && strip(galleryFell) === strip(resolveRitualComposition({ config: cfg('gallery'), products: inventory(6), heroMedia: null })));
  const legacyComp = resolveRitualComposition({ config: { template_key: 'ritual', storefront_family: 'lifestyle-story', layout_strategy: { hero: 'split', grid: 'masonry' } }, products: inventory(12), heroMedia: banner });
  check('legacy row: same five fields as before, expression absent', strip(legacyComp) === '{"requested":"classic","recipe":"classic","hero":"split","grid":"masonry","fallback":null}' && legacyComp.expression === undefined, legacyComp);
  check('resolver is deterministic', JSON.stringify(counter('routine', aisles(3))) === JSON.stringify(routine) && JSON.stringify(gallery('scale', inventory(2))) === JSON.stringify(scaleShort));
  check('gate still closed — no stored row can reach an expression branch', RITUAL_RECIPE_GENERATION_ENABLED === false && guardRecipeGridPick('counter', 'ritual') === undefined && guardRecipeGridPick('gallery', 'ritual') === undefined);
}

console.log('\n[9] Phase 10L.4 — expression persistence, write-time validation + log (10K.3 §2)');
{
  // applyExpressionSelection reads template_key / storefront_family /
  // layout_strategy and carries every other key through by reference, so a
  // minimal shell is enough here (scripts/verifyConfigCompat.ts runs the same
  // write over schema-valid configs and the editor / restore round-trips).
  const shell = (template_key: string, layout_strategy?: Record<string, unknown>, storefront_family?: string): WebsiteConfig =>
    ({
      template_key,
      niche_reasoning: 'fixture',
      site: { marker: 'untouched' },
      ...(layout_strategy ? { layout_strategy } : {}),
      ...(storefront_family ? { storefront_family } : {}),
    }) as unknown as WebsiteConfig;
  const routineSignals: ExpressionSignals = { niche: 'cosmetics', dominantCategory: 'serums', categoryCount: 4, exhibits: 5 };
  const itemSignals: ExpressionSignals = { niche: 'tech', dominantCategory: 'phones', categoryCount: 4, exhibits: 5 };
  const scaleSignals: ExpressionSignals = { niche: 'jewelry', dominantCategory: 'rings', categoryCount: 1, exhibits: 5 };
  const atmosphereSignals: ExpressionSignals = { niche: 'home', dominantCategory: 'oud', categoryCount: 1, exhibits: 5 };
  const open = (config: WebsiteConfig, signals: ExpressionSignals | null) => applyExpressionSelection(config, { gridSurvivedGuard: true, signals });
  // The route's exact call: the guard is re-evaluated on the config's own values.
  const asRoute = (config: WebsiteConfig, signals: ExpressionSignals | null) =>
    applyExpressionSelection(config, {
      gridSurvivedGuard: guardRecipeGridPick(config.layout_strategy?.grid, config.template_key) === config.layout_strategy?.grid,
      signals,
    });
  const hasKey = (config: WebsiteConfig) => 'expression' in ((config.layout_strategy ?? {}) as Record<string, unknown>);

  // ── Writes: the four valid pairs ───────────────────────────────────────
  const counterCfg = shell('ritual', { hero: 'text-centric', grid: 'counter' }, 'lifestyle-story');
  const galleryCfg = shell('ritual', { hero: 'standard', grid: 'gallery' }, 'lifestyle-story');
  const routine = open(counterCfg, routineSignals);
  check('Routine Counter writes layout_strategy.expression = routine', routine.architecture === 'counter' && routine.expression === 'routine' && routine.config.layout_strategy?.expression === 'routine' && routine.reason === 'Routine Counter: cosmetics, 4 aisles', routine);
  const item = open(counterCfg, itemSignals);
  check('Item Counter writes layout_strategy.expression = item', item.architecture === 'counter' && item.expression === 'item' && item.config.layout_strategy?.expression === 'item' && item.reason === 'Item Counter: tech, 4 aisles', item);
  const scale = open(galleryCfg, scaleSignals);
  check('Scale Gallery writes layout_strategy.expression = scale', scale.architecture === 'gallery' && scale.expression === 'scale' && scale.config.layout_strategy?.expression === 'scale' && scale.reason === 'Scale Gallery: jewelry, 5 photographed pieces', scale);
  const atmosphere = open(galleryCfg, atmosphereSignals);
  check('Atmosphere Gallery writes layout_strategy.expression = atmosphere', atmosphere.architecture === 'gallery' && atmosphere.expression === 'atmosphere' && atmosphere.config.layout_strategy?.expression === 'atmosphere' && atmosphere.reason === 'Atmosphere Gallery: home, 5 photographed pieces', atmosphere);
  check('write adds ONLY the expression key (hero + grid kept, every other key by reference)',
    JSON.stringify(routine.config.layout_strategy) === '{"hero":"text-centric","grid":"counter","expression":"routine"}' &&
    routine.config.site === counterCfg.site && routine.config.template_key === 'ritual' && routine.config.storefront_family === 'lifestyle-story' &&
    Object.keys(routine.config).join(',') === Object.keys(counterCfg).join(','), routine.config);
  check('write never mutates the input config', routine.config !== counterCfg && JSON.stringify(counterCfg.layout_strategy) === '{"hero":"text-centric","grid":"counter"}');
  check('write is deterministic', JSON.stringify(open(counterCfg, routineSignals)) === JSON.stringify(routine) && JSON.stringify(open(galleryCfg, scaleSignals)) === JSON.stringify(scale));
  check('a stale expression on a recipe row is replaced by the selection, never kept',
    open(shell('ritual', { grid: 'counter', expression: 'scale' }), itemSignals).config.layout_strategy?.expression === 'item');

  // ── No write: classic / subtraction / editorial / vitality ─────────────
  const untouched = (name: string, config: WebsiteConfig, architecture: string, reason: string) => {
    for (const [label, result] of [['guard true', open(config, routineSignals)], ['route call', asRoute(config, routineSignals)]] as const) {
      check(`${name} writes nothing (${label}) — same object back`,
        result.config === config && result.expression === undefined && !hasKey(result.config) && result.architecture === architecture && result.reason === reason, { architecture: result.architecture, expression: result.expression, reason: result.reason });
    }
  };
  untouched('classic ritual (masonry)', shell('ritual', { hero: 'split', grid: 'masonry' }, 'lifestyle-story'), 'classic', 'classic has no expressions');
  untouched('classic ritual (no layout_strategy)', shell('ritual'), 'classic', 'classic has no expressions');
  untouched('subtraction', shell('ritual', { hero: 'text-centric', grid: 'masonry' }, 'subtraction'), 'subtraction', 'subtraction has no expressions');
  untouched('subtraction carrying a counter grid', shell('ritual', { grid: 'counter' }, 'subtraction'), 'subtraction', 'subtraction has no expressions');
  untouched('editorial', shell('editorial', { hero: 'split', grid: 'featured-first' }), 'classic', 'classic has no expressions');
  untouched('editorial carrying a gallery grid', shell('editorial', { grid: 'gallery' }), 'classic', 'classic has no expressions');
  untouched('vitality', shell('vitality', { grid: 'standard' }), 'classic', 'classic has no expressions');
  untouched('vitality carrying a counter grid', shell('vitality', { grid: 'counter' }), 'classic', 'classic has no expressions');

  // ── No write: guard failed / no signals ────────────────────────────────
  const gated = asRoute(counterCfg, routineSignals);
  check('gate closed: the route call writes nothing on a counter grid', RITUAL_RECIPE_GENERATION_ENABLED === false && gated.config === counterCfg && gated.expression === undefined && gated.reason === 'counter grid did not survive the generation guard', gated);
  const gatedGallery = asRoute(galleryCfg, scaleSignals);
  check('gate closed: the route call writes nothing on a gallery grid', gatedGallery.config === galleryCfg && gatedGallery.expression === undefined && gatedGallery.reason === 'gallery grid did not survive the generation guard', gatedGallery);
  const noSignals = open(counterCfg, null);
  check('no assignment signals → nothing written (base expression renders)', noSignals.config === counterCfg && noSignals.expression === undefined && noSignals.reason === 'assignment signals unavailable, the base expression renders', noSignals);

  // ── Write-time validation: only valid architecture/expression pairs ────
  const pairs: Array<[Parameters<typeof isExpressionForArchitecture>[0], unknown, boolean]> = [
    ['counter', 'routine', true], ['counter', 'item', true], ['counter', 'scale', false], ['counter', 'atmosphere', false],
    ['gallery', 'atmosphere', true], ['gallery', 'scale', true], ['gallery', 'routine', false], ['gallery', 'item', false],
    ['classic', 'routine', false], ['classic', 'item', false], ['classic', 'atmosphere', false], ['classic', 'scale', false],
    ['subtraction', 'routine', false], ['subtraction', 'item', false], ['subtraction', 'atmosphere', false], ['subtraction', 'scale', false],
    ['counter', undefined, false], ['gallery', undefined, false], ['counter', 'banded', false], ['gallery', 42, false],
  ];
  check('isExpressionForArchitecture: full truth table', pairs.every(([a, e, expected]) => isExpressionForArchitecture(a, e) === expected), pairs.filter(([a, e, expected]) => isExpressionForArchitecture(a, e) !== expected));
  // Sweep every signal shape over both recipe grids: the written value always
  // belongs to the grid's architecture and undefined is never written.
  const niches = [null, 'cosmetics', 'fashion', 'jewelry', 'home', 'food', 'wellness', 'tech', 'general'] as const;
  let onlyValidPairs = true;
  let neverUndefined = true;
  let writes = 0;
  for (const [cfg, architecture] of [[counterCfg, 'counter'], [galleryCfg, 'gallery']] as const) {
    for (const niche of niches) {
      for (const dominantCategory of [null, 'skin care', 'gold rings', 'phones']) {
        for (const n of [0, 2, 3, 8]) {
          const result = open(cfg, { niche, dominantCategory, categoryCount: n, exhibits: n });
          writes += 1;
          const stored = (result.config.layout_strategy as Record<string, unknown> | undefined)?.expression;
          if (!isExpressionForArchitecture(architecture, stored) || stored !== result.expression) onlyValidPairs = false;
          if (hasKey(result.config) && stored === undefined) neverUndefined = false;
        }
      }
    }
  }
  check(`sweep (${writes} writes): counter rows only ever store routine|item, gallery rows only atmosphere|scale`, onlyValidPairs);
  check('sweep: an expression key is never stored as undefined', neverUndefined);

  // ── Chained exactly as the route builds it ─────────────────────────────
  const chain = (input: ArchitectureAssignmentInput, cfg: WebsiteConfig) => {
    const a = run(input);
    const signals: ExpressionSignals = {
      niche: a.signals.niche,
      dominantCategory: input.dominantCategory ?? null,
      categoryCount: a.signals.categoryCount,
      exhibits: selectGalleryExhibits(input.products).length,
    };
    return { a, write: open(cfg, signals) };
  };
  const skincare = inventory(12, {}, (i) => ({ category: ['Serums', 'Creams', 'Oils'][i % 3] }));
  const gambia = chain({ niche: 'wellness', dominantCategory: 'serums', products: skincare, heroMedia: banner }, counterCfg);
  check('route chain: wellness counter, 3 aisles → routine written', gambia.a.architecture === 'counter' && gambia.write.expression === 'routine' && gambia.write.reason === 'Routine Counter: wellness, 3 aisles', gambia.write);
  const gambiaRender = resolveRitualComposition({ config: gambia.write.config, products: skincare, heroMedia: banner });
  check('route chain: the resolver draws the written routine back', gambiaRender.recipe === 'product-first' && gambiaRender.expression === 'routine' && gambiaRender.expressionFallback === null, gambiaRender);
  const electronics = inventory(20, {}, (i) => ({ category: ['Phones', 'Audio', 'Laptops'][i % 3] }));
  const jambaba = chain({ niche: 'tech', dominantCategory: 'phones', products: electronics, heroMedia: banner }, counterCfg);
  check('route chain: tech counter → item written', jambaba.a.architecture === 'counter' && jambaba.write.expression === 'item' && jambaba.write.reason === 'Item Counter: tech, 3 aisles', jambaba.write);
  const rings = inventory(5, { category: 'Rings' });
  const subora = chain({ niche: 'jewelry', dominantCategory: 'rings', products: rings, heroMedia: banner }, galleryCfg);
  check('route chain: jewelry gallery, 5 exhibits → scale written', subora.a.architecture === 'gallery' && subora.write.expression === 'scale' && subora.write.reason === 'Scale Gallery: jewelry, 5 photographed pieces', subora.write);
  const suboraRender = resolveRitualComposition({ config: subora.write.config, products: rings, heroMedia: banner });
  check('route chain: the resolver draws the written scale back', suboraRender.recipe === 'gallery-led' && suboraRender.expression === 'scale', suboraRender);
  const devine = chain({ niche: 'home', dominantCategory: 'oud', products: inventory(5, { category: 'Oud' }), heroMedia: banner }, galleryCfg);
  check('route chain: fragrance gallery → atmosphere written', devine.write.expression === 'atmosphere' && devine.write.reason === 'Atmosphere Gallery: home, 5 photographed pieces', devine.write);
  // The expression follows the GRID the row carries, never the assignment:
  // a jewelry shop assigned Gallery whose row carries a counter grid can only
  // receive a Counter expression.
  const diverged = chain({ niche: 'jewelry', dominantCategory: 'rings', products: rings, heroMedia: banner }, counterCfg);
  check('assigned gallery + counter grid → item (never scale)', diverged.a.architecture === 'gallery' && diverged.write.architecture === 'counter' && diverged.write.expression === 'item', diverged.write);
  const divergedBack = chain({ niche: 'wellness', dominantCategory: 'serums', products: skincare, heroMedia: banner }, galleryCfg);
  check('assigned counter + gallery grid → atmosphere (never routine)', divergedBack.a.architecture === 'counter' && divergedBack.write.architecture === 'gallery' && divergedBack.write.expression === 'atmosphere', divergedBack.write);

  // ── Log block (appended; the Phase 10I block is asserted unchanged in [6]) ─
  const written = formatExpressionSelection(routine, { shopId: 'shop-1', gateOpen: true, assigned: 'counter' }).split('\n');
  check('log: 4 lines, assignment prefix, stage=expression', written.length === 4 && written[0] === '[architecture-assignment] shop=shop-1 gate=open stage=expression', written);
  check('log: architecture line', written[1] === '  architecture : counter (assigned counter)', written[1]);
  check('log: expression line', written[2] === '  expression   : routine', written[2]);
  check('log: expression reason line', written[3] === '  expr reason  : Routine Counter: cosmetics, 4 aisles', written[3]);
  const classicLog = formatExpressionSelection(asRoute(shell('ritual', { grid: 'masonry' }), routineSignals), { shopId: 's', gateOpen: RITUAL_RECIPE_GENERATION_ENABLED, assigned: 'counter' });
  check('log: classic row prints expression none + why', classicLog === '[architecture-assignment] shop=s gate=closed stage=expression\n  architecture : classic (assigned counter)\n  expression   : none\n  expr reason  : classic has no expressions', classicLog);
  const skippedLog = formatExpressionSelection(noSignals, { shopId: 's', gateOpen: false, assigned: null });
  check('log: skipped assignment prints "assigned unavailable"', skippedLog.split('\n')[1] === '  architecture : counter (assigned unavailable)' && skippedLog.split('\n')[2] === '  expression   : none', skippedLog);
  check('log: formatter is deterministic', formatExpressionSelection(routine, { shopId: 'shop-1', gateOpen: true, assigned: 'counter' }) === written.join('\n'));
  const tenI = formatArchitectureAssignment(run({ niche: 'jewelry', products: rings, heroMedia: null }), { shopId: 'shop-1', gateOpen: false }).split('\n');
  check('log: the Phase 10I block is still 7 lines with its own header', tenI.length === 7 && tenI[0] === '[architecture-assignment] shop=shop-1 gate=closed mode=observational', tenI[0]);
}

console.log('\n[10] Phase 10L.5 — Routine Counter aisle grouping (10K.3 §1)');
{
  const cat = (categories: Array<string | null>) => inventory(categories.length, {}, (i) => ({ category: categories[i] }));
  const shape = (aisles: ReturnType<typeof groupCounterAisles<SiteProduct>>) => aisles.map((a) => `${a.label ?? '∅'}:${a.products.map((p) => p.id).join('+')}`).join(' | ');

  // Interleaved inventory (the order a newest-first home slice arrives in).
  const mixed = cat(['Creams', 'Serums', 'Oils', 'Lotions', 'Creams', 'Oils', 'Lotions', 'Oils', 'Creams', 'Creams', 'Serums', 'Serums']);
  const grouped = groupCounterAisles(mixed);
  check('one band per category, in FIRST-SEEN order', grouped.map((a) => a.label).join(',') === 'Creams,Serums,Oils,Lotions', grouped.map((a) => a.label));
  check('pieces keep their slice order inside a band', shape(grouped) === 'Creams:p1+p5+p9+p10 | Serums:p2+p11+p12 | Oils:p3+p6+p8 | Lotions:p4+p7', shape(grouped));
  // First-seen, not frequency: the smallest aisle leads when it arrives first.
  const smallFirst = groupCounterAisles(cat(['Lotions', 'Creams', 'Creams', 'Creams', 'Serums', 'Serums']));
  check('first-seen order holds even when a later aisle is larger', smallFirst.map((a) => `${a.label}:${a.products.length}`).join(',') === 'Lotions:1,Creams:3,Serums:2', smallFirst.map((a) => a.label));
  const ids = grouped.flatMap((a) => a.products.map((p) => p.id));
  check('nothing dropped, nothing duplicated', ids.length === mixed.length && new Set(ids).size === mixed.length && mixed.every((p) => ids.includes(p.id)));
  check('bands carry the SAME product objects (no clones)', grouped.every((a) => a.products.every((p) => mixed.includes(p))));

  // Normalised grouping key, raw label.
  const variants = groupCounterAisles(cat(['  Serums ', 'serum', 'SERUMS', 'Body  Oils', 'body oil', 'Accessories', 'Accessory']));
  check('normalised categories merge into one band', variants.length === 3 && variants.map((a) => a.products.length).join(',') === '3,2,2', shape(variants));
  check('label is the first-seen RAW category, trimmed (never the normalised key)', variants.map((a) => a.label).join('|') === 'Serums|Body  Oils|Accessories' && variants.map((a) => a.key).join('|') === 'serum|body oil|accessory', variants.map((a) => `${a.label}/${a.key}`));

  // Uncategorised remainder.
  const withBlank = groupCounterAisles(cat([null, 'Creams', '', 'Serums', '   ', 'Creams']));
  check('uncategorised pieces form ONE trailing band with a null key + label', withBlank.length === 3 && withBlank[2].key === null && withBlank[2].label === null && shape(withBlank) === 'Creams:p2+p6 | Serums:p4 | ∅:p1+p3+p5', shape(withBlank));
  const allBlank = groupCounterAisles(cat([null, '', null]));
  check('all-uncategorised inventory → the remainder band only', allBlank.length === 1 && allBlank[0].label === null && allBlank[0].products.length === 3);
  check('no remainder band when every piece is categorised', grouped.every((a) => a.key !== null && a.label !== null));
  check('empty inventory → no bands', groupCounterAisles([]).length === 0);

  // Purity.
  const before = JSON.stringify(mixed);
  const again = groupCounterAisles(mixed);
  check('deterministic, input not mutated', JSON.stringify(again) === JSON.stringify(grouped) && JSON.stringify(mixed) === before && again !== grouped);

  // Agreement with the resolver: whenever it draws 'routine', the wall has at
  // least three labelled bands — and when it degrades, the reason's count is
  // the band count.
  const counterCfg = (expression: 'routine' | 'item') => ({ template_key: 'ritual' as const, storefront_family: 'lifestyle-story' as const, layout_strategy: { grid: 'counter' as const, expression } });
  const labelled = (products: SiteProduct[]) => groupCounterAisles(products).filter((a) => a.label !== null).length;
  let agrees = true;
  let routineSeen = 0;
  let degradedSeen = 0;
  const pools = [['Creams', 'Serums', 'Oils', 'Lotions'], ['Serum', 'Serums', ' serums ', 'Cream'], ['Body', 'Face'], ['A', 'B', 'C'], ['Only'], ['Creams', null, 'Serums', '', 'Oils']];
  for (const pool of pools) {
    for (const size of [6, 9, 12]) {
      const products = inventory(size, {}, (i) => ({ category: pool[i % pool.length] }));
      const comp = resolveRitualComposition({ config: counterCfg('routine'), products, heroMedia: banner });
      if (comp.recipe !== 'product-first') continue;
      const bands = labelled(products);
      if (comp.expression === 'routine') {
        routineSeen += 1;
        if (bands < 3) agrees = false;
      } else {
        degradedSeen += 1;
        if (comp.expressionFallback !== `routine needs 3 categories (has ${bands})`) agrees = false;
      }
    }
  }
  check(`resolver ↔ grouping agree (${routineSeen} routine renders all ≥ 3 bands, ${degradedSeen} degrades name the band count)`, agrees && routineSeen > 0 && degradedSeen > 0);
  const itemComp = resolveRitualComposition({ config: counterCfg('item'), products: mixed, heroMedia: banner });
  check('item stays item on an inventory that could band (no upgrade at render)', itemComp.recipe === 'product-first' && itemComp.expression === 'item');
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 14 WP1 — AUTHORITY FOUNDATION. Shared fixtures for sections [11]–[20].
// ─────────────────────────────────────────────────────────────────────────────

const MARK = ASSIGNMENT_REASON_MARKERS;
const CLOSED_KEYS = 'architecture,template,confidence,reason,eligibility,signals,overriddenBy';
const OPEN_KEYS = `${CLOSED_KEYS},family,familyReason,commercePreference,sellerTemplate`;

/** The engine with the gate supplied as OPEN — fails loudly if the object it
 *  returns is not the full decision. */
function open(input: ArchitectureAssignmentInput): StorefrontDecision {
  const a = assignArchitecture(input, { gateOpen: true });
  if (!isStorefrontDecision(a)) throw new Error('gate open did not return a StorefrontDecision');
  return a;
}
const closed = (input: ArchitectureAssignmentInput): ArchitectureAssignment => assignArchitecture(input, { gateOpen: false });

/** n products of which `pictured` carry a photo — one category unless given. */
const photographed = (n: number, pictured: number, category: string | string[] = 'Rings'): SiteProduct[] =>
  inventory(n, {}, (i) => ({ pictured: i < pictured, category: Array.isArray(category) ? category[i % category.length] : category }));

type Forced = ArchitectureAssignmentInput['forcedTemplate'];
const archetypeForced: Forced[] = ARCHETYPE_KEYS.map((key) => ({ template: ARCHETYPES[key].template_key, source: 'seller-archetype' as const }));
const forcedVariants: Forced[] = [
  null,
  ...archetypeForced,
  { template: 'editorial', source: 'seller-template' },
  { template: 'vitality', source: 'concept' },
  { template: 'ritual', source: 'concept' },
];

/** Every niche shape × catalog size × photography share × hero state. */
function sweepInputs(): ArchitectureAssignmentInput[] {
  const niches: Array<string | null> = [null, 'cosmetics', 'fashion', 'jewelry', 'home', 'Oud, Fragrance & Home', 'food', 'wellness', 'tech', 'general', 'Artisan crafts', 'Event services', 'Najat Cakes bakery'];
  const dominants: Array<string | null> = [null, 'perfume', 'electronics'];
  const out: ArchitectureAssignmentInput[] = [];
  for (const niche of niches) {
    for (const dominantCategory of dominants) {
      for (const size of [0, 1, 5, 6, 10, 12, 20]) {
        for (const share of [1, 0.9, 0.5]) {
          for (const heroMedia of [null, banner] as HeroMedia[]) {
            out.push({ niche, dominantCategory, products: photographed(size, Math.round(size * share), ['A', 'B', 'C']), heroMedia });
          }
        }
      }
    }
  }
  return out;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

console.log('\n[11] Phase 14 WP1 — gate CLOSED: the Phase 10H object, unchanged');
{
  let defaultIsClosed = true;
  let sevenKeys = true;
  let noDecision = true;
  let noNewMarkers = true;
  let cases = 0;
  for (const input of sweepInputs()) {
    for (const forcedTemplate of forcedVariants) {
      const withForced = { ...input, forcedTemplate };
      const byDefault = run(withForced);
      const explicit = closed(withForced);
      cases += 1;
      if (JSON.stringify(byDefault) !== JSON.stringify(explicit)) defaultIsClosed = false;
      if (Object.keys(explicit).join(',') !== CLOSED_KEYS || Object.keys(explicit.eligibility).join(',') !== 'counter,gallery') sevenKeys = false;
      if (isStorefrontDecision(explicit) || isStorefrontDecision(byDefault)) noDecision = false;
      if (explicit.reason.endsWith(MARK.subtraction) || explicit.reason === MARK.floor) noNewMarkers = false;
    }
  }
  check(`no gate argument ≡ gate closed while the constant is false (${cases} cases)`, RITUAL_RECIPE_GENERATION_ENABLED === false && defaultIsClosed);
  check('closed: exactly the seven Phase 10H keys, eligibility is counter + gallery only', sevenKeys);
  check('closed: no family, no commerce preference, no seller-template record is returned', noDecision);
  check('closed: no reason carries the subtraction or floor marker', noNewMarkers);

  // The three behaviours WP1 changes are gate-open ONLY — closed keeps each.
  const homeClosed = closed({ niche: 'home', products: photographed(5, 5, 'Attars'), heroMedia: banner });
  check('closed: "Oud, Fragrance & Home" keeps no lean (gallery only by tie-break)', homeClosed.architecture === 'gallery' && assignmentDecisionSource(homeClosed) === 'tie-break', homeClosed);
  const degradedClosed = closed({ niche: 'fashion', products: photographed(5, 5, 'Abayas'), heroMedia: banner, forcedTemplate: { template: 'editorial', source: 'seller-template' } });
  check('closed: a forced non-Ritual template still degrades the recipe to Classic', degradedClosed.architecture === 'classic' && degradedClosed.template === 'editorial' && degradedClosed.reason.endsWith(MARK.overrideDegraded) && assignmentDecisionSource(degradedClosed) === 'seller-override', degradedClosed);
  const wallClosed = closed({ niche: 'jewelry', products: photographed(20, 20, ['Rings', 'Chains', 'Watches']), heroMedia: null });
  check('closed: a desire merchant with no hero and a deep catalog still falls to Counter', wallClosed.architecture === 'counter' && wallClosed.reason.endsWith(MARK.tieBreakCounter), wallClosed);
}

console.log('\n[12] Phase 14 WP1 — gate OPEN: the full decision is returned');
{
  const tech: ArchitectureAssignmentInput = { niche: 'tech', products: photographed(20, 20, ['Phones', 'Laptops', 'Audio']), heroMedia: banner };
  const d = open(tech);
  const c = closed(tech);
  check('open: the seven keys keep their order, then the four decision fields', Object.keys(d).join(',') === OPEN_KEYS, Object.keys(d));
  check('open: eligibility carries counter, gallery and subtraction', Object.keys(d.eligibility).join(',') === 'counter,gallery,subtraction', Object.keys(d.eligibility));
  check('open: where no open-gate rule applies the seven fields equal the closed object',
    d.architecture === c.architecture && d.template === c.template && d.confidence === c.confidence && d.reason === c.reason && d.overriddenBy === c.overriddenBy &&
    JSON.stringify(d.signals) === JSON.stringify(c.signals) && JSON.stringify(d.eligibility.counter) === JSON.stringify(c.eligibility.counter) && JSON.stringify(d.eligibility.gallery) === JSON.stringify(c.eligibility.gallery), { d, c });
  check('open: decision fields are populated', d.family === 'product-first' && d.commercePreference === 'counter' && d.sellerTemplate === null && d.familyReason === STOREFRONT_FAMILY_REASON_MARKERS['product-first'], d);

  // A2 — a forced template never degrades the architecture with the gate open.
  const abayas: ArchitectureAssignmentInput = { niche: 'fashion', products: photographed(5, 5, 'Abayas'), heroMedia: banner, forcedTemplate: { template: 'editorial', source: 'seller-template' } };
  const stands = open(abayas);
  check('open: forced editorial does NOT degrade — Gallery stands on Ritual',
    stands.architecture === 'gallery' && stands.template === 'ritual' && stands.reason.endsWith(MARK.preferredGallery) && !stands.reason.endsWith(MARK.overrideDegraded) && assignmentDecisionSource(stands) === 'niche-preference', stands);
  check('open: the seller template is recorded as set aside, overriddenBy cleared',
    stands.overriddenBy === null && JSON.stringify(stands.sellerTemplate) === '{"template":"editorial","source":"seller-template","honoured":false}', stands.sellerTemplate);
  const ritualPick = open({ ...abayas, forcedTemplate: { template: 'ritual', source: 'seller-archetype' } });
  check('open: forced Ritual is honoured and recorded', ritualPick.architecture === 'gallery' && ritualPick.template === 'ritual' && ritualPick.overriddenBy === 'seller-archetype' && ritualPick.sellerTemplate?.honoured === true, ritualPick);
  const classicForced = open({ niche: 'cosmetics', products: photographed(8, 8, 'Serum'), heroMedia: banner, forcedTemplate: { template: 'vitality', source: 'seller-archetype' } });
  check('open: Classic keeps the seller template', classicForced.architecture === 'classic' && classicForced.template === 'vitality' && classicForced.overriddenBy === 'seller-archetype' && classicForced.sellerTemplate?.honoured === true, classicForced);
  const classicFree = { niche: 'cosmetics', products: photographed(8, 8, 'Serum'), heroMedia: banner };
  check('open: Classic with nothing forced keeps the category template', open(classicFree).template === closed(classicFree).template && open(classicFree).sellerTemplate === null);
}

console.log('\n[13] Phase 14 WP1 — Subtraction rule boundaries (gate open)');
{
  const jewel = (n: number, pictured: number, heroMedia: HeroMedia, category: string | string[] = 'Rings') =>
    open({ niche: 'jewelry', products: photographed(n, pictured, category), heroMedia });
  check('thresholds are the ratified ones', SUBTRACTION_ASSIGNMENT_RULES.minPicturedProducts === 6 && SUBTRACTION_ASSIGNMENT_RULES.minPicturedRatio === 0.9);

  // Photographed-piece floor.
  const five = jewel(5, 5, null);
  check('5 photographed pieces → not Subtraction, names the 6-piece rule', five.family !== 'subtraction' && !five.eligibility.subtraction.eligible && JSON.stringify(five.eligibility.subtraction.reasons) === '["needs 6 photographed pieces (has 5)"]', five);
  const six = jewel(6, 6, null);
  check('6 photographed pieces → Subtraction', six.family === 'subtraction' && six.eligibility.subtraction.eligible && six.eligibility.subtraction.reasons.length === 0, six);
  check('Subtraction pairs with Classic on Ritual at high confidence', six.architecture === 'classic' && six.template === 'ritual' && six.confidence === 'high', six);

  // Photography share.
  const p89 = jewel(100, 89, null);
  check('89% photographed → not Subtraction, names the 90% rule', p89.family !== 'subtraction' && JSON.stringify(p89.eligibility.subtraction.reasons) === '["needs 90% photographed products (has 89%)"]', p89);
  const p90 = jewel(100, 90, null);
  check('90% photographed → Subtraction', p90.family === 'subtraction' && p90.architecture === 'classic' && p90.template === 'ritual', p90);
  check('9 of 10 → Subtraction; 8 of 9 (88.9%) → not', jewel(10, 9, null).family === 'subtraction' && jewel(9, 8, null).family !== 'subtraction');
  const p895 = jewel(200, 179, null);
  check('89.5% is NOT rounded up to the bar (reported as 89%)', p895.family !== 'subtraction' && p895.eligibility.subtraction.reasons.join() === 'needs 90% photographed products (has 89%)', p895.eligibility.subtraction);
  check('6 photographed of 7 (85.7%) fails on share alone', JSON.stringify(jewel(7, 6, null).eligibility.subtraction.reasons) === '["needs 90% photographed products (has 85%)"]', jewel(7, 6, null).eligibility.subtraction);

  // Hero media.
  const withBanner = jewel(6, 6, banner);
  check('banner present → not Subtraction; Gallery is preferred and assigned', withBanner.family !== 'subtraction' && withBanner.architecture === 'gallery' && JSON.stringify(withBanner.eligibility.subtraction.reasons) === '["has hero media, so Gallery is preferred"]', withBanner);
  check('banner absent → Subtraction (same catalog)', jewel(6, 6, null).family === 'subtraction');

  // Desire commerce only.
  const tech = open({ niche: 'tech', products: photographed(6, 6), heroMedia: null });
  check('catalog-commerce merchant → never Subtraction', tech.family === 'product-first' && tech.eligibility.subtraction.reasons.includes('needs a desire-commerce niche (fashion, jewellery, fragrance, artisan)'), tech);
  const noLean = open({ niche: 'cosmetics', products: photographed(6, 6), heroMedia: null });
  check('unleaned niche (cosmetics) → never Subtraction', noLean.family === 'lifestyle-story' && !noLean.eligibility.subtraction.eligible, noLean);
  const bakery = open({ niche: 'food', products: photographed(6, 6), heroMedia: null });
  check('culinary merchant → never Subtraction', bakery.family === 'menu-occasion' && bakery.eligibility.subtraction.reasons.includes('menu-occasion merchants are not subtraction merchants'), bakery);
  const service = open({ niche: 'Event services', products: photographed(6, 6), heroMedia: null });
  check('service merchant → never Subtraction', service.family !== 'subtraction' && service.eligibility.subtraction.reasons.includes('service merchants have no catalog to wall'), service);
  check('undeclared desire keyword (perfume) qualifies like a declared niche', open({ niche: null, dominantCategory: 'perfume', products: photographed(6, 6), heroMedia: null }).family === 'subtraction');
  check('empty inventory → not Subtraction, no throw', open({ niche: 'jewelry', products: [], heroMedia: null }).family !== 'subtraction');

  // Family first: Subtraction pre-empts the architecture the chain would give.
  const deep = jewel(20, 20, null, ['Rings', 'Chains', 'Watches']);
  check('Subtraction pre-empts Counter on a deep desire catalog (Counter stays eligible, is not assigned)', deep.family === 'subtraction' && deep.architecture === 'classic' && deep.eligibility.counter.eligible && !deep.eligibility.gallery.eligible, deep);
  let exclusive = true;
  let consistent = true;
  for (const input of sweepInputs()) {
    const s = open(input);
    if (s.eligibility.subtraction.eligible && s.eligibility.gallery.eligible) exclusive = false;
    if ((s.family === 'subtraction') !== s.eligibility.subtraction.eligible) consistent = false;
    if (s.family === 'subtraction' && (s.architecture !== 'classic' || s.template !== 'ritual' || s.signals.heroMedia || s.commercePreference !== 'gallery')) consistent = false;
  }
  check('Subtraction and Gallery are never both open to one merchant', exclusive);
  check('family is subtraction exactly when the verdict is eligible — always Classic, Ritual, no hero, desire lean', consistent);
}

console.log('\n[14] Phase 14 WP1 — "Oud, Fragrance & Home" is desire commerce (gate open)');
{
  const attars = (n: number) => photographed(n, n, 'Attars');
  const shapes: Array<[string, Pick<ArchitectureAssignmentInput, 'niche' | 'dominantCategory'>]> = [
    ['declared id', { niche: 'home' }],
    ['declared label', { niche: 'Oud, Fragrance & Home' }],
    ['undeclared "perfume"', { niche: null, dominantCategory: 'perfume' }],
    ['undeclared "attars"', { niche: null, dominantCategory: 'attars' }],
    ['undeclared "oud"', { niche: null, dominantCategory: 'oud' }],
    ['undeclared "fragrance"', { niche: null, dominantCategory: 'Fragrance' }],
  ];
  const withBanner = shapes.map(([, s]) => open({ ...s, products: attars(5), heroMedia: banner }));
  const noBanner = shapes.map(([, s]) => open({ ...s, products: attars(6), heroMedia: null }));
  check('declared and undeclared fragrance carry the SAME desire-commerce preference', withBanner.every((d) => d.commercePreference === 'gallery') && noBanner.every((d) => d.commercePreference === 'gallery'), withBanner.map((d) => d.commercePreference));
  check('with a banner: every shape is Gallery by niche preference, same reason, same family',
    withBanner.every((d) => d.architecture === 'gallery' && assignmentDecisionSource(d) === 'niche-preference' && d.reason === withBanner[0].reason && d.family === 'lifestyle-story' && d.template === 'ritual'), withBanner.map((d) => `${d.architecture}/${d.family}`));
  check('without a banner: every shape is Subtraction, same reason', noBanner.every((d) => d.family === 'subtraction' && d.reason === noBanner[0].reason), noBanner.map((d) => d.family));
  check('fragrance classification reason is a fixed marker', withBanner[0].reason === `5 photographed pieces and a shop banner. ${MARK.preferredGallery}`, withBanner[0].reason);
  const lockedSmall = open({ niche: 'home', products: attars(5), heroMedia: null });
  check('declared fragrance, no banner, under the wall floor → Classic with Gallery named as locked', lockedSmall.architecture === 'classic' && lockedSmall.family === 'lifestyle-story' && lockedSmall.reason === 'Gallery fits this niche but is not yet unlocked: needs hero media (site hero image or shop banner).', lockedSmall);
  check('the classification is per niche: declared home + decor category leans gallery too', open({ niche: 'home', dominantCategory: 'Decor', products: attars(5), heroMedia: banner }).commercePreference === 'gallery');

  // Gate-only: closed still shows the Phase 10H gap between the two shapes.
  const declaredClosed = closed({ niche: 'home', products: attars(5), heroMedia: banner });
  const undeclaredClosed = closed({ niche: null, dominantCategory: 'perfume', products: attars(5), heroMedia: banner });
  check('closed: declared home stays unleaned, undeclared perfume stays leaned (unchanged)', assignmentDecisionSource(declaredClosed) === 'tie-break' && assignmentDecisionSource(undeclaredClosed) === 'niche-preference');
  // Scope: the other niches keep their Phase 10F lean with the gate open.
  const lean = (niche: string) => open({ niche, products: photographed(8, 8), heroMedia: banner }).commercePreference;
  check('open: other niche leans are untouched (general stays counter — the undeclared-niche rule is WP2)',
    lean('cosmetics') === null && lean('fashion') === 'gallery' && lean('jewelry') === 'gallery' && lean('wellness') === 'counter' && lean('tech') === 'counter' && lean('general') === 'counter' && lean('food') === null);
}

console.log('\n[15] Phase 14 WP1 — rhythm ownership: every family is decided by the engine (gate open)');
{
  const FAM = STOREFRONT_FAMILY_REASON_MARKERS;
  const story = open({ niche: 'jewelry', products: photographed(5, 5), heroMedia: banner });
  check('lifestyle-story: desire commerce', story.family === 'lifestyle-story' && story.familyReason === FAM['lifestyle-story'], story);
  const storyDefault = open({ niche: 'cosmetics', products: photographed(8, 8, 'Serum'), heroMedia: banner });
  check('lifestyle-story: the default when there is no lean', storyDefault.family === 'lifestyle-story' && storyDefault.commercePreference === null, storyDefault);
  const catalog = open({ niche: 'tech', products: photographed(20, 20, ['Phones', 'Laptops', 'Audio']), heroMedia: banner });
  check('product-first: catalog-commerce lean', catalog.family === 'product-first' && catalog.familyReason === FAM['product-first'], catalog);
  const catalogLocked = open({ niche: 'tech', products: photographed(2, 2, ['A', 'B']), heroMedia: null });
  check('product-first: follows the lean even when Counter is not yet unlocked', catalogLocked.architecture === 'classic' && catalogLocked.family === 'product-first', catalogLocked);
  const menu = open({ niche: 'food', products: photographed(10, 10, ['Cakes', 'Cupcakes']), heroMedia: banner });
  check('menu-occasion: culinary niche', menu.family === 'menu-occasion' && menu.familyReason === FAM['menu-occasion'] && menu.architecture === 'classic', menu);
  check('menu-occasion: free-text bakery', open({ niche: 'Najat Cakes bakery', products: photographed(10, 10), heroMedia: banner }).family === 'menu-occasion');
  const wall = open({ niche: 'jewelry', products: photographed(6, 6), heroMedia: null });
  check('subtraction: the Subtraction rule', wall.family === 'subtraction' && wall.familyReason === FAM.subtraction, wall);

  // The rhythm follows the commerce PREFERENCE (ratified 13D), not the
  // architecture a tie-break lands on — pinned so a later change is visible.
  const tieCounter = open({ niche: 'cosmetics', products: inventory(12, {}, (i) => ({ pictured: i < 10, category: 'Soaps' })), heroMedia: null });
  check('tie-break Counter with no lean keeps lifestyle-story', tieCounter.architecture === 'counter' && tieCounter.commercePreference === null && tieCounter.family === 'lifestyle-story', tieCounter);
  const tieGallery = open({ niche: 'tech', products: photographed(5, 5, 'Phones'), heroMedia: banner });
  check('tie-break Gallery under a catalog lean keeps product-first', tieGallery.architecture === 'gallery' && tieGallery.commercePreference === 'counter' && tieGallery.family === 'product-first', tieGallery);

  let known = true;
  let reasoned = true;
  let leanRule = true;
  let menuRule = true;
  const seen = new Set<string>();
  for (const input of sweepInputs()) {
    const d = open(input);
    seen.add(d.family);
    if (!(STOREFRONT_FAMILIES as readonly string[]).includes(d.family)) known = false;
    if (d.familyReason !== FAM[d.family]) reasoned = false;
    if (d.family !== 'menu-occasion' && (d.commercePreference === 'counter') !== (d.family === 'product-first')) leanRule = false;
    if (d.family === 'menu-occasion' && (d.architecture !== 'classic' || d.eligibility.counter.eligible || d.eligibility.gallery.eligible)) menuRule = false;
  }
  check('every decision names one of the four families', known && STOREFRONT_FAMILIES.every((f) => seen.has(f)), [...seen]);
  check('every familyReason is that family\'s fixed marker', reasoned);
  check('product-first exactly when the lean is catalog commerce (outside menu-occasion)', leanRule);
  const culinaryWins = open({ niche: 'tech', dominantCategory: 'bakery', products: photographed(10, 10), heroMedia: banner });
  check('culinary is decided first: a catalog lean with a culinary category is menu-occasion', culinaryWins.family === 'menu-occasion' && culinaryWins.architecture === 'classic', culinaryWins);
  check('menu-occasion is always Classic with both recipes rejected', menuRule);
}

console.log('\n[16] Phase 14 WP1 — determinism + purity (both gate states)');
{
  let deterministic = true;
  let pure = true;
  let cases = 0;
  for (const input of sweepInputs()) {
    for (const forcedTemplate of [null, archetypeForced[1], archetypeForced[2]] as Forced[]) {
      for (const gateOpen of [false, true]) {
        const frozen = deepFreeze({ ...input, forcedTemplate, products: input.products.map((p) => ({ ...p })) });
        const before = JSON.stringify(frozen);
        let first = '';
        let second = '';
        try {
          first = JSON.stringify(assignArchitecture(frozen, { gateOpen }));
          second = JSON.stringify(assignArchitecture(JSON.parse(before) as ArchitectureAssignmentInput, { gateOpen }));
        } catch {
          pure = false;
        }
        cases += 1;
        if (first !== second || first === '') deterministic = false;
        if (JSON.stringify(frozen) !== before) pure = false;
      }
    }
  }
  check(`same inputs → identical object, closed and open (${cases} cases)`, deterministic);
  check('a deep-frozen input is never written to', pure);
  const a = open({ niche: 'jewelry', products: photographed(6, 6), heroMedia: null });
  const b = open({ niche: 'jewelry', products: photographed(6, 6), heroMedia: null });
  check('two calls return separate objects (no shared state)', a !== b && a.eligibility !== b.eligibility && a.eligibility.subtraction !== b.eligibility.subtraction && JSON.stringify(a) === JSON.stringify(b));
}

console.log('\n[17] Phase 14 WP1 — theme independence (gate open)');
{
  let sameDecision = true;
  let ritualWhenRequired = true;
  let classicKeepsSeller = true;
  let recordHonest = true;
  let sameExpression = true;
  let closedDegrades = 0;
  let cases = 0;
  for (const input of sweepInputs()) {
    const free = open(input);
    const ritualRequired = free.family === 'subtraction' || free.architecture !== 'classic';
    const exhibits = selectGalleryExhibits(input.products).length;
    const expressionOf = (d: StorefrontDecision) => JSON.stringify(selectExpression({
      architecture: d.family === 'subtraction' ? 'subtraction' : d.architecture,
      niche: d.signals.niche,
      dominantCategory: input.dominantCategory,
      categoryCount: d.signals.categoryCount,
      exhibits,
    }));
    for (const forcedTemplate of forcedVariants) {
      if (!forcedTemplate) continue;
      const forced = open({ ...input, forcedTemplate });
      cases += 1;
      if (
        forced.family !== free.family || forced.architecture !== free.architecture || forced.commercePreference !== free.commercePreference ||
        forced.confidence !== free.confidence || forced.reason !== free.reason || forced.familyReason !== free.familyReason ||
        JSON.stringify(forced.eligibility) !== JSON.stringify(free.eligibility) || JSON.stringify(forced.signals) !== JSON.stringify(free.signals)
      ) sameDecision = false;
      if (ritualRequired && forced.template !== 'ritual') ritualWhenRequired = false;
      if (!ritualRequired && forced.template !== forcedTemplate.template) classicKeepsSeller = false;
      const honoured = !ritualRequired || forcedTemplate.template === 'ritual';
      if (forced.sellerTemplate?.template !== forcedTemplate.template || forced.sellerTemplate?.source !== forcedTemplate.source || forced.sellerTemplate?.honoured !== honoured || forced.overriddenBy !== (honoured ? forcedTemplate.source : null)) recordHonest = false;
      if (expressionOf(forced) !== expressionOf(free)) sameExpression = false;
      if (closed({ ...input, forcedTemplate }).architecture !== closed(input).architecture) closedDegrades += 1;
    }
  }
  check(`family, architecture, lean, confidence, reasons, verdicts and signals are identical under every archetype and forced template (${cases} cases)`, sameDecision);
  check('Counter, Gallery and Subtraction return Ritual whatever was forced', ritualWhenRequired);
  check('Classic returns the seller template', classicKeepsSeller);
  check('sellerTemplate + overriddenBy record exactly what happened to the forced template', recordHonest);
  check('the expression selected from the decision is identical under every archetype', sameExpression);
  check(`contrast: with the gate closed a forced template DOES change the architecture (${closedDegrades} cases) — the gate-closed law, intact`, closedDegrades > 0);
  const perArchetype = ARCHETYPE_KEYS.map((key) => open({ niche: 'jewelry', products: photographed(6, 6), heroMedia: null, forcedTemplate: { template: ARCHETYPES[key].template_key, source: 'seller-archetype' } }));
  check('one Subtraction merchant under all four archetypes: subtraction / classic / ritual each time', perArchetype.every((d) => d.family === 'subtraction' && d.architecture === 'classic' && d.template === 'ritual'), perArchetype.map((d) => `${d.family}/${d.template}`));
}

console.log('\n[18] Phase 14 WP1 — fixed-marker reasons only (both gate states)');
{
  const counterFacts = String.raw`\d+ priced products across \d+ (category|categories), \d+% photographed\. `;
  const galleryFacts = String.raw`\d+ photographed (piece|pieces) and (an Ad Studio hero|a shop banner|no hero image)\. `;
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const shapes: RegExp[] = [
    new RegExp(`^${esc(MARK.menuOccasion)}$`),
    new RegExp(`^${esc(MARK.service)}$`),
    new RegExp(`^${counterFacts}(${esc(MARK.preferredCounter)}|${esc(MARK.tieBreakCounter)}|${esc(MARK.tieBreakClassic)})$`),
    new RegExp(`^${galleryFacts}(${esc(MARK.preferredGallery)}|${esc(MARK.tieBreakGallery)})$`),
    new RegExp(String.raw`^(Counter|Gallery) fits \(.+\) but the (seller chose|approved concept uses|chosen archetype uses) the "(ritual|editorial|vitality)" template, ${esc(MARK.overrideDegraded)}$`),
    new RegExp(String.raw`^\d+ photographed (piece|pieces) \(\d+% of the catalog\) and no hero image\. ${esc(MARK.subtraction)}$`),
  ];
  const lockedOk = (a: ArchitectureAssignment): boolean => {
    for (const [label, verdict] of [['Counter', a.eligibility.counter], ['Gallery', a.eligibility.gallery]] as const) {
      if (a.reason === `${label} ${MARK.preferredLocked} ${verdict.reasons.join('; ')}.`) return true;
    }
    return false;
  };
  const fixed = (a: ArchitectureAssignment): boolean => shapes.some((re) => re.test(a.reason)) || lockedOk(a);
  let allFixed = true;
  let noOpenDegrade = true;
  let noFreeText = true;
  let familyFixed = true;
  let offender: unknown;
  const familyMarkers = Object.values(STOREFRONT_FAMILY_REASON_MARKERS);
  for (const input of sweepInputs()) {
    for (const forcedTemplate of [null, archetypeForced[1], archetypeForced[2]] as Forced[]) {
      const c = closed({ ...input, forcedTemplate });
      const d = open({ ...input, forcedTemplate });
      for (const a of [c, d]) {
        if (!fixed(a)) { allFixed = false; offender = offender ?? a.reason; }
      }
      if (!familyMarkers.includes(d.familyReason)) familyFixed = false;
      if (d.reason.endsWith(MARK.overrideDegraded)) noOpenDegrade = false;
    }
  }
  // Merchant free text never reaches a reason: niche text, category text and
  // product names are all distinctive here.
  for (const gateOpen of [false, true]) {
    for (const heroMedia of [null, banner] as HeroMedia[]) {
      const a = assignArchitecture({ niche: 'ZZNICHE perfume atelier', dominantCategory: 'QQCATEGORY oud', products: inventory(8, { category: 'XXSHELF' }).map((p) => ({ ...p, name: 'WWPRODUCT' })), heroMedia }, { gateOpen });
      const text = JSON.stringify([a.reason, isStorefrontDecision(a) ? a.familyReason : '', a.eligibility]);
      if (/ZZNICHE|QQCATEGORY|XXSHELF|WWPRODUCT/.test(text)) noFreeText = false;
    }
  }
  check('every reason, closed and open, is counted facts + one fixed marker', allFixed, offender);
  check('no open-gate reason carries the closed-gate degradation marker', noOpenDegrade);
  check('every familyReason is one of the four fixed family sentences', familyFixed);
  check('no merchant free text (niche, category, product name) reaches a reason or a verdict', noFreeText);

  const sub = open({ niche: 'jewelry', products: photographed(6, 6), heroMedia: null });
  check('Subtraction reason: fixed marker, exact wording', sub.reason === '6 photographed pieces (100% of the catalog) and no hero image. Pieces in this niche sell on the image, so the wall is the page.' && sub.reason.endsWith(MARK.subtraction), sub.reason);
  check('Subtraction reads back as family-rule', assignmentDecisionSource(sub) === 'family-rule');
  const gal = open({ niche: 'jewelry', products: photographed(5, 5), heroMedia: banner });
  check('Gallery preference reason: fixed marker, exact wording', gal.reason === '5 photographed pieces and a shop banner. Pieces in this niche sell on the image, so each gets a full plate.' && assignmentDecisionSource(gal) === 'niche-preference', gal.reason);
  const frag = open({ niche: 'home', products: photographed(5, 5, 'Attars'), heroMedia: banner });
  check('Fragrance classification reason: the same fixed Gallery marker', frag.reason === gal.reason && assignmentDecisionSource(frag) === 'niche-preference', frag.reason);
  check('family sentences, exact wording',
    STOREFRONT_FAMILY_REASON_MARKERS['lifestyle-story'] === 'The story opens, then the collection.' &&
    STOREFRONT_FAMILY_REASON_MARKERS['product-first'] === 'Buyers in this niche compare and scan, so the collection opens.' &&
    STOREFRONT_FAMILY_REASON_MARKERS['menu-occasion'] === 'The occasion opens, then the menu.' &&
    STOREFRONT_FAMILY_REASON_MARKERS.subtraction === 'The opener and the wall are the page. Nothing else is drawn.');
  check('Phase 10H markers are byte-identical (new keys only appended)',
    Object.keys(MARK).join(',') === 'menuOccasion,service,preferredCounter,preferredGallery,tieBreakCounter,tieBreakGallery,preferredLocked,tieBreakClassic,overrideDegraded,subtraction,floor' &&
    MARK.preferredGallery === 'Pieces in this niche sell on the image, so each gets a full plate.' && MARK.overrideDegraded === 'which has no recipes.');
}

console.log('\n[19] Phase 14 WP1 — the Classic floor (assignment failure path)');
{
  const good = (): ArchitectureAssignmentInput => ({ niche: 'jewelry', dominantCategory: 'Rings', products: photographed(6, 6), heroMedia: null });
  const broken: Array<[string, unknown]> = [
    ['null input', null],
    ['undefined input', undefined],
    ['products missing', { niche: 'jewelry', heroMedia: null }],
    ['products null', { ...good(), products: null }],
    ['a null product row', { ...good(), products: [null, null, null, null, null, null] }],
    ['a product that throws when read', { ...good(), products: [new Proxy({}, { get() { throw new Error('unreadable row'); } })] }],
  ];
  const asInput = (v: unknown) => v as ArchitectureAssignmentInput;

  let engineThrows = true;
  for (const [, input] of broken) {
    for (const gateOpen of [false, true]) {
      let threw = false;
      try { assignArchitecture(asInput(input), { gateOpen }); } catch { threw = true; }
      if (!threw) engineThrows = false;
    }
  }
  check('the fixtures really are failures: the bare engine throws on each', engineThrows);

  let neverThrows = true;
  let classic = true;
  let noRecipe = true;
  let noSubtraction = true;
  let floorReason = true;
  let closedShape = true;
  let openShape = true;
  for (const [, input] of broken) {
    for (const gateOpen of [false, true]) {
      let a: ArchitectureAssignment | null = null;
      try { a = assignArchitectureOrFloor(asInput(input), { gateOpen }); } catch { neverThrows = false; }
      if (!a) continue;
      if (a.architecture !== 'classic' || a.confidence !== 'low') classic = false;
      if (a.eligibility.counter.eligible || a.eligibility.gallery.eligible) noRecipe = false;
      if (a.reason !== MARK.floor || assignmentDecisionSource(a) !== 'fallback') floorReason = false;
      if (a.reason.endsWith(MARK.subtraction)) noSubtraction = false;
      if (gateOpen) {
        if (!isStorefrontDecision(a)) { openShape = false; continue; }
        if (Object.keys(a).join(',') !== OPEN_KEYS) openShape = false;
        if (a.family !== 'lifestyle-story' || a.familyReason !== STOREFRONT_FAMILY_REASON_MARKERS['lifestyle-story'] || a.commercePreference !== null) noRecipe = false;
        if (a.family === 'subtraction' || a.eligibility.subtraction.eligible) noSubtraction = false;
      } else {
        if (isStorefrontDecision(a) || Object.keys(a).join(',') !== CLOSED_KEYS || Object.keys(a.eligibility).join(',') !== 'counter,gallery') closedShape = false;
      }
    }
  }
  check('assignArchitectureOrFloor never throws', neverThrows);
  check('failure → Classic at low confidence', classic);
  check('failure → no recipe verdict is eligible and the family is the default', noRecipe);
  check('failure → no Subtraction (family, verdict or reason)', noSubtraction);
  check('failure → the fixed floor reason, read back as fallback', floorReason);
  check('failure, gate closed → the seven-key object only', closedShape);
  check('failure, gate open → a full decision in the same key order', openShape);

  // A merchant who WOULD be Subtraction gets the floor, not Subtraction, when the engine cannot read the catalog.
  const wouldBe = open(good());
  const failed = assignArchitectureOrFloor(asInput({ ...good(), products: null }), { gateOpen: true });
  check('a would-be Subtraction merchant falls to the floor on failure', wouldBe.family === 'subtraction' && isStorefrontDecision(failed) && failed.family === 'lifestyle-story' && failed.architecture === 'classic', failed);
  const forcedFloor = assignArchitectureOrFloor(asInput({ ...good(), products: null, forcedTemplate: { template: 'editorial', source: 'seller-archetype' } }), { gateOpen: true });
  check('floor: a forced template still stands (Classic never overrides it)', forcedFloor.template === 'editorial' && forcedFloor.overriddenBy === 'seller-archetype' && isStorefrontDecision(forcedFloor) && forcedFloor.sellerTemplate?.honoured === true, forcedFloor);
  const junkForced = assignArchitectureOrFloor(asInput({ ...good(), products: null, forcedTemplate: { template: 'not-a-template', source: 'nobody' } }), { gateOpen: true });
  check('floor: an unreadable forced template is ignored, category heuristic answers', junkForced.overriddenBy === null && ['ritual', 'editorial', 'vitality'].includes(junkForced.template) && isStorefrontDecision(junkForced) && junkForced.sellerTemplate === null, junkForced);

  // When the engine answers, the wrapper is transparent — in both states.
  let transparent = true;
  for (const input of sweepInputs()) {
    for (const gateOpen of [false, true]) {
      if (JSON.stringify(assignArchitectureOrFloor(input, { gateOpen })) !== JSON.stringify(assignArchitecture(input, { gateOpen }))) transparent = false;
    }
    if (JSON.stringify(assignArchitectureOrFloor(input)) !== JSON.stringify(run(input))) transparent = false;
  }
  check('when the engine answers, the floor wrapper returns the identical object', transparent);
}

console.log('\n[20] Phase 14 WP1 — gate matrix: only the generation route consumes the decision (WP4)');
{
  const root = process.cwd();
  const read = (rel: string): string | null => {
    try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch { return null; }
  };
  const walk = (rel: string, out: string[] = []): string[] => {
    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true }); } catch { return out; }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const child = `${rel}/${e.name}`;
      if (e.isDirectory()) walk(child, out);
      else if (/\.(ts|tsx|mts|js|jsx|mjs)$/.test(e.name)) out.push(child);
    }
    return out;
  };

  // Everything WP1 added to the engine's public or returned surface.
  const NEW_SURFACE = /assignArchitectureOrFloor|isStorefrontDecision|StorefrontDecision|ArchitectureAssignmentOptions|SUBTRACTION_ASSIGNMENT_RULES|STOREFRONT_FAMILY_REASON_MARKERS|DESIRE_COMMERCE_NICHES|classicFloorAssignment|familyReason|commercePreference|sellerTemplate/;
  const ENGINE_FILE = 'lib/siteTemplates.ts';
  const ROUTE_FILE = 'app/api/ai/generate-website/route.ts';

  const sources = [...walk('app'), ...walk('components'), ...walk('lib')].filter((f) => f !== ENGINE_FILE);
  const consumers = sources.filter((f) => NEW_SURFACE.test(read(f) ?? ''));
  check(`repo root resolved (${sources.length} source files under app/, components/, lib/)`, sources.length > 50 && sources.includes(ROUTE_FILE), sources.length);
  // Phase 14 WP4: the generation route is now the decision's ONE consumer
  // (sections [33]–[38] prove how, and that it is dormant with the gate
  // closed). Every other file is held to the WP1 rule: no reference at all.
  check('only the generation route (WP4) references a WP1 decision field or export — no other route, API handler, component, page or library file', consumers.join() === ROUTE_FILE, consumers);

  // The route still calls the engine with ONE argument — no gate, so the constant decides.
  const route = read(ROUTE_FILE) ?? '';
  // WP4's steps sit above POST and take the gate as an input; inside POST the
  // gate is still only ever the constant.
  const post = route.slice(route.indexOf('export async function POST'));
  const calls = route.split('assignArchitecture(').length - 1;
  let args = '';
  const at = route.indexOf('assignArchitecture(');
  if (at !== -1) {
    let depth = 0;
    for (let i = at + 'assignArchitecture'.length; i < route.length; i += 1) {
      if (route[i] === '(') depth += 1;
      if (route[i] === ')') { depth -= 1; if (depth === 0) { args = route.slice(at + 'assignArchitecture('.length, i); break; } }
    }
  }
  let depth = 0;
  let topLevelCommas = 0;
  for (const ch of args) {
    if (ch === '(' || ch === '{' || ch === '[') depth += 1;
    else if (ch === ')' || ch === '}' || ch === ']') depth -= 1;
    else if (ch === ',' && depth === 0) topLevelCommas += 1;
  }
  check('route: exactly one assignArchitecture call', calls === 1, calls);
  check('route: that call passes the input object only — no gate option', args.trim().startsWith('{') && args.trim().endsWith('}') && topLevelCommas === 0 && !args.includes('gateOpen'), args.slice(0, 80));
  check('route: inside POST, gateOpen appears only where the two log formatters are told the constant', route.includes('export async function POST') && post.split('gateOpen').length - 1 === 2 && post.split('gateOpen: RITUAL_RECIPE_GENERATION_ENABLED').length - 1 === 2);

  // Inside the engine file: the new surface lives in the assignment-engine
  // section only — no carrier, resolver, schema or expression code reads it.
  const engine = read(ENGINE_FILE) ?? '';
  const start = engine.indexOf('// ARCHITECTURE ASSIGNMENT ENGINE (Phase 10H');
  const end = engine.indexOf('// EXPRESSION SELECTION (Phase 10L.3');
  const outside = engine.slice(0, start) + engine.slice(end);
  const inside = engine.slice(start, end);
  check('engine file: section bounds found', start > 0 && end > start);
  check('engine file: no WP1 field or export is referenced outside the assignment-engine section (carriers, resolver, expression write untouched)', start > 0 && end > start && !NEW_SURFACE.test(outside), outside.match(NEW_SURFACE)?.[0]);
  check('engine file: the assignment-engine section calls no carrier, resolver or persistence function',
    !/\b(generationToConfig|applyArchetype|applyGenerationLayout|applyExpressionSelection|guardRecipeGridPick|resolveRitualRecipe|resolveRitualComposition|cleanStoreContent|buildPreviousDesign)\s*\(/.test(inside));

  // The decision is a plain data object: no config, no layout, no functions.
  const d = open({ niche: 'jewelry', products: photographed(6, 6), heroMedia: null });
  const flat = JSON.stringify(d);
  check('the decision carries no config, layout or block keys', !/"(config|layout|layout_strategy|blocks|storefront_family|template_key|grid|expression)"/.test(flat), flat.slice(0, 120));
  check('the decision survives JSON round-trip unchanged (data only)', JSON.stringify(JSON.parse(flat)) === flat);

  // Gate state itself, and the carriers / resolver, exactly as before.
  check('the generation gate constant is still false', RITUAL_RECIPE_GENERATION_ENABLED === false);
  check('guard still strips both recipe grids', guardRecipeGridPick('counter', 'ritual') === undefined && guardRecipeGridPick('gallery', 'ritual') === undefined);
  const stored = { template_key: 'ritual' as const, storefront_family: 'lifestyle-story' as const, layout_strategy: { hero: 'split' as const, grid: 'masonry' as const } };
  const comp = resolveRitualComposition({ config: stored, products: photographed(12, 12), heroMedia: null });
  check('resolver: a stored row a WP1 decision would call Subtraction still resolves classic (nothing was written)', resolveRitualRecipe(stored) === 'classic' && comp.recipe === 'classic' && comp.grid === 'masonry' && comp.hero === 'split');
  const shell = { ...stored, niche_reasoning: 'x' } as unknown as WebsiteConfig;
  const write = applyExpressionSelection(shell, { gridSurvivedGuard: true, signals: { niche: 'jewelry', dominantCategory: null, categoryCount: 1, exhibits: 6 } });
  check('expression write: still returns the SAME config object for a classic row', write.config === shell && write.expression === undefined);
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 14 WP2 — INPUT + VALIDATOR PARITY. Shared fixtures for [21]–[26].
// ─────────────────────────────────────────────────────────────────────────────

/** A merchant as the database holds it: products newest first (the order
 *  both the generation route and the home read use), with stock. */
type Merchant = { products: SiteProduct[]; dominantCategory: string | null; bannerUrl: string | null };
/** What a generation request carries that the assignment block reads. */
type RequestShape = { bodyNiche?: unknown; forcedTemplate?: Forced };

function merchant(spec: {
  size: number;
  pictured?: (i: number) => boolean;
  priced?: (i: number) => boolean;
  category?: (i: number) => string | null;
  stock?: (i: number) => number | null | undefined;
  dominantCategory?: string | null;
  banner?: boolean;
}): Merchant {
  const rows = inventory(spec.size, {}, (i) => ({
    pictured: spec.pictured ? spec.pictured(i) : true,
    priced: spec.priced ? spec.priced(i) : true,
    category: spec.category ? spec.category(i) : 'Rings',
  }));
  const products = rows.map((p, i) => {
    const stock = spec.stock ? spec.stock(i) : undefined;
    return stock === undefined ? p : { ...p, stock_quantity: stock };
  });
  return { products, dominantCategory: spec.dominantCategory ?? null, bannerUrl: spec.banner ? 'https://banner.jpg' : null };
}

/** The route's own niche parse ("Pre-generation selections"): absent → null;
 *  a string is cleaned and an empty result is null. */
function routeNicheKey(bodyNiche: unknown): string | null {
  if (typeof bodyNiche !== 'string') return null;
  const cleaned = bodyNiche.replace(/[\r\n\t<>]/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned || null;
}
const shopOf = (bannerUrl: string | null) => ({ id: 'shop-1', shop_name: 'Shop', shop_slug: 'shop', logo_url: null, banner_url: bannerUrl, bio: null });
/** The route's assignmentProducts mapping — the same eight fields, NO stock. */
const stockless = (rows: SiteProduct[]): SiteProduct[] =>
  rows.map((p) => ({ id: p.id, name: p.name, price: p.price, description: p.description, image_url: p.image_url, ad_video_url: p.ad_video_url, ad_hero_image_url: p.ad_hero_image_url, category: p.category }));

/** The route's assignment block after WP2, step for step: parse the niche,
 *  align the inputs, call the engine with the same object literal, build the
 *  expression signals. Section [26] pins the route source to this shape. */
function viaRoute(m: Merchant, request: RequestShape, gateOpen: boolean) {
  const nicheKey = routeNicheKey(request.bodyNiche);
  const assignmentProducts = stockless(m.products);
  const aligned = alignAssignmentInputs(
    { niche: nicheKey, products: assignmentProducts.map((p, i) => ({ ...p, stock_quantity: m.products[i]?.stock_quantity ?? null })) },
    { gateOpen },
  );
  const heroMedia = resolveHeroMedia(shopOf(m.bannerUrl), null);
  const input: ArchitectureAssignmentInput = {
    niche: aligned.niche,
    dominantCategory: m.dominantCategory,
    products: assignmentProducts,
    renderProducts: aligned.renderProducts,
    heroMedia,
    forcedTemplate: request.forcedTemplate ?? null,
  };
  const assignment = assignArchitecture(input, { gateOpen });
  let signals: ExpressionSignals = {
    niche: assignment.signals.niche,
    dominantCategory: m.dominantCategory,
    categoryCount: assignment.signals.categoryCount,
    exhibits: selectGalleryExhibits(assignmentProducts).length,
  };
  if (aligned.renderProducts) {
    signals = { ...signals, ...expressionFloorSignals({ signals: assignment.signals, products: assignmentProducts, renderProducts: aligned.renderProducts }) };
  }
  return { nicheKey, aligned, input, assignment, signals, heroMedia };
}

/** The route's assignment block BEFORE WP2 — the Phase 10H / 10L.4 literals. */
function legacyRoute(m: Merchant, request: RequestShape, gateOpen: boolean) {
  const nicheKey = routeNicheKey(request.bodyNiche);
  const assignmentProducts = stockless(m.products);
  const heroMedia = resolveHeroMedia(shopOf(m.bannerUrl), null);
  const assignment = assignArchitecture({ niche: nicheKey, dominantCategory: m.dominantCategory, products: assignmentProducts, heroMedia, forcedTemplate: request.forcedTemplate ?? null }, { gateOpen });
  const signals: ExpressionSignals = {
    niche: assignment.signals.niche,
    dominantCategory: m.dominantCategory,
    categoryCount: assignment.signals.categoryCount,
    exhibits: selectGalleryExhibits(assignmentProducts).length,
  };
  return { assignment, signals, heroMedia };
}

/** What the resolver holds on the first render: the home read — the 12
 *  newest rows, WITH stock (readHomeProducts, `.limit(12)`). Deliberately a
 *  literal here, not ASSIGNMENT_RENDER_WINDOW: [24] proves the two agree. */
const HOME_READ = 12;
const resolverSees = (m: Merchant): SiteProduct[] => m.products.slice(0, HOME_READ);

/** The storefront a decision asks for, drawn by the real resolver on the
 *  first render. `degraded` is true when the resolver did not draw exactly
 *  the requested recipe and expression, or gave any fallback reason. */
function firstRender(m: Merchant, d: StorefrontDecision, signals: ExpressionSignals, heroMedia: HeroMedia) {
  const subtraction = d.family === 'subtraction';
  const expression = selectExpression({ ...signals, architecture: subtraction ? 'subtraction' : d.architecture }).expression;
  const grid = subtraction ? undefined : d.architecture === 'counter' ? ('counter' as const) : d.architecture === 'gallery' ? ('gallery' as const) : undefined;
  const config: Parameters<typeof resolveRitualComposition>[0]['config'] = {
    template_key: d.template,
    storefront_family: d.family,
    layout_strategy: grid ? (expression ? { grid, expression } : { grid }) : {},
  };
  const expected = subtraction ? 'subtraction' : d.architecture === 'counter' ? 'product-first' : d.architecture === 'gallery' ? 'gallery-led' : 'classic';
  const comp = resolveRitualComposition({ config, products: resolverSees(m), heroMedia });
  const degraded =
    comp.requested !== expected || comp.recipe !== expected || comp.fallback !== null || comp.expressionFallback !== null ||
    (grid !== undefined && comp.expression !== expression);
  return { comp, expected, expression, degraded };
}
const decisionOf = (a: ArchitectureAssignment): StorefrontDecision => {
  if (!isStorefrontDecision(a)) throw new Error('gate open did not return a StorefrontDecision');
  return a;
};
/** Everything a decision decides except the template (which a seller's
 *  forced template may set on Classic) and the forced-template record. */
const decisionCore = (d: StorefrontDecision): string =>
  JSON.stringify({ family: d.family, familyReason: d.familyReason, architecture: d.architecture, confidence: d.confidence, reason: d.reason, commercePreference: d.commercePreference, eligibility: d.eligibility, signals: d.signals });

/** Catalog size × where the photographs, categories, prices and stock sit
 *  relative to the 12-row window × category lean × banner. */
function wp2Merchants(): Merchant[] {
  const pictures: Array<(i: number) => boolean> = [() => true, () => false, (i) => i < 12, (i) => i >= 12, (i) => i % 10 !== 0, (i) => i < 4];
  const categories: Array<(i: number) => string | null> = [() => 'Rings', (i) => (i < 12 ? ['Serums', 'Creams'][i % 2] : 'Oils'), (i) => ['Serums', 'Creams', 'Oils'][i % 3]];
  const stocks: Array<(i: number) => number | null | undefined> = [() => undefined, () => 5, (i) => (i < 2 ? 5 : 0), () => 0];
  const prices: Array<(i: number) => boolean> = [() => true, (i) => i % 2 === 0];
  const out: Merchant[] = [];
  for (const size of [0, 1, 5, 6, 12, 13, 20, 30]) {
    for (const pictured of pictures) {
      for (const category of categories) {
        for (const stock of stocks) {
          for (const priced of prices) {
            for (const dominantCategory of [null, 'perfume', 'electronics']) {
              for (const withBanner of [false, true]) {
                out.push(merchant({ size, pictured, category, stock, priced, dominantCategory, banner: withBanner }));
              }
            }
          }
        }
      }
    }
  }
  return out;
}
const WP2_BODY_NICHES: unknown[] = [undefined, 'general', 'cosmetics', 'fashion', 'jewelry', 'home', 'wellness', 'tech', 'food'];

console.log('\n[21] Phase 14 WP2 — B1: an undeclared niche reaches Assignment as no niche (gate open)');
{
  // A perfume house: 8 photographed attars, a banner, inventory-derived dominant category.
  const house = merchant({ size: 8, category: () => 'Attars', dominantCategory: 'attars', banner: true });
  const undeclared: Array<[string, RequestShape]> = [
    ['Studio default general (untouched preselection)', { bodyNiche: 'general' }],
    ['Studio explicit general (same wire value)', { bodyNiche: 'general' }],
    ['Studio general by label', { bodyNiche: 'General / Multi-Category' }],
    ['Studio general, other casing / padding', { bodyNiche: '  GENERAL ' }],
    ['Onboarding — no niche field', {}],
    ['Onboarding — null', { bodyNiche: null }],
    ['Onboarding — blank', { bodyNiche: '' }],
    ['Onboarding — whitespace', { bodyNiche: '   ' }],
  ];
  const runs = undeclared.map(([, shape]) => viaRoute(house, shape, true));
  check('every undeclared shape reaches the engine as niche = null', runs.every((r) => r.aligned.niche === null && r.input.niche === null), runs.map((r) => r.input.niche));
  check('Studio general and Onboarding undeclared produce IDENTICAL Assignment inputs', runs.every((r) => JSON.stringify(r.input) === JSON.stringify(runs[0].input)));
  check('…and identical Assignment decisions', runs.every((r) => JSON.stringify(r.assignment) === JSON.stringify(runs[0].assignment)));
  check('…and identical expression signals', runs.every((r) => JSON.stringify(r.signals) === JSON.stringify(runs[0].signals)));
  const d = decisionOf(runs[0].assignment);
  check('undeclared → the inventory decides: this perfume house leans gallery, no niche recorded', d.signals.niche === null && d.commercePreference === 'gallery' && d.architecture === 'gallery', d);
  const handedGeneral = open({ niche: 'general', dominantCategory: 'attars', products: stockless(house.products), heroMedia: banner });
  check('contrast: handed "general" directly the engine still leans counter — B1 is an INPUT rule, the niche table is untouched', handedGeneral.commercePreference === 'counter' && handedGeneral.signals.niche === 'general', handedGeneral);

  // Declarations are never touched.
  const declared = ['cosmetics', 'fashion', 'jewelry', 'home', 'Oud, Fragrance & Home', 'food', 'wellness', 'tech', 'Artisan crafts', 'General store of electronics'];
  const kept = declared.map((n) => viaRoute(house, { bodyNiche: n }, true));
  check('a declared niche (Studio id, Studio label, or free text) is handed to the engine exactly as given', kept.every((r, i) => r.aligned.niche === declared[i] && r.input.niche === declared[i]), kept.map((r) => r.input.niche));
  check('only the catch-all niche is undeclared: free text that merely contains "general" stays declared', viaRoute(house, { bodyNiche: 'General store of electronics' }, true).aligned.niche === 'General store of electronics');

  // Gate closed: untouched, by reference.
  const closedGeneral = alignAssignmentInputs({ niche: 'general', products: stockless(house.products) }, { gateOpen: false });
  const byDefault = alignAssignmentInputs({ niche: 'general', products: stockless(house.products) });
  check('closed: the niche is handed back untouched and there is no render window', closedGeneral.niche === 'general' && closedGeneral.renderProducts === undefined);
  check('no gate argument ≡ closed while the constant is false', RITUAL_RECIPE_GENERATION_ENABLED === false && byDefault.niche === 'general' && byDefault.renderProducts === undefined);
  check('closed: null / undefined / blank are handed back as given, not normalised',
    alignAssignmentInputs({ niche: undefined, products: [] }, { gateOpen: false }).niche === undefined &&
    alignAssignmentInputs({ niche: null, products: [] }, { gateOpen: false }).niche === null &&
    alignAssignmentInputs({ niche: '  ', products: [] }, { gateOpen: false }).niche === '  ');
}

console.log('\n[22] Phase 14 WP2 — fragrance parity across paths (gate open)');
{
  // ONE merchant per case; the route derives the same dominant category on every path.
  const withBanner = merchant({ size: 5, category: () => 'Attars', dominantCategory: 'attars', banner: true });
  const noBanner = merchant({ size: 6, category: () => 'Attars', dominantCategory: 'attars', banner: false });
  const shapes: Array<[string, RequestShape]> = [
    ['Studio — declared "home" id', { bodyNiche: 'home' }],
    ['Studio — declared label', { bodyNiche: 'Oud, Fragrance & Home' }],
    ['Onboarding — nothing declared', {}],
    ['Studio — default general', { bodyNiche: 'general' }],
  ];
  const outcome = (m: Merchant, shape: RequestShape) => {
    const r = viaRoute(m, shape, true);
    const d = decisionOf(r.assignment);
    return JSON.stringify({ family: d.family, architecture: d.architecture, template: d.template, confidence: d.confidence, reason: d.reason, lean: d.commercePreference, eligibility: d.eligibility, expression: firstRender(m, d, r.signals, r.heroMedia).expression });
  };
  const a = shapes.map(([, s]) => outcome(withBanner, s));
  const b = shapes.map(([, s]) => outcome(noBanner, s));
  check('declared "Oud, Fragrance & Home" and undeclared fragrance keywords produce the SAME outcome (with a banner)', a.every((x) => x === a[0]), a);
  check('…and the same outcome without one', b.every((x) => x === b[0]), b);
  const g = decisionOf(viaRoute(withBanner, {}, true).assignment);
  check('with a banner that outcome is Gallery on Ritual, Atmosphere', g.architecture === 'gallery' && g.template === 'ritual' && g.family === 'lifestyle-story' && JSON.parse(a[0]).expression === 'atmosphere', a[0]);
  const s = decisionOf(viaRoute(noBanner, { bodyNiche: 'general' }, true).assignment);
  check('without a banner it is Subtraction on Ritual, no expression', s.family === 'subtraction' && s.architecture === 'classic' && s.template === 'ritual' && JSON.parse(b[0]).expression === undefined, b[0]);
  // Before WP2 the Studio default broke this parity: "general" leaned counter.
  const before = decisionOf(legacyRoute(withBanner, { bodyNiche: 'general' }, true).assignment);
  check('contrast: without B1 the Studio default leans counter for the same perfume house', before.commercePreference === 'counter' && g.commercePreference === 'gallery', before.commercePreference);
}

console.log('\n[23] Phase 14 WP2 — path parity: Studio and Onboarding, same merchant (gate open)');
{
  const merchants = wp2Merchants().filter((_, i) => i % 5 === 0);
  const onboarding: RequestShape = {};
  const studioShapes: RequestShape[] = [
    ...archetypeForced.map((forcedTemplate) => ({ bodyNiche: 'general', forcedTemplate })),
    { bodyNiche: 'general', forcedTemplate: { template: 'vitality', source: 'concept' } },
    { bodyNiche: 'general', forcedTemplate: { template: 'ritual', source: 'concept' } },
  ];
  let sameInputs = true;
  let sameCore = true;
  let sameExpression = true;
  let templateRule = true;
  let cases = 0;
  for (const m of merchants) {
    const o = viaRoute(m, onboarding, true);
    const od = decisionOf(o.assignment);
    // Same merchant, same inputs: the Studio's default niche with nothing forced IS the Onboarding request.
    const same = viaRoute(m, { bodyNiche: 'general' }, true);
    if (JSON.stringify(same.input) !== JSON.stringify(o.input) || JSON.stringify(same.assignment) !== JSON.stringify(o.assignment) || JSON.stringify(same.signals) !== JSON.stringify(o.signals)) sameInputs = false;
    const ritualRequired = od.family === 'subtraction' || od.architecture !== 'classic';
    for (const shape of studioShapes) {
      const s = viaRoute(m, shape, true);
      const sd = decisionOf(s.assignment);
      cases += 1;
      if (decisionCore(sd) !== decisionCore(od)) sameCore = false;
      if (JSON.stringify(s.signals) !== JSON.stringify(o.signals) || firstRender(m, sd, s.signals, s.heroMedia).expression !== firstRender(m, od, o.signals, o.heroMedia).expression) sameExpression = false;
      if (ritualRequired ? sd.template !== 'ritual' || od.template !== 'ritual' : sd.template !== shape.forcedTemplate?.template) templateRule = false;
    }
  }
  check(`same merchant, same inputs → identical Assignment input, decision and expression signals (${merchants.length} merchants)`, sameInputs);
  check(`Studio (every archetype, both concept templates) and Onboarding decide the same family, architecture, lean, reasons and verdicts (${cases} cases)`, sameCore);
  check('…and the same expression', sameExpression);
  check('the only path difference is the one the constitution allows: on Classic the Studio seller\'s template stands; Counter, Gallery and Subtraction are Ritual on both', templateRule);
}

console.log('\n[24] Phase 14 WP2 — C1: Assignment and Resolver judge the same effective data (gate open)');
{
  // Same product window.
  check('the render window is the home read: 12 newest rows', ASSIGNMENT_RENDER_WINDOW === HOME_READ);
  let windowOk = true;
  let stockOk = true;
  for (const size of [0, 1, 11, 12, 13, 30]) {
    const m = merchant({ size, stock: (i) => (i % 3 === 0 ? 0 : 4) });
    const r = viaRoute(m, {}, true);
    const w = r.aligned.renderProducts ?? [];
    const sees = resolverSees(m);
    if (w.length !== Math.min(size, 12) || w.map((p) => p.id).join() !== sees.map((p) => p.id).join()) windowOk = false;
    if (w.length !== sees.length || w.some((p, i) => p.stock_quantity !== sees[i]?.stock_quantity)) stockOk = false;
    if (r.input.products.some((p) => 'stock_quantity' in p) || r.input.products.length !== size) stockOk = false;
  }
  check('the window is exactly the rows the resolver reads, in the same order', windowOk);
  check('the window carries the resolver\'s stock; the full list the engine also reads stays stock-less (as before)', stockOk);
  const unknownStock = viaRoute(merchant({ size: 3 }), {}, true).aligned.renderProducts ?? [];
  check('unknown stock stays unknown (null) — counted as in stock, as the resolver counts it', unknownStock.every((p) => p.stock_quantity === null) && selectGalleryExhibits(unknownStock).length === 3);

  // Same verdicts: the engine's recipe verdicts ARE the resolver's own rule on the resolver's slice.
  let galleryVerdict = true;
  let counterVerdict = true;
  let floors = true;
  let compared = 0;
  for (const m of wp2Merchants().filter((_, i) => i % 3 === 0)) {
    for (const bodyNiche of WP2_BODY_NICHES) {
      const r = viaRoute(m, { bodyNiche }, true);
      const d = decisionOf(r.assignment);
      const family = d.family === 'menu-occasion' ? ('menu-occasion' as const) : null;
      const resolverGallery = ritualRecipeEligibility('gallery-led', { products: resolverSees(m), heroMedia: r.heroMedia, storefrontFamily: family });
      const resolverCounter = ritualRecipeEligibility('product-first', { products: resolverSees(m), heroMedia: r.heroMedia, storefrontFamily: family });
      compared += 1;
      if (JSON.stringify(d.eligibility.gallery.reasons.filter((x) => !x.startsWith('service merchants'))) !== JSON.stringify(resolverGallery.reasons)) galleryVerdict = false;
      // Counter: the resolver's reasons first, then only the engine-side additions (product floor, culinary, service).
      const engineOnly = d.eligibility.counter.reasons.slice(resolverCounter.reasons.length);
      if (JSON.stringify(d.eligibility.counter.reasons.slice(0, resolverCounter.reasons.length)) !== JSON.stringify(resolverCounter.reasons)) counterVerdict = false;
      if (engineOnly.some((x) => !/^needs 4 products|^menu-occasion merchants|^service merchants/.test(x))) counterVerdict = false;
      if ((d.eligibility.counter.eligible && !resolverCounter.eligible) || (d.eligibility.gallery.eligible && !resolverGallery.eligible)) counterVerdict = false;
      // Expression floors: counted on the resolver's slice, with the resolver's stock.
      if (r.signals.exhibits !== selectGalleryExhibits(resolverSees(m)).length) floors = false;
      const normalised = new Set(resolverSees(m).map((p) => normalizeCategoryForAssignment(p.category)).filter((k): k is string => k !== null)).size;
      if (r.signals.categoryCount !== normalised) floors = false;
    }
  }
  check(`Gallery verdict = the resolver's own rule on the resolver's slice, reason for reason (${compared} cases)`, galleryVerdict);
  check('Counter verdict = the resolver\'s reasons first, plus only the engine\'s stricter additions — never eligible where the resolver is not', counterVerdict);
  check('expression floors (categories, exhibits) are the resolver\'s counts on the resolver\'s slice', floors);

  // Three contrasts: each is a first-render degradation WITHOUT WP2 and none WITH it.
  const contrast = (m: Merchant, shape: RequestShape) => {
    const before = legacyRoute(m, shape, true);
    const after = viaRoute(m, shape, true);
    return {
      before: firstRender(m, decisionOf(before.assignment), before.signals, before.heroMedia),
      after: firstRender(m, decisionOf(after.assignment), after.signals, after.heroMedia),
      beforeDecision: decisionOf(before.assignment),
      afterDecision: decisionOf(after.assignment),
    };
  };
  // (1) Window: 30 products, 73% photographed overall but only 4 of the 12 newest.
  const stale = contrast(merchant({ size: 30, pictured: (i) => i < 4 || i >= 12, category: (i) => ['Phones', 'Laptops', 'Audio'][i % 3] }), { bodyNiche: 'tech' });
  check('window — before: Counter assigned on the full catalog, resolver degrades it to Classic on the home slice',
    stale.beforeDecision.architecture === 'counter' && stale.before.degraded && stale.before.comp.recipe === 'classic' && stale.before.comp.fallback === 'needs 70% pictured products (has 33%)', stale.before.comp);
  check('window — after: Counter is not assigned (named as locked on the same rule), nothing degrades',
    stale.afterDecision.architecture === 'classic' && stale.afterDecision.reason === 'Counter fits this niche but is not yet unlocked: needs 70% pictured products (has 33%).' && !stale.after.degraded, stale.afterDecision);
  // (2) Stock: six photographed rings, a banner, only two in stock.
  const soldOut = contrast(merchant({ size: 6, stock: (i) => (i < 2 ? 5 : 0), banner: true }), { bodyNiche: 'jewelry' });
  check('stock — before: Scale selected from six pieces, resolver (which sees stock) degrades it to Atmosphere',
    soldOut.before.expression === 'scale' && soldOut.before.degraded && soldOut.before.comp.expressionFallback === 'scale needs 3 exhibits (has 2)', soldOut.before.comp);
  check('stock — after: Atmosphere selected from the two in-stock exhibits, nothing degrades',
    soldOut.afterDecision.architecture === 'gallery' && soldOut.after.expression === 'atmosphere' && !soldOut.after.degraded && soldOut.afterDecision.reason.startsWith('2 photographed pieces and a shop banner.'), soldOut.afterDecision.reason);
  // (3) Categories: three aisles overall, two among the 12 newest.
  const thin = contrast(merchant({ size: 20, category: (i) => (i < 12 ? ['Serums', 'Creams'][i % 2] : 'Oils') }), { bodyNiche: 'wellness' });
  check('categories — before: Routine selected from three aisles, resolver degrades it to Item on the home slice',
    thin.beforeDecision.architecture === 'counter' && thin.before.expression === 'routine' && thin.before.degraded && thin.before.comp.expressionFallback === 'routine needs 3 categories (has 2)', thin.before.comp);
  check('categories — after: Item selected, nothing degrades', thin.afterDecision.architecture === 'counter' && thin.after.expression === 'item' && !thin.after.degraded, thin.after.comp);

  // Hero media: the two never disagree in a way that breaks a decision.
  const generatedHero = { assets: { hero_image_url: 'https://generated-hero.jpg' } };
  check('whatever Assignment counts as hero media (the banner) the resolver also holds — with or without a site hero on top',
    resolveHeroMedia(shopOf('https://banner.jpg'), null) !== null && resolveHeroMedia(shopOf('https://banner.jpg'), generatedHero) !== null && resolveHeroMedia(shopOf(null), null) === null);
  const bannerless = merchant({ size: 5, banner: false });
  const bl = viaRoute(bannerless, { bodyNiche: 'jewelry' }, true);
  const resolverWithGenerated = ritualRecipeEligibility('gallery-led', { products: resolverSees(bannerless), heroMedia: resolveHeroMedia(shopOf(null), generatedHero), storefrontFamily: null });
  check('no banner → Assignment never assigns Gallery, even though a later generated hero would satisfy the resolver (Assignment is the stricter side)',
    bl.assignment.architecture !== 'gallery' && !bl.assignment.eligibility.gallery.eligible && resolverWithGenerated.eligible, bl.assignment.eligibility.gallery);
  const wall = merchant({ size: 6, banner: false });
  const wl = viaRoute(wall, { bodyNiche: 'jewelry' }, true);
  const wallRender = firstRender(wall, decisionOf(wl.assignment), wl.signals, resolveHeroMedia(shopOf(null), generatedHero));
  check('a Subtraction storefront still resolves as Subtraction once a generated hero exists', decisionOf(wl.assignment).family === 'subtraction' && wallRender.comp.recipe === 'subtraction' && !wallRender.degraded, wallRender.comp);
}

console.log('\n[25] Phase 14 WP2 — no first-render degradation (gate open)');
{
  const generatedHero = { assets: { hero_image_url: 'https://generated-hero.jpg' } };
  let degraded = 0;
  let degradedBefore = 0;
  let cases = 0;
  const drawn: Record<string, number> = {};
  const expressions: Record<string, number> = {};
  let firstOffender: unknown;
  for (const m of wp2Merchants()) {
    for (const bodyNiche of WP2_BODY_NICHES) {
      const r = viaRoute(m, { bodyNiche }, true);
      const d = decisionOf(r.assignment);
      // The resolver's hero on first render: the banner alone, and the banner under a generated site hero.
      const heroes: HeroMedia[] = [resolveHeroMedia(shopOf(m.bannerUrl), null), resolveHeroMedia(shopOf(m.bannerUrl), generatedHero)];
      for (const heroMedia of heroes) {
        const fr = firstRender(m, d, r.signals, heroMedia);
        cases += 1;
        if (fr.degraded) { degraded += 1; firstOffender = firstOffender ?? { bodyNiche, decision: d, comp: fr.comp }; }
      }
      const fr = firstRender(m, d, r.signals, r.heroMedia);
      drawn[fr.expected] = (drawn[fr.expected] ?? 0) + 1;
      if (fr.expression) expressions[fr.expression] = (expressions[fr.expression] ?? 0) + 1;
      const before = legacyRoute(m, { bodyNiche }, true);
      if (firstRender(m, decisionOf(before.assignment), before.signals, before.heroMedia).degraded) degradedBefore += 1;
    }
  }
  check(`the resolver draws exactly the requested recipe, with no fallback reason (${cases} first renders)`, degraded === 0, firstOffender);
  check('…and exactly the requested expression, with no expression fallback', degraded === 0);
  check('coverage: every recipe was requested and drawn', ['classic', 'product-first', 'gallery-led', 'subtraction'].every((k) => (drawn[k] ?? 0) > 0), drawn);
  check('coverage: every expression was requested and drawn', ['routine', 'item', 'atmosphere', 'scale'].every((k) => (expressions[k] ?? 0) > 0), expressions);
  check(`contrast: without WP2 the same merchants degrade on first render (${degradedBefore} cases)`, degradedBefore > 0);
}

console.log('\n[26] Phase 14 WP2 — gate matrix');
{
  // ── Gate CLOSED: the route's assignment block is the Phase 10H / 10L.4 block.
  let sameAssignment = true;
  let sameSignals = true;
  let untouchedInputs = true;
  let cases = 0;
  for (const m of wp2Merchants().filter((_, i) => i % 4 === 0)) {
    for (const bodyNiche of [undefined, 'general', 'home', 'tech', 'jewelry'] as unknown[]) {
      for (const forcedTemplate of [null, archetypeForced[1], archetypeForced[2]] as Forced[]) {
        const now = viaRoute(m, { bodyNiche, forcedTemplate }, false);
        const was = legacyRoute(m, { bodyNiche, forcedTemplate }, false);
        cases += 1;
        if (JSON.stringify(now.assignment) !== JSON.stringify(was.assignment)) sameAssignment = false;
        if (JSON.stringify(now.signals) !== JSON.stringify(was.signals)) sameSignals = false;
        if (now.aligned.niche !== now.nicheKey || now.aligned.renderProducts !== undefined || now.input.renderProducts !== undefined) untouchedInputs = false;
      }
    }
  }
  check(`closed: the assignment object is identical to the pre-WP2 route's (${cases} cases)`, sameAssignment);
  check('closed: the expression signals are identical to the pre-WP2 route\'s', sameSignals);
  check('closed: the niche is passed through untouched and no render window is built or passed', untouchedInputs);
  const sample: ArchitectureAssignmentInput = { niche: 'jewelry', products: photographed(20, 20, ['Rings', 'Chains', 'Watches']), heroMedia: banner };
  check('closed: the engine ignores a render window even if one is handed to it', JSON.stringify(closed({ ...sample, renderProducts: [] })) === JSON.stringify(closed(sample)) && JSON.stringify(run({ ...sample, renderProducts: [] })) === JSON.stringify(run(sample)));
  check('closed: expressionFloorSignals with no window returns the Phase 10L.4 values',
    JSON.stringify(expressionFloorSignals({ signals: { categoryCount: 7 }, products: sample.products })) === JSON.stringify({ categoryCount: 7, exhibits: selectGalleryExhibits(sample.products).length }));
  const stored = { template_key: 'ritual' as const, storefront_family: 'lifestyle-story' as const, layout_strategy: { hero: 'split' as const, grid: 'masonry' as const }, niche_reasoning: 'x' } as unknown as WebsiteConfig;
  const closedSignals = viaRoute(merchant({ size: 12, banner: true }), { bodyNiche: 'general' }, false).signals;
  check('closed: existing configs unchanged — the expression write returns the SAME config object', applyExpressionSelection(stored, { gridSurvivedGuard: true, signals: closedSignals }).config === stored);
  check('the generation gate constant is still false', RITUAL_RECIPE_GENERATION_ENABLED === false);

  // ── Gate OPEN: inputs changed, authority rules did not.
  let rulesUnchanged = true;
  for (const input of sweepInputs()) {
    // The whole list handed as the window is the same judged data → the same decision as WP1.
    if (JSON.stringify(open({ ...input, renderProducts: input.products })) !== JSON.stringify({ ...open(input) })) rulesUnchanged = false;
  }
  check('open: the engine\'s rules are unchanged — judged on the same data it returns the WP1 decision exactly', rulesUnchanged);
  check('open: Subtraction thresholds unchanged', SUBTRACTION_ASSIGNMENT_RULES.minPicturedProducts === 6 && SUBTRACTION_ASSIGNMENT_RULES.minPicturedRatio === 0.9);
  const partialWall = viaRoute(merchant({ size: 30, pictured: (i) => i < 12, banner: false }), { bodyNiche: 'jewelry' }, true);
  check('open: the Subtraction rule still reads the whole catalog (12 newest photographed, 40% overall → not Subtraction)',
    decisionOf(partialWall.assignment).family !== 'subtraction' && decisionOf(partialWall.assignment).eligibility.subtraction.reasons.join() === 'needs 90% photographed products (has 40%)', decisionOf(partialWall.assignment).eligibility.subtraction);
  const deep = viaRoute(merchant({ size: 30, priced: (i) => i % 2 === 1, category: () => 'Soaps' }), { bodyNiche: 'cosmetics' }, true);
  check('open: catalog-depth signals still read the whole catalog (15 priced overall, 6 in the window → Counter by depth)',
    deep.assignment.architecture === 'counter' && deep.assignment.signals.pricedCount === 15 && deep.assignment.signals.productCount === 30 && deep.assignment.reason.endsWith(MARK.tieBreakCounter), deep.assignment);
  const openRun = viaRoute(merchant({ size: 20, category: (i) => ['Serums', 'Creams', 'Oils'][i % 3], banner: true }), { bodyNiche: 'general' }, true);
  check('open: Assignment decisions reflect the WP2 inputs (no niche, 12-row window)', openRun.input.niche === null && openRun.input.renderProducts?.length === 12 && openRun.assignment.signals.niche === null && openRun.assignment.signals.productCount === 20);
  check('open: the decision keeps the WP1 key order — no field added', Object.keys(openRun.assignment).join(',') === OPEN_KEYS);

  // ── Source: what the route does, and what nothing else does.
  const root = process.cwd();
  const read = (rel: string): string => {
    try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch { return ''; }
  };
  const walk = (rel: string, out: string[] = []): string[] => {
    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true }); } catch { return out; }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const child = `${rel}/${e.name}`;
      if (e.isDirectory()) walk(child, out);
      else if (/\.(ts|tsx|mts|js|jsx|mjs)$/.test(e.name)) out.push(child);
    }
    return out;
  };
  const argsOf = (source: string, callee: string): string => {
    const at = source.indexOf(`${callee}(`);
    if (at === -1) return '';
    let depth = 0;
    for (let i = at + callee.length; i < source.length; i += 1) {
      if (source[i] === '(') depth += 1;
      if (source[i] === ')') { depth -= 1; if (depth === 0) return source.slice(at + callee.length + 1, i); }
    }
    return '';
  };
  const topLevelCommas = (args: string): number => {
    let depth = 0;
    let commas = 0;
    const trimmed = args.trim().replace(/,\s*$/, '');
    for (const ch of trimmed) {
      if (ch === '(' || ch === '{' || ch === '[') depth += 1;
      else if (ch === ')' || ch === '}' || ch === ']') depth -= 1;
      else if (ch === ',' && depth === 0) commas += 1;
    }
    return commas;
  };
  const ROUTE_FILE = 'app/api/ai/generate-website/route.ts';
  const ENGINE_FILE = 'lib/siteTemplates.ts';
  const LOADER_FILE = 'app/site/[slug]/siteData.ts';
  const route = read(ROUTE_FILE);
  const count = (source: string, needle: string): number => source.split(needle).length - 1;

  const alignArgs = argsOf(route, 'alignAssignmentInputs');
  check('route: one alignAssignmentInputs call, given the parsed niche and the stock-carrying rows, with NO gate option (the constant decides)',
    count(route, 'alignAssignmentInputs(') === 1 && topLevelCommas(alignArgs) === 0 && /niche:\s*nicheKey,/.test(alignArgs) && /stock_quantity:\s*products\[i\]\?\.stock_quantity \?\? null/.test(alignArgs) && !alignArgs.includes('gateOpen'), alignArgs.slice(0, 120));
  const engineArgs = argsOf(route, 'assignArchitecture');
  check('route: the engine call takes its niche and render window from the alignment, and the full stock-less list as before',
    /niche:\s*aligned\.niche,/.test(engineArgs) && /renderProducts:\s*aligned\.renderProducts,/.test(engineArgs) && /products:\s*assignmentProducts,/.test(engineArgs) && /dominantCategory,/.test(engineArgs) && !/niche:\s*nicheKey/.test(engineArgs), engineArgs.slice(0, 160));
  check('route: one expressionFloorSignals call, behind the render-window guard', count(route, 'expressionFloorSignals(') === 1 && /if \(aligned\.renderProducts\) \{\s*expressionSignals = \{\s*\.\.\.expressionSignals,\s*\.\.\.expressionFloorSignals\(/.test(route));
  check('route: the Phase 10L.4 expression-signals literal is still there, untouched',
    /expressionSignals = \{\s*niche: assignment\.signals\.niche,\s*dominantCategory,\s*categoryCount: assignment\.signals\.categoryCount,\s*exhibits: selectGalleryExhibits\(assignmentProducts\)\.length,\s*\};/.test(route));
  check('route: the inventory read now carries stock_quantity', route.includes(".select('id, name, description, category, price, image_url, ad_video_url, ad_hero_image_url, stock_quantity')"));
  const blockStart = route.indexOf('const assignmentProducts = products.map(');
  const blockEnd = route.indexOf("console.warn('[generate-website] Architecture assignment skipped:'");
  const outsideBlock = route.slice(0, blockStart) + route.slice(blockEnd);
  check('route: `aligned` is read only inside the assignment block — not by the prompt, the template pin, the carriers or the persist call',
    blockStart > 0 && blockEnd > blockStart && !/\baligned\b/.test(outsideBlock) && count(outsideBlock, 'alignAssignmentInputs') === 1 && count(outsideBlock, 'expressionFloorSignals') === 1);
  check('route: persistence is untouched — the RPC still stores the config and nothing from the assignment', /p_config: config,/.test(route) && !/p_[a-z_]+:\s*(aligned|assignment)\b/.test(route));
  check('route: the template pin is untouched', /if \(chosenTemplate\) \{\s*config\.template_key = chosenTemplate;\s*\}/.test(route));

  // The resolver's read is what the window claims it is.
  const loader = read(LOADER_FILE);
  const homeRead = loader.slice(loader.indexOf('async function readHomeProducts'), loader.indexOf('async function readHomeProducts') + 900);
  check('loader: the home read is still the 12 newest rows, with stock — the window\'s premise',
    homeRead.includes(`.limit(${ASSIGNMENT_RENDER_WINDOW})`) && homeRead.includes("order('created_at', { ascending: false })") && homeRead.includes('stock_quantity'), homeRead.slice(0, 80));
  check('route: the inventory read uses the same order (newest first)', /\.eq\('user_id', user!\.id\)\s*\.order\('created_at', \{ ascending: false \}\)\s*\.limit\(30\)/.test(route));

  // Nothing else consumes WP2 — no carrier, no renderer, no other route.
  const WP2_SURFACE = /alignAssignmentInputs|expressionFloorSignals|ASSIGNMENT_RENDER_WINDOW|AssignmentInputAlignment|UNDECLARED_STUDIO_NICHE|renderProducts/;
  const others = [...walk('app'), ...walk('components'), ...walk('lib')].filter((f) => f !== ENGINE_FILE && f !== ROUTE_FILE);
  const consumers = others.filter((f) => WP2_SURFACE.test(read(f)));
  check(`no component, page, loader, library or other route references WP2 (${others.length} files)`, others.length > 50 && consumers.length === 0, consumers);
  const engine = read(ENGINE_FILE);
  const start = engine.indexOf('// ARCHITECTURE ASSIGNMENT ENGINE (Phase 10H');
  const end = engine.indexOf('// EXPRESSION SELECTION (Phase 10L.3');
  check('engine file: WP2 lives in the assignment-engine section only — carriers, resolver and expression write untouched',
    start > 0 && end > start && !WP2_SURFACE.test(engine.slice(0, start) + engine.slice(end)), (engine.slice(0, start) + engine.slice(end)).match(WP2_SURFACE)?.[0]);
  const legacyRow = { template_key: 'ritual' as const, storefront_family: 'lifestyle-story' as const, layout_strategy: { hero: 'split' as const, grid: 'masonry' as const } };
  check('resolver: a legacy row still resolves classic with its raw hero and grid', resolveRitualRecipe(legacyRow) === 'classic' && JSON.stringify(resolveRitualComposition({ config: legacyRow, products: photographed(12, 12), heroMedia: banner })) === '{"requested":"classic","recipe":"classic","hero":"split","grid":"masonry","fallback":null,"expressionFallback":null}');
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 14 WP3 — AUTHORITY CARRIERS. Shared fixtures for [27]–[32].
// ─────────────────────────────────────────────────────────────────────────────

/** A complete model generation (the compat gate's sample) — split_cta
 *  included, so a section mix that wrongly survived would show. */
const GENERATION = WebsiteGenerationSchema.parse({
  template_key: 'ritual',
  niche_reasoning: 'Beauty oils suit the minimal ritual anatomy.',
  hero: { tagline: 'Skin Rituals, Perfected', headline: 'Skin Drinks Golden Light', subheadline: 'Cold-pressed oils for skin that keeps its glow.' },
  value_props: [
    { title: 'Cold-Pressed', body: 'Pressed within days of harvest.' },
    { title: 'Small Batches', body: 'Blended weekly, never warehoused.' },
  ],
  product_grid: { title: 'The Ritual Edit', intro: 'Nine oils and serums, one calm routine.' },
  story: { body: 'We started at a kitchen table with one bottle of marula oil and a belief: skincare should be food for the skin.' },
  cta: { headline: 'Your Skin Remembers Ritual', subtext: 'Order before noon and it ships the same day.', button_label: 'Begin The Ritual' },
  seo: { title: 'Golden Ritual Oils', description: 'Cold-pressed marula and baobab skincare, blended in small batches.' },
  split_cta: { headline: 'Kept In Amber Glass', body: 'Light-proof bottles keep every active potent to the last drop.', button_label: 'See The Oils' },
});

/** Every family and grid value a model can name — plus none, plus junk. */
const MODEL_FAMILIES: unknown[] = [undefined, ...STOREFRONT_FAMILIES, 'not-a-family'];
const MODEL_GRIDS: unknown[] = [undefined, 'standard', 'masonry', 'featured-first', 'counter', 'gallery'];

/** A layout as the model returns it, with every OTHER lever set so that what
 *  the carrier leaves alone is visible. */
function modelLayout(family: unknown, grid: unknown): WebsiteLayout {
  const layout: Record<string, unknown> = {
    block_order: ['hero_banner', 'product_grid', 'value_props', 'story_text', 'cta_banner'],
    product_grid_display: 'carousel',
    theme_preset_index: 2,
    display_font: 'playfair',
    layout_strategy: grid === undefined ? { hero: 'split' } : { hero: 'split', grid },
  };
  if (family !== undefined) layout.storefront_family = family;
  return layout as WebsiteLayout;
}

/** One decision per outcome the engine can return, from the engine itself. */
const WP3_DECISIONS: Array<[string, StorefrontDecision]> = [
  ['counter', open({ niche: 'tech', products: photographed(20, 20, ['Phones', 'Laptops', 'Audio']), heroMedia: banner })],
  ['gallery', open({ niche: 'jewelry', products: photographed(5, 5), heroMedia: banner })],
  ['subtraction', open({ niche: 'jewelry', products: photographed(6, 6), heroMedia: null })],
  ['classic / lifestyle-story', open({ niche: 'cosmetics', products: photographed(8, 8, 'Serum'), heroMedia: banner })],
  ['classic / product-first', open({ niche: 'tech', products: photographed(2, 2, ['A', 'B']), heroMedia: null })],
  ['classic / menu-occasion', open({ niche: 'food', products: photographed(10, 10, ['Cakes', 'Cupcakes']), heroMedia: banner })],
  ['classic floor', decisionOf(assignArchitectureOrFloor(null as unknown as ArchitectureAssignmentInput, { gateOpen: true }))],
];
const carry = (layout: WebsiteLayout | null | undefined, d: ArchitectureAssignment | null | undefined): WebsiteLayout => {
  const out = carryStorefrontDecision(layout, d, { gateOpen: true });
  if (!out) throw new Error('gate open returned no layout');
  return out;
};
const isRecipeGrid = (g: unknown): boolean => g === 'counter' || g === 'gallery';
/** The recipe the RESOLVER would be asked for by a carried layout. */
const requestedBy = (d: StorefrontDecision, carried: WebsiteLayout) =>
  resolveRitualRecipe({ template_key: d.template, storefront_family: carried.storefront_family, layout_strategy: carried.layout_strategy });
/** The existing carriers, fed a carried layout on the decision's template. */
function assemble(d: StorefrontDecision, carried: WebsiteLayout): WebsiteConfig {
  const gen = { ...GENERATION, template_key: d.template, layout: carried };
  return applyGenerationLayout(generationToConfig(gen), carried, classicLayoutBounds(d.template));
}
const canon = (o: object): string => JSON.stringify(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));

console.log('\n[27] Phase 14 WP3 — single origin: the carried family and grid are Assignment\'s (gate open)');
{
  check('fixtures: one decision per outcome',
    WP3_DECISIONS.map(([, d]) => `${d.architecture}/${d.family}`).join() === 'counter/product-first,gallery/lifestyle-story,classic/subtraction,classic/lifestyle-story,classic/product-first,classic/menu-occasion,classic/lifestyle-story',
    WP3_DECISIONS.map(([, d]) => `${d.architecture}/${d.family}`));
  check('the recipe grid a decision owns: counter, gallery, none for Classic and Subtraction',
    WP3_DECISIONS.map(([, d]) => assignedRecipeGrid(d)).join() === 'counter,gallery,,,,,');

  let familyOk = true;
  let gridOk = true;
  let cases = 0;
  let offender: unknown;
  for (const [name, d] of WP3_DECISIONS) {
    const owned = assignedRecipeGrid(d);
    for (const family of MODEL_FAMILIES) {
      for (const grid of MODEL_GRIDS) {
        const c = carry(modelLayout(family, grid), d);
        cases += 1;
        if (c.storefront_family !== d.family) { familyOk = false; offender = offender ?? { name, family, got: c.storefront_family }; }
        const got = c.layout_strategy?.grid;
        const want = owned ?? (isRecipeGrid(grid) ? undefined : grid);
        if (got !== want) { gridOk = false; offender = offender ?? { name, grid, got }; }
      }
    }
  }
  check(`carried family = the decision's family for every model family value (${cases} cases)`, familyOk, offender);
  check('carried grid = the decision\'s recipe grid for every model grid value; with no recipe owned, a model recipe grid is removed and a presentation grid passes through', gridOk, offender);

  // No model layout at all — the decision is still carried.
  const bare = WP3_DECISIONS.map(([, d]) => JSON.stringify(carry(null, d)));
  check('no model layout (null) → a layout holding exactly the decision',
    bare.join('|') === [
      '{"storefront_family":"product-first","layout_strategy":{"grid":"counter"}}',
      '{"storefront_family":"lifestyle-story","layout_strategy":{"grid":"gallery"}}',
      '{"storefront_family":"subtraction"}',
      '{"storefront_family":"lifestyle-story"}',
      '{"storefront_family":"product-first"}',
      '{"storefront_family":"menu-occasion"}',
      '{"storefront_family":"lifestyle-story"}',
    ].join('|'), bare);
  check('…and undefined behaves the same', WP3_DECISIONS.every(([, d], i) => JSON.stringify(carry(undefined, d)) === bare[i]));

  // Through the EXISTING carriers: the family arrives on the config.
  let arrives = true;
  let valid = true;
  let guardStillStrips = true;
  for (const [, d] of WP3_DECISIONS) {
    for (const family of MODEL_FAMILIES) {
      for (const grid of MODEL_GRIDS) {
        const config = assemble(d, carry(modelLayout(family, grid), d));
        if (config.storefront_family !== d.family) arrives = false;
        if (!WebsiteConfigSchema.safeParse(config).success) valid = false;
        // Production gate: a stamped recipe grid still cannot reach a config while the constant is false.
        if (isRecipeGrid(config.layout_strategy?.grid)) guardStillStrips = false;
      }
    }
  }
  check('through the untouched carriers the decision\'s family is the config\'s family, for every model input', arrives);
  check('every assembled config validates strictly', valid);
  check('the generation guard still strips a stamped recipe grid while the gate constant is false (activation is not WP3)', RITUAL_RECIPE_GENERATION_ENABLED === false && guardStillStrips);
  const subtractionConfig = assemble(WP3_DECISIONS[2][1], carry(modelLayout('lifestyle-story', 'counter'), WP3_DECISIONS[2][1]));
  const visible = (c: WebsiteConfig) => (c.blocks ?? []).filter((b) => !b.hidden).map((b) => b.type).join();
  check('a Subtraction decision arrives as Subtraction even when the model named another family and a recipe grid (the wall takes the family\'s own masonry default, never the model\'s recipe grid)',
    subtractionConfig.storefront_family === 'subtraction' && visible(subtractionConfig) === 'hero_banner,product_grid' && subtractionConfig.layout_strategy?.grid === 'masonry', subtractionConfig.layout_strategy);
  const storyConfig = assemble(WP3_DECISIONS[3][1], carry(modelLayout('subtraction', 'masonry'), WP3_DECISIONS[3][1]));
  check('a model-named Subtraction does NOT arrive under a Classic decision', storyConfig.storefront_family === 'lifestyle-story' && (storyConfig.blocks ?? []).filter((b) => !b.hidden).length === 5 && storyConfig.layout_strategy?.grid === 'masonry', visible(storyConfig));
}

console.log('\n[28] Phase 14 WP3 — carrier independence: the model\'s family and grid do not decide (gate open)');
{
  let oneFamily = true;
  let oneRecipe = true;
  let oneRequest = true;
  const expectedRecipe = ['product-first', 'gallery-led', 'subtraction', 'classic', 'classic', 'classic', 'classic'];
  WP3_DECISIONS.forEach(([, d], index) => {
    const families = new Set<unknown>();
    const recipes = new Set<unknown>();
    const requests = new Set<string>();
    for (const family of MODEL_FAMILIES) {
      for (const grid of MODEL_GRIDS) {
        const c = carry(modelLayout(family, grid), d);
        families.add(c.storefront_family);
        recipes.add(isRecipeGrid(c.layout_strategy?.grid) ? c.layout_strategy?.grid : null);
        requests.add(requestedBy(d, c));
      }
    }
    if (families.size !== 1 || !families.has(d.family)) oneFamily = false;
    if (recipes.size !== 1 || !recipes.has(assignedRecipeGrid(d))) oneRecipe = false;
    if (requests.size !== 1 || !requests.has(expectedRecipe[index])) oneRequest = false;
  });
  check('for each decision, ONE carried family across all model family inputs', oneFamily);
  check('for each decision, ONE carried recipe grid (or none) across all model grid inputs', oneRecipe);
  check('what the resolver would be asked for depends on the decision alone: counter, gallery, subtraction, classic ×4', oneRequest);
  const counterD = WP3_DECISIONS[0][1];
  const classicD = WP3_DECISIONS[3][1];
  check('model said gallery + subtraction, decision says Counter → counter / product-first', JSON.stringify([carry(modelLayout('subtraction', 'gallery'), counterD).storefront_family, carry(modelLayout('subtraction', 'gallery'), counterD).layout_strategy?.grid]) === '["product-first","counter"]');
  check('model said counter, decision says Classic → no recipe grid', carry(modelLayout('product-first', 'counter'), classicD).layout_strategy?.grid === undefined && carry(modelLayout('product-first', 'counter'), classicD).storefront_family === 'lifestyle-story');
  check('model said featured-first, decision says Classic → the presentation pick passes through', carry(modelLayout(undefined, 'featured-first'), classicD).layout_strategy?.grid === 'featured-first');

  // Everything that is NOT the engine's is carried through unchanged.
  const model = modelLayout('menu-occasion', 'gallery');
  const c = carry(model, counterD);
  check('block order, display, accent index, face and the hero variant are carried through unchanged',
    JSON.stringify(c.block_order) === JSON.stringify(model.block_order) && c.product_grid_display === 'carousel' && c.theme_preset_index === 2 && c.display_font === 'playfair' && c.layout_strategy?.hero === 'split');
  check('only two keys can differ from the model layout: storefront_family and layout_strategy.grid',
    Object.keys(c).sort().join() === Object.keys(model).sort().join() && Object.keys(c.layout_strategy ?? {}).sort().join() === 'grid,hero');

  // Purity.
  const frozenLayout = deepFreeze(modelLayout('subtraction', 'gallery'));
  const frozenDecision = deepFreeze(open({ niche: 'tech', products: photographed(20, 20, ['Phones', 'Laptops', 'Audio']), heroMedia: null }));
  const beforeLayout = JSON.stringify(frozenLayout);
  let pure = true;
  let out: WebsiteLayout | null = null;
  try { out = carry(frozenLayout, frozenDecision); } catch { pure = false; }
  check('pure: deep-frozen layout and decision are never written to, a new layout is returned', pure && out !== null && out !== frozenLayout && out.layout_strategy !== frozenLayout.layout_strategy && JSON.stringify(frozenLayout) === beforeLayout);
  check('deterministic', JSON.stringify(carry(modelLayout('subtraction', 'gallery'), counterD)) === JSON.stringify(carry(modelLayout('subtraction', 'gallery'), counterD)));

  // No decision with the gate open → the Classic floor, never the model's recipe or Subtraction.
  const closedObject = closed({ niche: 'tech', products: photographed(20, 20, ['Phones', 'Laptops', 'Audio']), heroMedia: banner });
  const junkFamily = { ...counterD, family: 'not-a-family' } as unknown as ArchitectureAssignment;
  let floored = true;
  for (const missing of [null, undefined, closedObject, junkFamily]) {
    for (const family of MODEL_FAMILIES) {
      for (const grid of MODEL_GRIDS) {
        const f = carry(modelLayout(family, grid), missing);
        if (f.storefront_family !== 'lifestyle-story' || isRecipeGrid(f.layout_strategy?.grid)) floored = false;
      }
    }
  }
  check('gate open, no usable decision (null, undefined, a closed-gate object, an unknown family) → the Classic floor is stamped', floored);
}

console.log('\n[29] Phase 14 WP3 — visual-system preservation (ratified 13D, F4)');
{
  const ritualClassic = classicLayoutBounds('ritual');
  const under = (key: (typeof ARCHETYPE_KEYS)[number]) => composeVisualSystem(ARCHETYPES[key], 'ritual');

  const warm = under('warm-editorial');
  check('Warm Editorial → Ritual: the template changed; voice, typography, palette and accents survive, the section mix does not',
    warm.templateKey === 'ritual' && warm.templateChanged && JSON.stringify(warm.survives) === '{"copyVoice":true,"typography":true,"palette":true,"accents":true,"sectionMix":false}', warm.survives);
  check('Warm Editorial: its own accent, face, paper and ink are seated', canon(warm.theme) === canon({ accent: '#8a3412', display_font: 'fraunces', background: '#f4ede2', text: '#2b2015' }), warm.theme);
  check('Warm Editorial: its own accent presets and faces bound the build', warm.bounds.accentPresets === ARCHETYPES['warm-editorial'].accentPresets && warm.bounds.displayFonts === ARCHETYPES['warm-editorial'].displayFonts);

  const luxury = under('deep-luxury');
  check('Deep Luxury → Ritual: its own template; everything archetype-owned survives, the section mix does not',
    !luxury.templateChanged && JSON.stringify(luxury.survives) === '{"copyVoice":true,"typography":true,"palette":true,"accents":true,"sectionMix":false}', luxury.survives);
  check('Deep Luxury: the seated theme is its own theme, key for key (panels and corners included)', canon(luxury.theme) === canon(ARCHETYPES['deep-luxury'].theme), luxury.theme);
  check('Deep Luxury: its own accent presets and faces bound the build', luxury.bounds.accentPresets === ARCHETYPES['deep-luxury'].accentPresets && luxury.bounds.displayFonts === ARCHETYPES['deep-luxury'].displayFonts);

  const pastel = under('pastel-minimalist');
  check('Pastel Minimalist → Ritual: its own template; everything archetype-owned survives, the section mix does not',
    !pastel.templateChanged && JSON.stringify(pastel.survives) === '{"copyVoice":true,"typography":true,"palette":true,"accents":true,"sectionMix":false}', pastel.survives);
  check('Pastel Minimalist: the seated theme is its own theme, key for key', canon(pastel.theme) === canon(ARCHETYPES['pastel-minimalist'].theme), pastel.theme);
  check('Pastel Minimalist: its own accent presets and faces bound the build', pastel.bounds.accentPresets === ARCHETYPES['pastel-minimalist'].accentPresets && pastel.bounds.displayFonts === ARCHETYPES['pastel-minimalist'].displayFonts);

  const street = under('high-contrast-street');
  check('High-Contrast Street → Ritual: the template changed; ONLY the copy voice survives',
    street.templateChanged && JSON.stringify(street.survives) === '{"copyVoice":true,"typography":false,"palette":false,"accents":false,"sectionMix":false}', street.survives);
  check('High-Contrast Street: nothing of its theme is seated — not even its volt accent, which was only ever checked against Vitality\'s black canvas', JSON.stringify(street.theme) === '{}', street.theme);
  check('High-Contrast Street: Ritual\'s own swatches and faces bound the build', street.bounds.accentPresets === ritualClassic.accentPresets && street.bounds.accentPresets === TEMPLATE_THEMES.ritual.swatches && street.bounds.displayFonts === ritualClassic.displayFonts);

  // The five rules, for every archetype under every template.
  let voice = true;
  let typography = true;
  let palette = true;
  let accents = true;
  let mix = true;
  let template = true;
  let validTheme = true;
  for (const key of ARCHETYPE_KEYS) {
    const a = ARCHETYPES[key];
    // Ownership, stated independently of the implementation.
    const ownsFace = a.displayFonts.length > 0;
    const ownsPaper = 'background' in a.theme && 'text' in a.theme;
    for (const t of TEMPLATE_KEYS) {
      const comp = composeVisualSystem(a, t);
      const own = classicLayoutBounds(t);
      if (comp.copyDirection !== a.copyDirection || comp.vibe !== a.vibe || comp.survives.copyVoice !== true) voice = false;
      // (Vitality's fixed face is a fresh empty list per call — compare by value.)
      if (comp.survives.typography !== ownsFace || comp.theme.display_font !== (ownsFace ? a.theme.display_font : undefined) || JSON.stringify(comp.bounds.displayFonts) !== JSON.stringify(ownsFace ? a.displayFonts : own.displayFonts)) typography = false;
      if (ownsFace && comp.bounds.displayFonts !== a.displayFonts) typography = false;
      if (comp.survives.palette !== ownsPaper || comp.theme.background !== (ownsPaper ? a.theme.background : undefined) || comp.theme.text !== (ownsPaper ? a.theme.text : undefined) || comp.theme.primary !== (ownsPaper ? a.theme.primary : undefined)) palette = false;
      if (comp.survives.accents !== ownsPaper || comp.theme.accent !== (ownsPaper ? a.theme.accent : undefined) || comp.bounds.accentPresets !== (ownsPaper ? a.accentPresets : own.accentPresets)) accents = false;
      if (comp.survives.sectionMix !== false || comp.bounds.blockMix !== CLASSIC_BLOCK_MIX || comp.bounds.blockMix === a.blockMix || comp.bounds.serverGated.length !== 0) mix = false;
      if (comp.templateKey !== t || comp.bounds.templateKey !== t || comp.templateChanged !== (t !== a.template_key) || comp.bounds.orderHonored !== own.orderHonored || comp.bounds.carouselHonored !== own.carouselHonored) template = false;
      if (!SiteThemeSchema.safeParse(comp.theme).success) validTheme = false;
    }
  }
  check('copy voice: survives, always — every archetype under every template', voice);
  check('typography: survives only when archetype-owned; otherwise the assigned template\'s faces', typography);
  check('palette: survives only when archetype-owned (its own paper and ink); otherwise the assigned template\'s', palette);
  check('accents: survive only when archetype-owned (they travel with their own paper); otherwise the assigned template\'s swatches', accents);
  check('section mix: never survives — always the assigned template\'s mix, no archetype extras, no server-gated slot', mix);
  check('the build is bounded by the ASSIGNED template\'s facts', template);
  check('every seated theme is a valid site theme', validTheme);

  // Readability on the two template changes Assignment can cause.
  let readable = true;
  let offender: unknown;
  for (const comp of [warm, street]) {
    const paper = comp.theme.background ?? TEMPLATE_THEMES.ritual.paper;
    const ink = comp.theme.text ?? TEMPLATE_THEMES.ritual.ink;
    const body = contrastRatio(ink, paper);
    if (body === null || body < 4.5) { readable = false; offender = offender ?? { paper, ink, body }; }
    for (const p of comp.bounds.accentPresets) {
      const verdict = judgeAccent('ritual', p.hex);
      const surface = contrastRatio(p.hex, paper);
      if (verdict === null || verdict.blocked || surface === null || surface < 3) { readable = false; offender = offender ?? { preset: p.name, label: verdict?.vsLabel, surface }; }
    }
  }
  check('Warm Editorial and Street on Ritual: body copy clears 4.5:1 and every accent preset clears the 4.5:1 label guard and 3:1 against its paper', readable, offender);

  // Usable with the EXISTING carriers, unchanged.
  const counterD = WP3_DECISIONS[0][1];
  const carried = carry(modelLayout('lifestyle-story', 'masonry'), counterD);
  const seated = (comp: ReturnType<typeof composeVisualSystem>) => applyGenerationLayout({ ...generationToConfig({ ...GENERATION, template_key: comp.templateKey, layout: carried }), theme: comp.theme }, carried, comp.bounds);
  const warmBuild = seated(warm);
  check('seated through the untouched layout carrier — Warm Editorial on Ritual keeps its paper, ink and face lever, and the model\'s accent index picks from ITS presets',
    warmBuild.template_key === 'ritual' && warmBuild.theme?.background === '#f4ede2' && warmBuild.theme?.text === '#2b2015' && warmBuild.theme?.accent === ARCHETYPES['warm-editorial'].accentPresets[2].hex && warmBuild.theme?.display_font === 'playfair' && WebsiteConfigSchema.safeParse(warmBuild).success, warmBuild.theme);
  const streetBuild = seated(street);
  check('…Street on Ritual takes Ritual\'s paper and the model\'s accent index picks from RITUAL\'s swatches',
    streetBuild.template_key === 'ritual' && streetBuild.theme?.background === undefined && streetBuild.theme?.accent === TEMPLATE_THEMES.ritual.swatches[2].hex && WebsiteConfigSchema.safeParse(streetBuild).success, streetBuild.theme);
  check('…and neither build carries an archetype section (no split spread, no testimonials) although the generation offered one',
    GENERATION.split_cta !== undefined && [warmBuild, streetBuild].every((b) => (b.blocks ?? []).every((x) => (CLASSIC_BLOCK_MIX as readonly string[]).includes(x.type))), (warmBuild.blocks ?? []).map((b) => b.type));

  // Purity.
  const before = JSON.stringify(ARCHETYPES);
  for (const key of ARCHETYPE_KEYS) for (const t of TEMPLATE_KEYS) composeVisualSystem(ARCHETYPES[key], t);
  check('pure and deterministic: the archetype bundles are never written to', JSON.stringify(ARCHETYPES) === before && JSON.stringify(under('warm-editorial')) === JSON.stringify(warm) && under('warm-editorial').theme !== warm.theme);
}

console.log('\n[30] Phase 14 WP3 — theme independence: one merchant, every archetype (gate open)');
{
  const merchants: Array<[string, Merchant]> = [
    ['counter', merchant({ size: 20, category: (i) => ['Phones', 'Laptops', 'Audio'][i % 3], dominantCategory: 'electronics', banner: true })],
    ['gallery', merchant({ size: 5, dominantCategory: 'perfume', banner: true })],
    ['subtraction', merchant({ size: 6, dominantCategory: 'perfume', banner: false })],
    ['classic', merchant({ size: 8, category: () => 'Serum', banner: true })],
  ];
  const expectations = ['counter/product-first', 'gallery/lifestyle-story', 'classic/subtraction', 'classic/lifestyle-story'];
  merchants.forEach(([name, m], index) => {
    const builds = ARCHETYPE_KEYS.map((key, k) => {
      const archetype = ARCHETYPES[key];
      const r = viaRoute(m, { bodyNiche: 'general', forcedTemplate: { template: archetype.template_key, source: 'seller-archetype' } }, true);
      const d = decisionOf(r.assignment);
      // A DIFFERENT model layout under each archetype — the model must not matter either.
      const carried = carry(modelLayout(MODEL_FAMILIES[(k + index) % MODEL_FAMILIES.length], MODEL_GRIDS[(k * 2 + 1) % MODEL_GRIDS.length]), d);
      const comp = composeVisualSystem(archetype, d.template);
      const config = applyGenerationLayout({ ...generationToConfig({ ...GENERATION, template_key: d.template, layout: carried }), theme: comp.theme }, carried, comp.bounds);
      return {
        outcome: `${d.architecture}/${config.storefront_family}`,
        recipeGrid: assignedRecipeGrid(d) ?? 'none',
        carriedRecipe: isRecipeGrid(carried.layout_strategy?.grid) ? String(carried.layout_strategy?.grid) : 'none',
        expression: firstRender(m, d, r.signals, r.heroMedia).expression ?? 'none',
        template: config.template_key,
        look: JSON.stringify(config.theme ?? {}),
        valid: WebsiteConfigSchema.safeParse(config).success,
      };
    });
    const same = (pick: (b: (typeof builds)[number]) => string) => builds.every((b) => pick(b) === pick(builds[0]));
    check(`${name} merchant: same family and architecture under all four archetypes`, same((b) => b.outcome) && builds[0].outcome === expectations[index], builds.map((b) => b.outcome));
    check(`${name} merchant: same carried recipe grid — the decision's — under all four`, same((b) => b.carriedRecipe) && builds.every((b) => b.carriedRecipe === b.recipeGrid), builds.map((b) => b.carriedRecipe));
    check(`${name} merchant: same expression under all four`, same((b) => b.expression), builds.map((b) => b.expression));
    check(`${name} merchant: only the LOOK differs between archetypes, and every build validates`, new Set(builds.map((b) => b.look)).size > 1 && builds.every((b) => b.valid), builds.map((b) => b.look));
    if (name !== 'classic') check(`${name} merchant: Ritual under all four`, builds.every((b) => b.template === 'ritual'), builds.map((b) => b.template));
    else check('classic merchant: each seller\'s own template stands', builds.map((b) => b.template).join() === ARCHETYPE_KEYS.map((k) => ARCHETYPES[k].template_key).join(), builds.map((b) => b.template));
  });
}

console.log('\n[31] Phase 14 WP3 — legacy compatibility');
{
  // Gate closed: the carrier hands the SAME layout back, so the existing carriers see exactly what they saw.
  let identity = true;
  let sameConfig = true;
  let cases = 0;
  for (const [, d] of WP3_DECISIONS) {
    for (const family of MODEL_FAMILIES) {
      for (const grid of MODEL_GRIDS) {
        const layout = modelLayout(family, grid);
        const closedCarry = carryStorefrontDecision(layout, d, { gateOpen: false });
        const defaultCarry = carryStorefrontDecision(layout, d);
        cases += 1;
        if (closedCarry !== layout || defaultCarry !== layout) identity = false;
        for (const key of ARCHETYPE_KEYS) {
          const archetype = ARCHETYPES[key];
          const gen = { ...GENERATION, template_key: archetype.template_key, layout };
          const was = applyArchetype(generationToConfig(gen), archetype, gen, null);
          const now = applyArchetype(generationToConfig({ ...gen, layout: closedCarry ?? undefined }), archetype, { ...gen, layout: closedCarry ?? undefined }, null);
          if (JSON.stringify(was) !== JSON.stringify(now)) sameConfig = false;
        }
      }
    }
  }
  check(`closed (and with no gate argument): the carrier returns the SAME layout reference, whatever the decision (${cases} layouts)`, RITUAL_RECIPE_GENERATION_ENABLED === false && identity);
  check('closed: every archetype build through the existing carriers is byte-identical with and without the carrier', sameConfig);
  check('closed: an absent layout stays absent', carryStorefrontDecision(null, WP3_DECISIONS[0][1], { gateOpen: false }) === null && carryStorefrontDecision(undefined, WP3_DECISIONS[0][1], { gateOpen: false }) === undefined);

  // The existing bounds are what they were.
  check('the archetype bounds and the classic bounds are untouched by the composition',
    ARCHETYPE_KEYS.every((key) => archetypeLayoutBounds(ARCHETYPES[key]).blockMix === ARCHETYPES[key].blockMix && archetypeLayoutBounds(ARCHETYPES[key]).templateKey === ARCHETYPES[key].template_key && archetypeLayoutBounds(ARCHETYPES[key]).serverGated.join() === 'testimonials') &&
    TEMPLATE_KEYS.every((t) => classicLayoutBounds(t).blockMix === CLASSIC_BLOCK_MIX && classicLayoutBounds(t).accentPresets === TEMPLATE_THEMES[t].swatches));
  // Legacy rows.
  const legacy = { template_key: 'ritual' as const, storefront_family: 'lifestyle-story' as const, layout_strategy: { hero: 'split' as const, grid: 'masonry' as const } };
  check('a legacy ritual row still resolves classic with its raw hero and grid', resolveRitualRecipe(legacy) === 'classic' && JSON.stringify(resolveRitualComposition({ config: legacy, products: photographed(12, 12), heroMedia: banner })) === '{"requested":"classic","recipe":"classic","hero":"split","grid":"masonry","fallback":null,"expressionFallback":null}');
  check('a row with no family and no strategy still resolves classic', resolveRitualRecipe({ template_key: 'ritual' }) === 'classic' && resolveRitualRecipe({ template_key: 'editorial', layout_strategy: { grid: 'gallery' } }) === 'classic');
  const legacyGen = { ...GENERATION, layout: undefined };
  check('a generation with no layout assembles exactly as before (the same config object back from the layout carrier)', applyGenerationLayout(generationToConfig(legacyGen), undefined, classicLayoutBounds('ritual')).storefront_family === undefined && generationToConfig(legacyGen).blocks?.map((b) => b.type).join() === 'hero_banner,story_text,product_grid,value_props,cta_banner');
}

console.log('\n[32] Phase 14 WP3 — gate matrix: the generation route is the carriers\' only caller (WP4)');
{
  const root = process.cwd();
  const read = (rel: string): string => {
    try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch { return ''; }
  };
  const walk = (rel: string, out: string[] = []): string[] => {
    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true }); } catch { return out; }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const child = `${rel}/${e.name}`;
      if (e.isDirectory()) walk(child, out);
      else if (/\.(ts|tsx|mts|js|jsx|mjs)$/.test(e.name)) out.push(child);
    }
    return out;
  };
  const WP3_SURFACE = /carryStorefrontDecision|composeVisualSystem|assignedRecipeGrid|VisualSystemComposition/;
  const ENGINE_FILE = 'lib/siteTemplates.ts';
  const ROUTE_FILE = 'app/api/ai/generate-website/route.ts';

  const sources = [...walk('app'), ...walk('components'), ...walk('lib')].filter((f) => f !== ENGINE_FILE);
  const consumers = sources.filter((f) => WP3_SURFACE.test(read(f)));
  // Phase 14 WP4: the generation route calls both steps now — and only it.
  check(`only the generation route (WP4) references the carrier or the composition — no other route, API handler, component, page, loader or library file (${sources.length} files)`, sources.length > 50 && sources.includes(ROUTE_FILE) && consumers.join() === ROUTE_FILE, consumers);

  const engine = read(ENGINE_FILE);
  const start = engine.indexOf('// ARCHITECTURE ASSIGNMENT ENGINE (Phase 10H');
  const end = engine.indexOf('// EXPRESSION SELECTION (Phase 10L.3');
  const outside = engine.slice(0, start) + engine.slice(end);
  check('engine file: nothing outside the assignment-engine section references them — the layout carriers, the resolver and the expression write do not call them',
    start > 0 && end > start && !WP3_SURFACE.test(outside), outside.match(WP3_SURFACE)?.[0]);
  const body = (name: string): string => {
    // From the declaration to the function's own closing brace (the first
    // brace at column 0) — never into the comments or code that follow it.
    const at = engine.indexOf(`export function ${name}(`);
    const close = engine.indexOf('\n}', at + 1);
    return at === -1 || close === -1 ? '' : engine.slice(at, close + 2);
  };
  check('engine file: the existing carriers and the resolver are not edited to read a decision',
    ['generationToConfig', 'applyArchetype', 'applyGenerationLayout', 'applyExpressionSelection', 'guardRecipeGridPick', 'resolveRitualRecipe', 'resolveRitualComposition'].every((name) => body(name).length > 0 && !/StorefrontDecision|isStorefrontDecision|carryStorefrontDecision|composeVisualSystem|gateOpen/.test(body(name))));

  // The three existing carrier calls are the same statements as before WP4.
  // They read `legacyGeneration`, which WP4 leaves as the MODEL's own
  // generation — the same object — whenever the gate is closed ([37]).
  const route = read(ROUTE_FILE);
  const post = route.slice(route.indexOf('export async function POST'));
  check('route: the three existing carrier calls are untouched — they still read `legacyGeneration` (the model\'s own generation while the gate is closed, [37])',
    route.includes('let config = generationToConfig(legacyGeneration);') &&
    route.includes('config = applyArchetype(config, archetype, legacyGeneration, reviewRows);') &&
    route.includes('config = applyGenerationLayout(config, legacyGeneration.layout, classicLayoutBounds(config.template_key));'));
  check('route: the template pin and the persist call are untouched', /if \(chosenTemplate\) \{\s*config\.template_key = chosenTemplate;\s*\}/.test(route) && /p_config: config,/.test(route));
  check('route: still exactly one engine call, with no gate option', route.split('assignArchitecture(').length - 1 === 1 && route.includes('export async function POST') && post.split('gateOpen').length - 1 === 2);

  // Gate state.
  check('the generation gate constant is still false', RITUAL_RECIPE_GENERATION_ENABLED === false);
  check('guard still strips both recipe grids', guardRecipeGridPick('counter', 'ritual') === undefined && guardRecipeGridPick('gallery', 'ritual') === undefined);
  // Gate open, in one line each.
  const d = WP3_DECISIONS[1][1];
  const c = carry(modelLayout('product-first', 'counter'), d);
  check('gate open: the carrier returns the Assignment-owned values (Gallery decision over a model that said Counter)', c.storefront_family === d.family && c.layout_strategy?.grid === 'gallery' && assignedRecipeGrid(d) === 'gallery');
  check('gate open: what it returns is plain layout data — no config, no template, no decision object', Object.keys(c).sort().join() === 'block_order,display_font,layout_strategy,product_grid_display,storefront_family,theme_preset_index' && JSON.stringify(JSON.parse(JSON.stringify(c))) === JSON.stringify(c));
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 14 WP4 — ROUTE INTEGRATION (A3). Shared fixtures for [33]–[38].
// The route's four WP4 steps are module-private and a route module cannot be
// imported here, so they are LIFTED: the text between the route's two WP4
// markers is read from disk, its types are stripped by typescript's own
// transpiler, and it is evaluated against this script's lib imports. What
// runs below is the route's code, not a copy of it — in BOTH gate states,
// because each step takes the gate (or the authority it produced) as an input.
// ─────────────────────────────────────────────────────────────────────────────

const WP4_ROUTE_FILE = 'app/api/ai/generate-website/route.ts';
const WP4_ROUTE_SOURCE = ((): string => {
  try { return fs.readFileSync(path.join(process.cwd(), WP4_ROUTE_FILE), 'utf8').replace(/\r\n/g, '\n'); } catch { return ''; }
})();
const WP4_BEGIN = '// [WP4:BEGIN]';
const WP4_END = '// [WP4:END]';
const WP4_BLOCK = ((): string => {
  const a = WP4_ROUTE_SOURCE.indexOf(WP4_BEGIN);
  const b = WP4_ROUTE_SOURCE.indexOf(WP4_END);
  return a === -1 || b <= a ? '' : WP4_ROUTE_SOURCE.slice(a + WP4_BEGIN.length, b);
})();
/** POST, from its declaration to the end of the file. */
const WP4_POST = WP4_ROUTE_SOURCE.includes('export async function POST') ? WP4_ROUTE_SOURCE.slice(WP4_ROUTE_SOURCE.indexOf('export async function POST')) : '';

/** Every outside name the lifted block may use — all of them lib exports.
 *  The block runs in strict mode with ONLY these in scope, so a reference to
 *  anything else (a route local, a client, the gate constant) throws. */
const WP4_SCOPE: Record<string, unknown> = {
  ARCHITECTURES,
  DEFAULT_STOREFRONT_FAMILY,
  STOREFRONT_FAMILIES,
  SUBTRACTION_TEMPLATE_KEY,
  TEMPLATE_KEYS,
  applyGenerationLayout,
  assignedRecipeGrid,
  carryStorefrontDecision,
  composeVisualSystem,
  isStorefrontDecision,
};

type RouteAuthority = { decision: StorefrontDecision | null; template: TemplateKey; floor: 'missing' | 'invalid' | 'unreadable' | null };
type RouteSteps = {
  routeAuthority: (gateOpen: boolean, assignment: ArchitectureAssignment | null | undefined, floorTemplate: TemplateKey) => RouteAuthority | null;
  carryAuthority: <G extends Pick<WebsiteGeneration, 'template_key' | 'layout'>>(generation: G, authority: RouteAuthority | null) => G;
  applyAssignedLook: (config: WebsiteConfig, archetype: SiteArchetype | null, layout: WebsiteLayout | null | undefined, authority: RouteAuthority | null) => WebsiteConfig | null;
  describeRouteAuthority: (authority: RouteAuthority, shopId: string) => string;
};
let wp4LiftError: string | null = null;
const ROUTE_STEPS: RouteSteps | null = ((): RouteSteps | null => {
  if (!WP4_BLOCK) { wp4LiftError = 'WP4 markers not found in the route'; return null; }
  try {
    const js = ts.transpileModule(WP4_BLOCK, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText;
    const names = Object.keys(WP4_SCOPE);
    const factory = new Function(...names, `'use strict';\n${js}\nreturn { routeAuthority, carryAuthority, applyAssignedLook, describeRouteAuthority };`);
    return factory(...names.map((n) => WP4_SCOPE[n])) as RouteSteps;
  } catch (error) {
    wp4LiftError = String(error);
    return null;
  }
})();

/** How a request reaches the execute step: what the route's own resolution
 *  leaves in `archetype`, `chosenTemplate` and `forcedTemplate`. */
type RoutePath = { name: string; archetype: SiteArchetype | null; chosenTemplate: TemplateKey | undefined; forcedTemplate: Forced };
const WP4_PATHS: RoutePath[] = [
  // Onboarding: nothing chosen — before WP4 the MODEL picked the template.
  { name: 'onboarding', archetype: null, chosenTemplate: undefined, forcedTemplate: null },
  // Studio Step 1B: the seller's archetype pick, one path per archetype.
  ...ARCHETYPE_KEYS.map((key): RoutePath => ({ name: `studio/${key}`, archetype: ARCHETYPES[key], chosenTemplate: ARCHETYPES[key].template_key, forcedTemplate: { template: ARCHETYPES[key].template_key, source: 'seller-archetype' } })),
  // An approved concept carrying an archetype (same bundle, 'concept' source).
  { name: 'concept/warm-editorial', archetype: ARCHETYPES['warm-editorial'], chosenTemplate: ARCHETYPES['warm-editorial'].template_key, forcedTemplate: { template: ARCHETYPES['warm-editorial'].template_key, source: 'concept' } },
  // A pre-archetype concept and the manual templateOverride: a template, no bundle.
  { name: 'concept-template/editorial', archetype: null, chosenTemplate: 'editorial', forcedTemplate: { template: 'editorial', source: 'concept' } },
  { name: 'override/vitality', archetype: null, chosenTemplate: 'vitality', forcedTemplate: { template: 'vitality', source: 'seller-template' } },
  { name: 'override/ritual', archetype: null, chosenTemplate: 'ritual', forcedTemplate: { template: 'ritual', source: 'seller-template' } },
];

/** Everything a model can return that touches authority: each template, with
 *  no layout at all and with every family × grid it can name (111 shapes). */
const MODEL_GENERATIONS: WebsiteGeneration[] = [];
for (const template_key of TEMPLATE_KEYS) {
  MODEL_GENERATIONS.push({ ...GENERATION, template_key, layout: undefined });
  for (const family of MODEL_FAMILIES) {
    for (const grid of MODEL_GRIDS) MODEL_GENERATIONS.push({ ...GENERATION, template_key, layout: modelLayout(family, grid) });
  }
}

/** One merchant per outcome the engine can return for an undeclared niche. */
const WP4_MERCHANTS: Array<[string, Merchant, string]> = [
  ['counter', merchant({ size: 20, category: (i) => ['Phones', 'Laptops', 'Audio'][i % 3], dominantCategory: 'electronics', banner: true }), 'counter/product-first/ritual'],
  ['gallery', merchant({ size: 5, dominantCategory: 'perfume', banner: true }), 'gallery/lifestyle-story/ritual'],
  ['subtraction', merchant({ size: 6, dominantCategory: 'perfume', banner: false }), 'classic/subtraction/ritual'],
  ['classic story', merchant({ size: 8, category: () => 'Serum', banner: true }), 'classic/lifestyle-story/*'],
  ['classic product-first', merchant({ size: 2, category: (i) => ['Phones', 'Audio'][i % 2], dominantCategory: 'electronics' }), 'classic/product-first/*'],
  ['classic menu', merchant({ size: 10, category: (i) => ['Cakes', 'Cupcakes'][i % 2], dominantCategory: 'cakes', banner: true }), 'classic/menu-occasion/*'],
];

/** What the route knows before the model is called: the assignment block
 *  (viaRoute — pinned to the route source by [26]) and the route's own
 *  category heuristic (`nicheLabel ?? dominantCategory`). */
function routeFacts(m: Merchant, p: RoutePath, bodyNiche: unknown, gateOpen: boolean) {
  const r = viaRoute(m, { bodyNiche, forcedTemplate: p.forcedTemplate }, gateOpen);
  const key = r.nicheKey;
  const nicheLabel = key ? STUDIO_NICHES.find((n) => n.id === key.toLowerCase())?.label ?? key : null;
  return { ...r, heuristicTemplate: templateFromCategory(nicheLabel ?? m.dominantCategory) };
}
type RouteFacts = ReturnType<typeof routeFacts>;

/** The route's expression write, as it runs after the carriers. */
function expressionWrite(config: WebsiteConfig, signals: ExpressionSignals): WebsiteConfig {
  const survivingGrid = config.layout_strategy?.grid;
  return applyExpressionSelection(config, { gridSurvivedGuard: guardRecipeGridPick(survivingGrid, config.template_key) === survivingGrid, signals }).config;
}

/** POST's execute tail AFTER WP4, statement for statement, with the WP4 steps
 *  being the LIFTED ones. Section [33] pins the route source to this order.
 *  `floorCase` replaces what the assignment block left in `obtainedAssignment`. */
function routeTail(R: RouteSteps, facts: RouteFacts, p: RoutePath, model: WebsiteGeneration, gateOpen: boolean, floorCase?: { obtained: ArchitectureAssignment | null | undefined }) {
  const obtainedAssignment = floorCase ? floorCase.obtained : facts.assignment;
  const authority = R.routeAuthority(gateOpen, obtainedAssignment, p.chosenTemplate ?? facts.heuristicTemplate);
  const legacyGeneration = R.carryAuthority(model, authority);
  let config = generationToConfig(legacyGeneration);
  if (p.chosenTemplate) config.template_key = p.chosenTemplate;
  if (authority) config.template_key = authority.template;
  const assignedLook = R.applyAssignedLook(config, p.archetype, legacyGeneration.layout, authority);
  if (assignedLook) config = assignedLook;
  else if (p.archetype) config = applyArchetype(config, p.archetype, legacyGeneration, null);
  else if (legacyGeneration.layout) config = applyGenerationLayout(config, legacyGeneration.layout, classicLayoutBounds(config.template_key));
  const assembled = config;
  config = expressionWrite(config, facts.signals);
  return { authority, legacyGeneration, assembled, config, recomposed: assignedLook !== null };
}

/** The same tail BEFORE WP4 — the literal pre-WP4 statements, no step. */
function preWp4Tail(facts: RouteFacts, p: RoutePath, model: WebsiteGeneration): WebsiteConfig {
  let config = generationToConfig(model);
  if (p.chosenTemplate) config.template_key = p.chosenTemplate;
  if (p.archetype) config = applyArchetype(config, p.archetype, model, null);
  else if (model.layout) config = applyGenerationLayout(config, model.layout, classicLayoutBounds(config.template_key));
  return expressionWrite(config, facts.signals);
}

/** The route's try / catch around the engine call: what `obtainedAssignment`
 *  holds afterwards. Set the moment the engine answers; null when it throws. */
function obtainedAfter(engine: () => ArchitectureAssignment): ArchitectureAssignment | null {
  let obtainedAssignment: ArchitectureAssignment | null = null;
  try {
    const assignment = engine();
    obtainedAssignment = assignment;
  } catch {
    // the route warns "Architecture assignment skipped" and carries on
  }
  return obtainedAssignment;
}

const recipeOf = (grid: unknown): string => (isRecipeGrid(grid) ? String(grid) : 'none');
const WP4_NICHES: unknown[] = [undefined, 'general', 'jewelry', 'tech', 'food', 'home'];

console.log('\n[33] Phase 14 WP4 — the route obtains Assignment before it pins the template');
{
  const count = (source: string, needle: string): number => source.split(needle).length - 1;
  check('route source read, WP4 block found between its two markers, above POST',
    WP4_ROUTE_SOURCE.length > 0 && WP4_BLOCK.length > 0 && count(WP4_ROUTE_SOURCE, WP4_BEGIN) === 1 && count(WP4_ROUTE_SOURCE, WP4_END) === 1 &&
    WP4_ROUTE_SOURCE.indexOf(WP4_END) < WP4_ROUTE_SOURCE.indexOf('export async function POST'));
  check('the WP4 block lifts and runs against lib imports alone (no route local, no client, no gate constant in scope)', ROUTE_STEPS !== null, wp4LiftError);
  check('the four WP4 steps are functions',
    ROUTE_STEPS !== null && (['routeAuthority', 'carryAuthority', 'applyAssignedLook', 'describeRouteAuthority'] as const).every((name) => typeof ROUTE_STEPS[name] === 'function'));
  check('the WP4 block is pure: no I/O, no logging, no clock, no randomness, no await',
    WP4_BLOCK.length > 0 && !/\b(await|async|console|process|fetch|require|import|supabase|admin|Date|setTimeout)\b|Math\.random/.test(WP4_BLOCK), WP4_BLOCK.match(/\b(await|async|console|process|fetch|require|import|supabase|admin|Date|setTimeout)\b|Math\.random/)?.[0]);
  check('the WP4 block never reads the gate constant — the gate reaches it as an argument', !WP4_BLOCK.includes('RITUAL_RECIPE_GENERATION_ENABLED'));

  // ── Order inside POST. Every anchor must exist, once, in this sequence.
  const at = (needle: string | RegExp): number => (typeof needle === 'string' ? WP4_POST.indexOf(needle) : WP4_POST.search(needle));
  const anchors: Array<[string, number]> = [
    ['the engine call', at('const assignment = assignArchitecture({')],
    ['the decision is carried out of the block', at('obtainedAssignment = assignment;')],
    ['the block\'s catch', at("console.warn('[generate-website] Architecture assignment skipped:'")],
    ['step 1: the authority is obtained', at('const authority = routeAuthority(')],
    ['the prompt is built', at('const templateConstraint = concept')],
    // Phase 14 WP5: the one place the authority reaches the prompt ([40]).
    ['WP5: the prompt step is handed the authority', at('const executePrompt = alignPromptToAuthority(')],
    ['the model is called', at("callerName: 'generate-website',")],
    ['step 2: the authority is carried onto the generation', at('const legacyGeneration = carryAuthority(modelGeneration, authority);')],
    ['the config is assembled', at('let config = generationToConfig(legacyGeneration);')],
    ['the existing template pin', at(/if \(chosenTemplate\) \{\s*config\.template_key = chosenTemplate;\s*\}/)],
    ['the WP4 template pin', at(/if \(authority\) \{\s*config\.template_key = authority\.template;\s*\}/)],
    ['step 3: the assigned look', at('const assignedLook = applyAssignedLook(config, archetype, legacyGeneration.layout, authority);')],
    ['the existing archetype carrier', at('config = applyArchetype(config, archetype, legacyGeneration, reviewRows);')],
    ['the existing layout carrier', at('config = applyGenerationLayout(config, legacyGeneration.layout, classicLayoutBounds(config.template_key));')],
    ['the expression write', at('const expressionWrite = applyExpressionSelection(config, {')],
    ['the persist call', at(".rpc('persist_matrix_website'")],
  ];
  const missing = anchors.filter(([, i]) => i < 0).map(([name]) => name);
  const outOfOrder = anchors.filter(([, i], k) => k > 0 && i <= anchors[k - 1][1]).map(([name]) => name);
  check('POST: every step of the execute tail is present', missing.length === 0, missing);
  check('POST: Assignment is obtained BEFORE the template is pinned — engine → decision carried out → authority → prompt → prompt step (WP5) → model → carried generation → config → pins → carriers → persist', missing.length === 0 && outOfOrder.length === 0, outOfOrder);

  // ── What each step is handed.
  const argsOf = (callee: string): string[] => {
    const start = WP4_POST.indexOf(`${callee}(`);
    if (start === -1) return [];
    let depth = 0;
    let piece = '';
    const out: string[] = [];
    for (let i = start + callee.length; i < WP4_POST.length; i += 1) {
      const ch = WP4_POST[i];
      if (ch === '(' || ch === '{' || ch === '[') { depth += 1; if (depth === 1) continue; }
      if (ch === ')' || ch === '}' || ch === ']') { depth -= 1; if (depth === 0) break; }
      if (ch === ',' && depth === 1) { out.push(piece.trim()); piece = ''; } else piece += ch;
    }
    if (piece.trim()) out.push(piece.trim());
    return out;
  };
  check('POST: the authority step is handed the gate CONSTANT, the block\'s own assignment object, and the floor template (the seller\'s chosen template, else the category heuristic)',
    argsOf('routeAuthority').join(' | ') === 'RITUAL_RECIPE_GENERATION_ENABLED | obtainedAssignment | chosenTemplate ?? heuristicTemplate', argsOf('routeAuthority'));
  check('POST: each WP4 step is called exactly once (the log line twice — one per level)',
    count(WP4_POST, 'routeAuthority(') === 1 && count(WP4_POST, 'carryAuthority(') === 1 && count(WP4_POST, 'applyAssignedLook(') === 1 && count(WP4_POST, 'describeRouteAuthority(') === 2);
  check('POST: the decision leaves the assignment block in one place — set right after the engine call, never in the catch, read only by the authority step',
    count(WP4_ROUTE_SOURCE, 'obtainedAssignment') === 3 && WP4_POST.includes('let obtainedAssignment: ArchitectureAssignment | null = null;') &&
    /forcedTemplate,\s*\}\);\s*obtainedAssignment = assignment;/.test(WP4_POST) && count(WP4_POST, 'obtainedAssignment = ') === 1);
  check('POST: the model\'s own generation is named twice — where it is destructured and where it is handed to the carry step — so no carrier can read it directly',
    count(WP4_POST, 'modelGeneration') === 2 && WP4_POST.includes('const { brand_tokens, matrix_theme, ...modelGeneration } = generation;') && !/\bgeneration\.(layout|template_key)\b/.test(WP4_POST));
  check('POST: template_key is written by exactly two statements — the existing pin, then Assignment\'s', count(WP4_POST, 'config.template_key = ') === 2);
  check('POST: the assigned look runs INSTEAD of the archetype carrier, never as well — `if (assignedLook) … else if (archetype) … else if (legacyGeneration.layout)`',
    /if \(assignedLook\) \{\s*config = assignedLook;\s*console\.log\([^\n]*\);\s*\} else if \(archetype\) \{/.test(WP4_POST) && /\} else if \(legacyGeneration\.layout\) \{\s*config = applyGenerationLayout\(/.test(WP4_POST));
  // Every read of `authority` in POST's code (whole-line comments set aside)
  // is one of the ten below: the step that makes it, the two guards, the log
  // line, the carry step, the pin, the assigned look and — since Phase 14 WP5
  // — the prompt step it is handed to ([40]). Nothing else.
  const postCode = WP4_POST.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
  const authorityReads = (postCode.match(/\bauthority\b/g) ?? []).length;
  const wp4Reads =
    count(postCode, 'const authority = routeAuthority(') + count(postCode, 'if (authority) {') + count(postCode, 'if (authority.decision)') +
    count(postCode, 'describeRouteAuthority(authority, shop.id)') + count(postCode, 'carryAuthority(modelGeneration, authority)') +
    count(postCode, 'config.template_key = authority.template;') + count(postCode, 'legacyGeneration.layout, authority);');
  const wp5Reads = count(postCode, 'alignPromptToAuthority({ cachedSystem, prompt, layoutBoundsText }, authority, {');
  const accounted = wp4Reads + wp5Reads;
  check('POST: nothing but the WP4 steps, the pin and the WP5 prompt step reads the authority — not the closed-gate prompt statements, the expression write, the cleanup or the persist call (10 reads, all accounted for: 9 WP4, 1 WP5)',
    authorityReads === 10 && accounted === 10 && wp4Reads === 9 && wp5Reads === 1 && count(postCode, 'if (authority) {') === 2 && count(postCode, 'describeRouteAuthority(authority, shop.id)') === 2, { authorityReads, accounted, wp4Reads, wp5Reads });
}

if (!ROUTE_STEPS) {
  check('sections [34]–[37] need the lifted WP4 steps — NOT RUN', false, wp4LiftError);
} else {
  const R = ROUTE_STEPS;

  console.log('\n[34] Phase 14 WP4 — single origin: the route consumes Assignment and the carrier output (gate open)');
  {
    const outcomes = WP4_MERCHANTS.map(([, m]) => {
      const d = decisionOf(routeFacts(m, WP4_PATHS[0], undefined, true).assignment);
      return `${d.architecture}/${d.family}/${d.architecture !== 'classic' || d.family === 'subtraction' ? d.template : '*'}`;
    });
    check('fixtures: one merchant per outcome (Counter, Gallery, Subtraction, three Classic families)', outcomes.join() === WP4_MERCHANTS.map(([, , want]) => want).join(), outcomes);
    check(`fixtures: ${WP4_PATHS.length} request paths × ${MODEL_GENERATIONS.length} model generations`, WP4_PATHS.length === 9 && MODEL_GENERATIONS.length === 111);

    const sampled = wp2Merchants().filter((_, i) => i % 577 === 0);
    const merchants: Merchant[] = [...WP4_MERCHANTS.map(([, m]) => m), ...sampled];
    let cases = 0;
    let usable = true;
    let templateOk = true;
    let familyOk = true;
    let gridOk = true;
    let carrierOk = true;
    let restOk = true;
    let carriersOk = true;
    let resolverOk = true;
    let valid = true;
    let modelDiffered = 0;
    let recomposed = 0;
    let offender: unknown;
    const note = (what: string, detail: unknown): void => { offender = offender ?? { what, detail }; };
    merchants.forEach((m, mi) => {
      WP4_NICHES.forEach((bodyNiche, ni) => {
        WP4_PATHS.forEach((p, pi) => {
          const facts = routeFacts(m, p, bodyNiche, true);
          const d = decisionOf(facts.assignment);
          // A rotating window of model generations, so the whole 111 are walked across the matrix.
          for (let k = 0; k < 7; k += 1) {
            const model = MODEL_GENERATIONS[(mi * 31 + ni * 17 + pi * 13 + k * 16) % MODEL_GENERATIONS.length];
            const run4 = routeTail(R, facts, p, model, true);
            cases += 1;
            const where = { merchant: mi, bodyNiche, path: p.name, model: `${model.template_key}/${JSON.stringify(model.layout?.storefront_family)}/${JSON.stringify(model.layout?.layout_strategy?.grid)}` };
            if (!run4.authority || run4.authority.decision !== facts.assignment || run4.authority.floor !== null) { usable = false; note('authority', where); continue; }
            if (model.template_key !== d.template) modelDiffered += 1;
            if (run4.recomposed) recomposed += 1;
            // template_key = Assignment — on the carried generation and on the final config.
            if (run4.authority.template !== d.template || run4.legacyGeneration.template_key !== d.template || run4.config.template_key !== d.template) { templateOk = false; note('template', { ...where, got: run4.config.template_key, want: d.template }); }
            // storefront_family = Assignment — carried and final.
            if (run4.legacyGeneration.layout?.storefront_family !== d.family || run4.config.storefront_family !== d.family) { familyOk = false; note('family', { ...where, got: run4.config.storefront_family, want: d.family }); }
            // layout_strategy.grid = Assignment — the recipe grid handed to the carriers is the decision's;
            // on the config it is whatever the generation guard lets through of THAT grid, never the model's.
            const owned = assignedRecipeGrid(d);
            const afterGuard = guardRecipeGridPick(owned ?? undefined, d.template);
            if (recipeOf(run4.legacyGeneration.layout?.layout_strategy?.grid) !== (owned ?? 'none') || recipeOf(run4.config.layout_strategy?.grid) !== recipeOf(afterGuard)) { gridOk = false; note('grid', { ...where, carried: run4.legacyGeneration.layout?.layout_strategy?.grid, config: run4.config.layout_strategy?.grid, owned }); }
            // The carried layout IS the WP3 carrier's output for this decision.
            if (JSON.stringify(run4.legacyGeneration.layout) !== JSON.stringify(carryStorefrontDecision(model.layout, d, { gateOpen: true }))) { carrierOk = false; note('carrier output', where); }
            // Everything else on the generation is the model's own — the same objects.
            if (run4.legacyGeneration === model || run4.legacyGeneration.hero !== model.hero || run4.legacyGeneration.story !== model.story || run4.legacyGeneration.split_cta !== model.split_cta || run4.legacyGeneration.niche_reasoning !== model.niche_reasoning) { restOk = false; note('generation copy', where); }
            // The config is what the EXISTING carriers build from that carried generation.
            const carriedGen = { ...model, template_key: d.template, layout: carryStorefrontDecision(model.layout, d, { gateOpen: true }) ?? undefined };
            const base = generationToConfig(carriedGen);
            let expected: WebsiteConfig;
            if (p.archetype && p.archetype.template_key !== d.template) {
              const look = composeVisualSystem(p.archetype, d.template);
              expected = applyGenerationLayout(Object.keys(look.theme).length > 0 ? { ...base, theme: look.theme } : base, carriedGen.layout, look.bounds);
              if (!run4.recomposed) { carriersOk = false; note('not recomposed', where); }
            } else if (p.archetype) {
              expected = applyArchetype(base, p.archetype, carriedGen, null);
              if (run4.recomposed) { carriersOk = false; note('recomposed on its own template', where); }
            } else {
              expected = applyGenerationLayout(base, carriedGen.layout, classicLayoutBounds(d.template));
              if (run4.recomposed) { carriersOk = false; note('recomposed without an archetype', where); }
            }
            if (JSON.stringify(run4.assembled) !== JSON.stringify(expected)) { carriersOk = false; note('carriers', where); }
            // What the resolver will be asked for is the decision's, as far as the guard allows.
            const wantRecipe = d.family === 'subtraction' ? 'subtraction' : afterGuard === 'counter' ? 'product-first' : afterGuard === 'gallery' ? 'gallery-led' : 'classic';
            if (resolveRitualRecipe(run4.config) !== wantRecipe) { resolverOk = false; note('resolver', { ...where, got: resolveRitualRecipe(run4.config), want: wantRecipe }); }
            if (!WebsiteConfigSchema.safeParse(run4.config).success) { valid = false; note('schema', where); }
          }
        });
      });
    });
    check(`the route's authority is the engine's own decision object, unfloored (${cases} builds: ${merchants.length} merchants × ${WP4_NICHES.length} niches × ${WP4_PATHS.length} paths × 7 model generations)`, usable && cases === merchants.length * WP4_NICHES.length * WP4_PATHS.length * 7, offender);
    check(`template_key = Assignment: the carried generation and the final config carry the decision's template (the model named a different one in ${modelDiffered} builds)`, templateOk && modelDiffered > 500, offender);
    check('storefront_family = Assignment: the carried layout and the final config carry the decision\'s family', familyOk, offender);
    check('layout_strategy.grid = Assignment: the recipe grid handed to the carriers is the decision\'s, and the config never holds a recipe grid the decision does not own', gridOk, offender);
    check('the route consumes the carrier output: the layout the existing carriers read is carryStorefrontDecision\'s, exactly', carrierOk, offender);
    check('the carried generation is a copy — every non-authority field is the model\'s own object, and the model\'s generation is never written to', restOk, offender);
    check(`the config is what the existing carriers build from the carried generation — applyArchetype on the archetype's own template, the visual-system composition on a changed one (${recomposed} builds), the layout carrier with no archetype`, carriersOk && recomposed > 100, offender);
    check('the recipe the resolver will be asked for is the decision\'s (as far as the generation guard lets a grid through)', resolverOk, offender);
    check('every build validates strictly', valid, offender);

    // Named cases: what Assignment changes, and what it leaves alone.
    const general = (name: string, pathName: string) => {
      const m = WP4_MERCHANTS.find(([n]) => n === name)![1];
      const p = WP4_PATHS.find((x) => x.name === pathName)!;
      const facts = routeFacts(m, p, 'general', true);
      return { d: decisionOf(facts.assignment), p, build: (model: WebsiteGeneration) => routeTail(R, facts, p, model, true) };
    };
    const editorialModel: WebsiteGeneration = { ...GENERATION, template_key: 'editorial', layout: modelLayout('lifestyle-story', 'gallery') };
    const counterUnderEditorial = general('counter', 'studio/warm-editorial');
    const cue = counterUnderEditorial.build(editorialModel);
    check('Counter merchant, Warm Editorial archetype, model says editorial / lifestyle-story / gallery → Ritual, product-first, Counter grid carried; the archetype\'s look is recomposed and its own paper survives',
      cue.config.template_key === 'ritual' && cue.config.storefront_family === 'product-first' && cue.legacyGeneration.layout?.layout_strategy?.grid === 'counter' && cue.recomposed &&
      cue.config.theme?.background === ARCHETYPES['warm-editorial'].theme.background && counterUnderEditorial.d.sellerTemplate?.honoured === false, cue.config.theme);
    const classicUnderStreet = general('classic story', 'studio/high-contrast-street');
    const cus = classicUnderStreet.build({ ...GENERATION, template_key: 'ritual', layout: modelLayout('subtraction', 'counter') });
    check('Classic merchant, High-Contrast Street archetype, model says ritual / subtraction / counter → the seller\'s Vitality template stands, lifestyle-story, no recipe, archetype bundle applied as before',
      cus.config.template_key === 'vitality' && cus.config.storefront_family === 'lifestyle-story' && recipeOf(cus.config.layout_strategy?.grid) === 'none' && !cus.recomposed && resolveRitualRecipe(cus.config) === 'classic' &&
      JSON.stringify(cus.config.theme) === JSON.stringify(applyArchetype(generationToConfig(cus.legacyGeneration), ARCHETYPES['high-contrast-street'], cus.legacyGeneration, null).theme));
    const subtractionOnboarding = general('subtraction', 'onboarding');
    const so = subtractionOnboarding.build({ ...GENERATION, template_key: 'vitality', layout: undefined });
    check('Subtraction merchant, Onboarding, model says vitality and returns NO layout → Ritual, Subtraction, hero and wall only',
      so.config.template_key === 'ritual' && so.config.storefront_family === 'subtraction' && (so.config.blocks ?? []).filter((b) => !b.hidden).map((b) => b.type).join() === 'hero_banner,product_grid' && resolveRitualRecipe(so.config) === 'subtraction', so.config.blocks?.map((b) => `${b.type}${b.hidden ? '(hidden)' : ''}`));
    const galleryOverride = general('gallery', 'override/vitality');
    const go = galleryOverride.build({ ...GENERATION, template_key: 'vitality', layout: modelLayout('product-first', 'counter') });
    check('Gallery merchant, seller override "vitality", model says vitality / product-first / counter → Ritual, lifestyle-story, Gallery grid carried (the override is recorded as not honoured)',
      go.config.template_key === 'ritual' && go.config.storefront_family === 'lifestyle-story' && go.legacyGeneration.layout?.layout_strategy?.grid === 'gallery' && galleryOverride.d.sellerTemplate?.honoured === false);
    const classicOnboarding = general('classic story', 'onboarding');
    const templates = TEMPLATE_KEYS.map((t) => classicOnboarding.build({ ...GENERATION, template_key: t, layout: modelLayout(undefined, undefined) }).config.template_key);
    check('Classic merchant, Onboarding: the template is the engine\'s category mapping whichever of the three the model names',
      new Set(templates).size === 1 && templates[0] === classicOnboarding.d.template && classicOnboarding.d.sellerTemplate === null, templates);

    const line = R.describeRouteAuthority({ decision: counterUnderEditorial.d, template: counterUnderEditorial.d.template, floor: null }, 'shop-1');
    check('the open-gate log line is composed from the authority alone', line === '[generate-website] Assignment authority for shop shop-1: architecture=counter template=ritual family=product-first grid=counter', line);
  }

  console.log('\n[35] Phase 14 WP4 — the Classic floor: missing, invalid, throwing (gate open)');
  {
    const counterD = WP3_DECISIONS[0][1];
    const galleryD = WP3_DECISIONS[1][1];
    const subtractionD = WP3_DECISIONS[2][1];
    const classicD = WP3_DECISIONS[3][1];
    check('fixtures: the three decisions a floor must never let through, and a plain Classic one', counterD.architecture === 'counter' && galleryD.architecture === 'gallery' && subtractionD.family === 'subtraction' && classicD.architecture === 'classic' && classicD.family === 'lifestyle-story');
    const engineThrows = (): ArchitectureAssignment => assignArchitecture(null as unknown as ArchitectureAssignmentInput, { gateOpen: true });
    let threw = false;
    try { engineThrows(); } catch { threw = true; }
    check('fixtures: the engine really throws on an input it cannot read', threw);
    const hostile = new Proxy({}, { get() { throw new Error('unreadable decision'); } }) as unknown as ArchitectureAssignment;
    const bad = (value: unknown): ArchitectureAssignment => value as ArchitectureAssignment;

    type FloorCase = [string, ArchitectureAssignment | null | undefined, 'missing' | 'invalid' | 'unreadable'];
    const floorCases: FloorCase[] = [
      ['missing: null', null, 'missing'],
      ['missing: undefined', undefined, 'missing'],
      ['throwing: the engine threw, so the block carried nothing out', obtainedAfter(engineThrows), 'missing'],
      ['throwing: reading the decision throws', hostile, 'unreadable'],
      ['invalid: a closed-gate object (no family) while the gate is open', closed({ niche: 'tech', products: photographed(20, 20, ['Phones', 'Laptops', 'Audio']), heroMedia: banner }), 'invalid'],
      ['invalid: a family that is not a family', bad({ ...counterD, family: 'not-a-family' }), 'invalid'],
      ['invalid: family removed', bad({ ...subtractionD, family: undefined }), 'invalid'],
      ['invalid: an architecture that is not an architecture', bad({ ...galleryD, architecture: 'bazaar' }), 'invalid'],
      ['invalid: a template that is not a template', bad({ ...counterD, template: 'brutalist' }), 'invalid'],
      ['invalid: template removed', bad({ ...galleryD, template: undefined }), 'invalid'],
      // On a CLASSIC decision the Ritual-only rule does not apply, so only the
      // template check stands between a junk template and the pin.
      ['invalid: a Classic decision whose template is not a template', bad({ ...classicD, template: 'brutalist' }), 'invalid'],
      ['invalid: a Classic decision with its template removed', bad({ ...classicD, template: undefined }), 'invalid'],
      ['invalid: a Classic decision whose family is not a family', bad({ ...classicD, family: 'boutique' }), 'invalid'],
      ['invalid: Counter on a template that cannot render it', bad({ ...counterD, template: 'editorial' }), 'invalid'],
      ['invalid: Gallery on a template that cannot render it', bad({ ...galleryD, template: 'vitality' }), 'invalid'],
      ['invalid: Subtraction on a template that cannot render it', bad({ ...subtractionD, template: 'editorial' }), 'invalid'],
      // Incoherent pairs: every field a known value, on Ritual, but the pair
      // breaks the StorefrontDecision contract (Subtraction is always Classic).
      ['invalid: incoherent pair — Subtraction with a Counter architecture', bad({ ...subtractionD, architecture: 'counter' }), 'invalid'],
      ['invalid: incoherent pair — Subtraction with a Gallery architecture', bad({ ...subtractionD, architecture: 'gallery' }), 'invalid'],
      ['invalid: incoherent pair — a Counter decision relabelled Subtraction', bad({ ...counterD, family: 'subtraction' }), 'invalid'],
      ['invalid: incoherent pair — a Gallery decision relabelled Subtraction', bad({ ...galleryD, family: 'subtraction' }), 'invalid'],
      ['invalid: a string', bad('counter'), 'invalid'],
      ['invalid: a number', bad(1), 'invalid'],
      ['invalid: an array', bad([counterD]), 'invalid'],
      ['invalid: a function', bad(() => counterD), 'invalid'],
    ];
    check('fixtures: the throwing engine leaves the route holding no decision', obtainedAfter(engineThrows) === null && obtainedAfter(() => counterD) === counterD);

    // The model pushes as hard as it can, on every template: no layout at
    // all, Subtraction, both recipe grids, a rhythm family, junk.
    const pushes: Array<[unknown, unknown]> = [['subtraction', 'counter'], ['subtraction', 'gallery'], ['subtraction', 'masonry'], ['product-first', 'counter'], [undefined, 'gallery'], ['not-a-family', 'counter'], ['menu-occasion', undefined]];
    const pushy: WebsiteGeneration[] = TEMPLATE_KEYS.flatMap((template_key): WebsiteGeneration[] => [
      { ...GENERATION, template_key, layout: undefined },
      ...pushes.map(([family, grid]) => ({ ...GENERATION, template_key, layout: modelLayout(family, grid) })),
    ]);
    const counterMerchant = WP4_MERCHANTS[0][1];
    const subtractionMerchant = WP4_MERCHANTS[2][1];
    for (const [name, obtained, kind] of floorCases) {
      let never = true;
      let reason = true;
      let classicOk = true;
      let templateOk = true;
      let cases = 0;
      let offender: unknown;
      let threwHere: string | null = null;
      try {
        for (const m of [counterMerchant, subtractionMerchant]) {
          for (const p of WP4_PATHS) {
            const facts = routeFacts(m, p, 'general', true);
            const floorTemplate = p.chosenTemplate ?? facts.heuristicTemplate;
            const seen = new Set<string>();
            for (const model of pushy) {
              const run4 = routeTail(R, facts, p, model, true, { obtained });
              cases += 1;
              const where = { path: p.name, model: `${model.template_key}/${JSON.stringify(model.layout?.storefront_family)}/${JSON.stringify(model.layout?.layout_strategy?.grid)}` };
              if (!run4.authority || run4.authority.decision !== null) { never = false; offender = offender ?? where; continue; }
              if (run4.authority.floor !== kind) { reason = false; offender = offender ?? { ...where, floor: run4.authority.floor }; }
              // Classic · no recipe family · no recipe grid — carried and final.
              const c = run4.config;
              if (
                c.storefront_family !== DEFAULT_STOREFRONT_FAMILY || run4.legacyGeneration.layout?.storefront_family !== DEFAULT_STOREFRONT_FAMILY ||
                isRecipeGrid(c.layout_strategy?.grid) || isRecipeGrid(run4.legacyGeneration.layout?.layout_strategy?.grid) ||
                c.layout_strategy?.expression !== undefined || resolveRitualRecipe(c) !== 'classic' ||
                (c.blocks ?? []).some((b) => b.type === 'product_grid' && b.hidden) || !WebsiteConfigSchema.safeParse(c).success
              ) { classicOk = false; offender = offender ?? { ...where, family: c.storefront_family, grid: c.layout_strategy?.grid }; }
              // The template is the seller's, else the category heuristic — never the model's.
              if (c.template_key !== floorTemplate || run4.authority.template !== floorTemplate) { templateOk = false; offender = offender ?? { ...where, got: c.template_key, want: floorTemplate }; }
              seen.add(`${c.template_key}|${c.storefront_family}|${recipeOf(c.layout_strategy?.grid)}`);
            }
            if (seen.size !== 1) { classicOk = false; offender = offender ?? { path: p.name, seen: [...seen] }; }
          }
        }
      } catch (error) {
        threwHere = String(error);
      }
      check(`${name} → Classic, the default family, no recipe grid, no Subtraction; template the seller's or the heuristic's, never the model's (${cases} builds)`,
        threwHere === null && cases === 2 * WP4_PATHS.length * pushy.length && never && reason && classicOk && templateOk, threwHere ?? offender);
    }

    // The same merchants WITH their decision: the floor is the difference.
    const withDecision = routeTail(R, routeFacts(subtractionMerchant, WP4_PATHS[0], 'general', true), WP4_PATHS[0], pushy[0], true);
    check('contrast: with its decision the Subtraction merchant IS Subtraction on Ritual — the floor above is not the route\'s normal answer', withDecision.config.storefront_family === 'subtraction' && withDecision.config.template_key === 'ritual');
    // Assignment's own floor (WP1) is a usable decision, and it is Classic too.
    const engineFloor = assignArchitectureOrFloor(null as unknown as ArchitectureAssignmentInput, { gateOpen: true });
    const viaEngineFloor = routeTail(R, routeFacts(counterMerchant, WP4_PATHS[0], 'general', true), WP4_PATHS[0], { ...GENERATION, template_key: 'ritual', layout: modelLayout('subtraction', 'counter') }, true, { obtained: engineFloor });
    check('the engine\'s own floor decision (WP1) is accepted as a decision and is Classic as well',
      viaEngineFloor.authority?.decision === engineFloor && viaEngineFloor.config.storefront_family === DEFAULT_STOREFRONT_FAMILY && recipeOf(viaEngineFloor.config.layout_strategy?.grid) === 'none' && resolveRitualRecipe(viaEngineFloor.config) === 'classic');
    const floorLine = R.describeRouteAuthority({ decision: null, template: 'editorial', floor: 'missing' }, 'shop-1');
    check('the floor is logged as the floor, with its cause', floorLine === '[generate-website] Assignment authority for shop shop-1: CLASSIC FLOOR (decision missing) template=editorial family=lifestyle-story grid=none', floorLine);
    check('POST: a floored build is logged at warn level, a decided one at log level', /if \(authority\) \{\s*if \(authority\.decision\) console\.log\(describeRouteAuthority\(authority, shop\.id\)\);\s*else console\.warn\(describeRouteAuthority\(authority, shop\.id\)\);\s*\}/.test(WP4_POST));
    let neverThrows = true;
    for (const [, obtained] of floorCases) {
      for (const gateOpen of [true, false]) {
        try { R.routeAuthority(gateOpen, obtained, 'ritual'); } catch { neverThrows = false; }
      }
    }
    check('the authority step never throws, whatever it is handed, in either gate state', neverThrows);

    // ── Late-throwing decision fields. A decision whose family, architecture
    // or template reads fine `after` times and throws from then on. The
    // authority step reads each of the three ONCE (family twice — the type
    // guard reads it first) inside its try, so:
    //   · a field that fails during those reads → the Classic floor;
    //   · the template failing AFTER them → harmless: the pin uses the value
    //     the step already validated, never a second read of the object;
    //   · family or architecture failing after them → the WP3 carrier's own
    //     read throws and the request fails before any config exists. Loud,
    //     never a leak — and unreachable: the engine returns plain data.
    const lateThrow = (base: StorefrontDecision, field: 'family' | 'architecture' | 'template', after: number): ArchitectureAssignment => {
      let reads = 0;
      const copy = { ...base } as Record<string, unknown>;
      Object.defineProperty(copy, field, {
        enumerable: true,
        get() {
          reads += 1;
          if (reads > after) throw new Error(`late ${field}`);
          return base[field];
        },
      });
      return copy as unknown as ArchitectureAssignment;
    };
    const lateFacts = routeFacts(counterMerchant, WP4_PATHS[0], 'general', true);
    const lateModel: WebsiteGeneration = { ...GENERATION, template_key: 'vitality', layout: modelLayout('subtraction', 'gallery') };
    const fields = ['family', 'architecture', 'template'] as const;
    let stepNeverThrows = true;
    let immediateFloors = true;
    let neverLeaks = true;
    let lateCases = 0;
    const outcomes: Record<string, number> = { floored: 0, followed: 0, failed: 0 };
    let lateOffender: unknown;
    for (const base of [counterD, galleryD, subtractionD, classicD]) {
      for (const field of fields) {
        for (const after of [0, 1, 2, 3, 5, 8]) {
          lateCases += 1;
          let stepAuthority: RouteAuthority | null = null;
          try { stepAuthority = R.routeAuthority(true, lateThrow(base, field, after), 'editorial'); } catch { stepNeverThrows = false; }
          if (after === 0 && (stepAuthority?.decision !== null || stepAuthority?.floor !== 'unreadable' || stepAuthority?.template !== 'editorial')) { immediateFloors = false; lateOffender = lateOffender ?? { field, after, stepAuthority }; }
          try {
            const run4 = routeTail(R, lateFacts, WP4_PATHS[0], lateModel, true, { obtained: lateThrow(base, field, after) });
            const c = run4.config;
            const followed = run4.authority?.decision !== null;
            if (followed) {
              outcomes.followed += 1;
              // Followed means followed EXACTLY: the three keys are the decision's, never the model's.
              if (c.template_key !== base.template || c.storefront_family !== base.family || recipeOf(run4.legacyGeneration.layout?.layout_strategy?.grid) !== (assignedRecipeGrid(base) ?? 'none')) { neverLeaks = false; lateOffender = lateOffender ?? { field, after, got: `${c.template_key}/${c.storefront_family}` }; }
            } else {
              outcomes.floored += 1;
              if (c.template_key !== lateFacts.heuristicTemplate || c.storefront_family !== DEFAULT_STOREFRONT_FAMILY || isRecipeGrid(c.layout_strategy?.grid) || isRecipeGrid(run4.legacyGeneration.layout?.layout_strategy?.grid) || resolveRitualRecipe(c) !== 'classic') { neverLeaks = false; lateOffender = lateOffender ?? { field, after, got: `${c.template_key}/${c.storefront_family}` }; }
            }
          } catch {
            // No config was produced — nothing can be persisted.
            outcomes.failed += 1;
          }
        }
      }
    }
    check(`late-throwing fields: the authority step itself never throws (${lateCases} decisions: 4 outcomes × 3 fields × 6 read counts)`, stepNeverThrows && lateCases === 72);
    check('late-throwing fields: a field that cannot be read at all → the Classic floor ("unreadable"), on the floor template', immediateFloors, lateOffender);
    check(`late-throwing fields: every build is the Classic floor, the decision followed exactly, or no config at all — never the model's template, family or grid (${outcomes.floored} floored, ${outcomes.followed} followed, ${outcomes.failed} failed loudly)`,
      neverLeaks && outcomes.floored > 0 && outcomes.followed > 0 && outcomes.floored + outcomes.followed + outcomes.failed === lateCases, lateOffender ?? outcomes);
    // The template specifically: once validated it is never read from the object again.
    let templateReadOnce = true;
    for (const base of [counterD, galleryD, subtractionD, classicD]) {
      const run4 = routeTail(R, lateFacts, WP4_PATHS[0], lateModel, true, { obtained: lateThrow(base, 'template', 1) });
      if (run4.authority?.decision === null || run4.authority?.template !== base.template || run4.config.template_key !== base.template) templateReadOnce = false;
    }
    check('late-throwing template: a template that can be read once and never again still pins the validated value — the route does not re-read it', templateReadOnce);
  }

  console.log('\n[36] Phase 14 WP4 — no authority leakage: the model\'s template, family and grid do not decide (gate open)');
  {
    let cases = 0;
    let stable = true;
    let owned = true;
    let offender: unknown;
    let modelTemplateIgnored = 0;
    let modelFamilyIgnored = 0;
    let modelGridIgnored = 0;
    for (const [name, m] of WP4_MERCHANTS) {
      for (const p of WP4_PATHS) {
        const facts = routeFacts(m, p, 'general', true);
        const d = decisionOf(facts.assignment);
        const ownedGrid = assignedRecipeGrid(d) ?? 'none';
        const seen = new Set<string>();
        for (const model of MODEL_GENERATIONS) {
          const run4 = routeTail(R, facts, p, model, true);
          cases += 1;
          const c = run4.config;
          const carriedGrid = recipeOf(run4.legacyGeneration.layout?.layout_strategy?.grid);
          seen.add(`${c.template_key}|${c.storefront_family}|${carriedGrid}|${recipeOf(c.layout_strategy?.grid)}|${resolveRitualRecipe(c)}|${c.layout_strategy?.expression ?? 'none'}`);
          if (c.template_key !== d.template || c.storefront_family !== d.family || carriedGrid !== ownedGrid) { owned = false; offender = offender ?? { name, path: p.name, model: model.template_key, layout: model.layout }; }
          if (model.template_key !== d.template) modelTemplateIgnored += 1;
          if (model.layout?.storefront_family !== d.family) modelFamilyIgnored += 1;
          if (recipeOf(model.layout?.layout_strategy?.grid) !== ownedGrid) modelGridIgnored += 1;
        }
        if (seen.size !== 1) { stable = false; offender = offender ?? { name, path: p.name, seen: [...seen] }; }
      }
    }
    check(`one merchant on one path gets ONE template, family, recipe grid, resolver request and expression across all ${MODEL_GENERATIONS.length} model generations (${cases} builds)`, stable && cases === WP4_MERCHANTS.length * WP4_PATHS.length * MODEL_GENERATIONS.length, offender);
    check(`model template ignored: the config's template is the decision's in every build, including the ${modelTemplateIgnored} where the model named another`, owned && modelTemplateIgnored > 1000, offender);
    check(`model family ignored: the config's family is the decision's in every build, including the ${modelFamilyIgnored} where the model named another, none, or junk`, owned && modelFamilyIgnored > 1000, offender);
    check(`model grid ignored: the recipe grid the carriers read is the decision's in every build, including the ${modelGridIgnored} where the model named a different recipe grid or none`, owned && modelGridIgnored > 1000, offender);

    // What the model still owns: presentation. It must keep it. (A Classic
    // merchant whose seller chose Ritual — a template that renders every lever.)
    const ritualPath = WP4_PATHS.find((p) => p.name === 'override/ritual')!;
    const facts = routeFacts(WP4_MERCHANTS[3][1], ritualPath, 'general', true);
    const masonry = routeTail(R, facts, ritualPath, { ...GENERATION, template_key: 'editorial', layout: modelLayout('subtraction', 'masonry') }, true).config;
    const standard = routeTail(R, facts, ritualPath, { ...GENERATION, template_key: 'editorial', layout: modelLayout('subtraction', 'standard') }, true).config;
    check('the model keeps what is not authority: its presentation grid, hero variant, section order and display mode still arrive',
      masonry.template_key === 'ritual' && masonry.storefront_family === 'lifestyle-story' &&
      masonry.layout_strategy?.grid === 'masonry' && standard.layout_strategy?.grid === 'standard' && masonry.layout_strategy?.hero === 'split' &&
      masonry.blocks?.map((b) => b.type).join() === 'hero_banner,product_grid,value_props,story_text,cta_banner' && masonry.blocks?.find((b) => b.type === 'product_grid')?.displayMode === 'carousel', masonry.layout_strategy);

    // The seller's theme does not decide either (the route-level form of [30]).
    for (const [name, m, want] of WP4_MERCHANTS.slice(0, 3)) {
      const builds = WP4_PATHS.map((p, k) => {
        const f = routeFacts(m, p, 'general', true);
        const c = routeTail(R, f, p, MODEL_GENERATIONS[(k * 29 + 5) % MODEL_GENERATIONS.length], true).config;
        return `${decisionOf(f.assignment).architecture}/${c.storefront_family}/${c.template_key}`;
      });
      check(`${name} merchant: the same architecture, family and template on all ${WP4_PATHS.length} request paths — Onboarding, every archetype, a concept, a manual override`, new Set(builds).size === 1 && builds[0] === want, builds);
    }
  }

  console.log('\n[37] Phase 14 WP4 — gate matrix, CLOSED: the route is the pre-WP4 route');
  {
    check('the generation gate constant is still false — production runs the closed path', RITUAL_RECIPE_GENERATION_ENABLED === false);
    const decisions: Array<ArchitectureAssignment | null | undefined> = [null, undefined, ...WP3_DECISIONS.map(([, d]) => d), closed({ niche: 'tech', products: photographed(20, 20, ['Phones', 'Laptops', 'Audio']), heroMedia: banner })];
    check('closed: the authority step returns null whatever it is handed — an open-gate decision included',
      decisions.every((d) => TEMPLATE_KEYS.every((t) => R.routeAuthority(false, d, t) === null)) && R.routeAuthority(RITUAL_RECIPE_GENERATION_ENABLED, WP3_DECISIONS[0][1], 'ritual') === null);
    check('closed: with no authority the carry step returns the SAME generation object, for every model generation', MODEL_GENERATIONS.every((g) => R.carryAuthority(g, null) === g));
    check('closed: with no authority there is no assigned look, for every archetype and template',
      ARCHETYPE_KEYS.every((key) => TEMPLATE_KEYS.every((t) => R.applyAssignedLook(generationToConfig({ ...GENERATION, template_key: t }), ARCHETYPES[key], modelLayout('subtraction', 'counter'), null) === null)));

    let cases = 0;
    let identical = true;
    let sameReference = true;
    let noAuthority = true;
    let offender: unknown;
    // Frozen copies: a write to the model's generation anywhere in the tail throws.
    const frozenModels = MODEL_GENERATIONS.map((model) => deepFreeze(JSON.parse(JSON.stringify(model)) as WebsiteGeneration));
    // The closed tail reads the merchant only through the (inert) expression
    // signals, so a handful of merchants is the whole space; the paths and the
    // model generations are walked in full.
    const closedNiches: unknown[] = [undefined, 'jewelry'];
    const merchants: Merchant[] = [...WP4_MERCHANTS.slice(0, 4).map(([, m]) => m), wp2Merchants()[2311]];
    for (const m of merchants) {
      for (const bodyNiche of closedNiches) {
        for (const p of WP4_PATHS) {
          const facts = routeFacts(m, p, bodyNiche, false);
          for (let k = 0; k < frozenModels.length; k += 1) {
            const model = MODEL_GENERATIONS[k];
            const frozen = frozenModels[k];
            const now = routeTail(R, facts, p, frozen, false);
            const was = preWp4Tail(facts, p, frozen);
            cases += 1;
            if (now.authority !== null || now.recomposed) noAuthority = false;
            if (now.legacyGeneration !== frozen) sameReference = false;
            if (JSON.stringify(now.config) !== JSON.stringify(was)) { identical = false; offender = offender ?? { path: p.name, bodyNiche, model: model.template_key, layout: model.layout }; }
          }
        }
      }
    }
    // NOTE: both sides of this comparison are script-side tails (the lifted
    // steps inside the mirror vs the same mirror without them). It proves the
    // STEPS are inert under a null authority; that the real POST is that
    // mirror and nothing more is section [39]'s proof, not this one's.
    check(`closed: with the lifted steps in place the tail's config is byte-identical to the same tail without them (${cases} builds: ${merchants.length} merchants × ${closedNiches.length} niches × ${WP4_PATHS.length} paths × ${MODEL_GENERATIONS.length} model generations)`, identical && cases === merchants.length * closedNiches.length * WP4_PATHS.length * MODEL_GENERATIONS.length, offender);
    check('closed: the carriers are handed the model\'s own generation object — the same reference — and it is never written to', sameReference);
    check('closed: no authority exists and nothing is recomposed, in any build', noAuthority);
    // The closed route still lets the model decide — that is today's behaviour, preserved.
    const onboarding = routeFacts(WP4_MERCHANTS[0][1], WP4_PATHS[0], undefined, false);
    const modelWins = routeTail(R, onboarding, WP4_PATHS[0], { ...GENERATION, template_key: 'editorial', layout: modelLayout('menu-occasion', 'masonry') }, false).config;
    check('closed: Onboarding still takes the model\'s template and family (today\'s behaviour, untouched)', modelWins.template_key === 'editorial' && modelWins.storefront_family === 'menu-occasion' && modelWins.layout_strategy?.grid === 'masonry');

    // ── Source: logs, prompt and persistence.
    const count = (source: string, needle: string): number => source.split(needle).length - 1;
    const logCalls = (WP4_ROUTE_SOURCE.match(/console\.(log|warn|error|info|debug)\(/g) ?? []).length;
    check('logs: the route has the 20 pre-WP4 log statements plus exactly 3 new ones', logCalls === 23, logCalls);
    check('logs: all 3 new statements sit behind a non-null authority (never reached with the gate closed) — two in `if (authority) { … }`, one in `if (assignedLook) { … }`',
      /if \(authority\) \{\s*if \(authority\.decision\) console\.log\(describeRouteAuthority\(authority, shop\.id\)\);\s*else console\.warn\(describeRouteAuthority\(authority, shop\.id\)\);\s*\}/.test(WP4_POST) &&
      /if \(assignedLook\) \{\s*config = assignedLook;\s*console\.log\(`\[generate-website\] Archetype "\$\{archetype\?\.key\}" look carried under assigned template/.test(WP4_POST));
    check('logs: the assignment and expression log blocks are the same statements, still told the constant',
      /console\.log\(\s*formatArchitectureAssignment\(assignment, \{\s*shopId: shop\.id,\s*gateOpen: RITUAL_RECIPE_GENERATION_ENABLED,\s*\}\),\s*\);/.test(WP4_POST) &&
      /formatExpressionSelection\(expressionWrite, \{\s*shopId: shop\.id,\s*gateOpen: RITUAL_RECIPE_GENERATION_ENABLED,\s*assigned: assignedArchitecture,\s*\}\),/.test(WP4_POST));
    // Phase 14 WP5 re-point. The region between the authority step and the
    // model's answer now holds two things: the closed-gate prompt statements
    // (unchanged — everything up to the WP5 comment) and the WP5 prompt step.
    // The first still reads nothing of the authority or the decision; the
    // second is the ONLY reader, and under a null authority it returns the
    // object it was handed ([41] runs it; [39] hashes the statements).
    const promptStart = WP4_POST.indexOf('const archetypeDirection = archetype');
    const promptEnd = WP4_POST.indexOf('const { brand_tokens, matrix_theme, ...modelGeneration } = generation;');
    const stepStart = WP4_POST.indexOf('// ── Phase 14 WP5 (A6)');
    const promptRegion = WP4_POST.slice(promptStart, stepStart);
    const stepRegion = WP4_POST.slice(stepStart, promptEnd).replace(/\/\/[^\n]*/g, '');
    check('prompt: the closed-gate prompt statements — the cached block, the dynamic prompt and the layout bounds — read nothing of the authority or the decision; they are untouched',
      promptStart > 0 && stepStart > promptStart && promptEnd > stepStart && promptRegion.includes('const cachedSystem = `<system_context>') && promptRegion.includes('const layoutBoundsText = archetype') && promptRegion.includes('const prompt = `<seller_data>') &&
      !/\b(authority|obtainedAssignment|assignedLook|assignment|decision)\b/.test(promptRegion.replace(/\/\/[^\n]*/g, '')), promptRegion.replace(/\/\/[^\n]*/g, '').match(/\b(authority|obtainedAssignment|assignedLook|assignment|decision)\b/)?.[0]);
    check('prompt: between those statements and the model\'s answer the authority is read ONCE — by the WP5 prompt step — and the decision, the assignment object and the assigned look are not read at all',
      (stepRegion.match(/\bauthority\b/g) ?? []).length === 1 && count(stepRegion, 'alignPromptToAuthority({ cachedSystem, prompt, layoutBoundsText }, authority, {') === 1 &&
      !/\b(obtainedAssignment|assignedLook|assignment|decision)\b/.test(stepRegion), stepRegion.match(/\b(obtainedAssignment|assignedLook|assignment|decision)\b/)?.[0]);
    check('prompt: the template constraint and the layout bounds still read the seller\'s chosen template', count(promptRegion, 'chosenTemplate') >= 6 && promptRegion.includes('describeLayoutBounds(classicLayoutBounds(chosenTemplate))'));
    const rpcStart = WP4_POST.indexOf(".rpc('persist_matrix_website'");
    const rpc = WP4_POST.slice(rpcStart, WP4_POST.indexOf('});', rpcStart));
    check('persistence: the RPC call is untouched — it stores the config and its template, and nothing from the authority',
      rpcStart > 0 && /p_template_key: config\.template_key,/.test(rpc) && /p_config: config,/.test(rpc) && !/authority|assignment|decision/i.test(rpc), rpc.slice(0, 120));
    check('dry-run harness: still returns the model\'s raw generation and the config', /dryRun: true,[\s\S]{0,400}?generation,\s*config,/.test(WP4_POST));
  }
}

console.log('\n[38] Phase 14 WP4 — existing protections');
{
  const root = process.cwd();
  const read = (rel: string): string => {
    try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch { return ''; }
  };
  const walk = (rel: string, out: string[] = []): string[] => {
    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true }); } catch { return out; }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const child = `${rel}/${e.name}`;
      if (e.isDirectory()) walk(child, out);
      else if (/\.(ts|tsx|mts|js|jsx|mjs)$/.test(e.name)) out.push(child);
    }
    return out;
  };
  const ENGINE_FILE = 'lib/siteTemplates.ts';
  const WP4_NAMES = /\b(routeAuthority|carryAuthority|applyAssignedLook|describeRouteAuthority|RouteAuthority|obtainedAssignment)\b/;
  const others = [...walk('app'), ...walk('components'), ...walk('lib')].filter((f) => f !== WP4_ROUTE_FILE);
  const users = others.filter((f) => WP4_NAMES.test(read(f)));
  check(`WP4 lives in the generation route alone — no library, component, page or other route names a WP4 step (${others.length} files, the engine file included)`, others.length > 50 && others.includes(ENGINE_FILE) && users.length === 0, users);

  // Authority rules, parity rules and carrier rules: the route calls them, it does not restate them.
  check('route: no threshold, niche map or eligibility rule is restated in the WP4 block',
    WP4_BLOCK.length > 0 && !/ritualRecipeEligibility|SUBTRACTION_ASSIGNMENT_RULES|ARCHITECTURE_ASSIGNMENT_RULES|RITUAL_RECIPE_RULES|selectGalleryExhibits|minPictured|alignAssignmentInputs|assignArchitecture/.test(WP4_BLOCK));
  check('route: the generation guard and the resolver are not called by the WP4 block (no activation, no render change)',
    WP4_BLOCK.length > 0 && !/guardRecipeGridPick|resolveRitualRecipe|resolveRitualComposition|applyExpressionSelection|RITUAL_RECIPE_GENERATION_ENABLED/.test(WP4_BLOCK));
  const engine = read(ENGINE_FILE);
  check('engine file: the gate is still declared closed, in one place', engine.split('export const RITUAL_RECIPE_GENERATION_ENABLED = false;').length - 1 === 1 && !/RITUAL_RECIPE_GENERATION_ENABLED\s*=\s*true/.test(engine));

  // Gate state and the legacy rows, exactly as every earlier section left them.
  check('the generation gate constant is still false', RITUAL_RECIPE_GENERATION_ENABLED === false);
  check('guard still strips both recipe grids', guardRecipeGridPick('counter', 'ritual') === undefined && guardRecipeGridPick('gallery', 'ritual') === undefined);
  const legacy = { template_key: 'ritual' as const, storefront_family: 'lifestyle-story' as const, layout_strategy: { hero: 'split' as const, grid: 'masonry' as const } };
  check('a legacy ritual row still resolves classic with its raw hero and grid', resolveRitualRecipe(legacy) === 'classic' && JSON.stringify(resolveRitualComposition({ config: legacy, products: photographed(12, 12), heroMedia: banner })) === '{"requested":"classic","recipe":"classic","hero":"split","grid":"masonry","fallback":null,"expressionFallback":null}');
  check('a stored Subtraction row still resolves Subtraction, and a recipe grid off Ritual still resolves classic', resolveRitualRecipe({ template_key: 'ritual', storefront_family: 'subtraction' }) === 'subtraction' && resolveRitualRecipe({ template_key: 'editorial', layout_strategy: { grid: 'counter' } }) === 'classic');
  check('the closed-gate engine object keeps its seven keys', Object.keys(closed({ niche: 'jewelry', products: photographed(6, 6), heroMedia: null })).join(',') === CLOSED_KEYS);
}

console.log('\n[39] Phase 14 WP4 — POST identity: the route is the pre-WP4 route plus WP4\'s edits, and nothing else');
{
  // Sections [34]–[37] run a script-side mirror of POST's tail. This section
  // is what makes that sufficient: every WP4 edit is REVERSED on the real
  // route source, and what is left must be byte-identical to the pre-WP4
  // route (its sha256, line endings normalised). So no statement, comment,
  // log line, prompt character or RPC argument anywhere in the file differs
  // from the pre-WP4 route except the eight edits named here — there is no
  // room for an extra writer of template_key, storefront_family or
  // layout_strategy, an enclosing condition, or a changed closed-gate line.
  // A LATER package that edits the route on purpose must add its own reversal
  // here or re-record the hash — that is the point. Phase 14 WP5 (the prompt)
  // did the former: its four edits are reversed FIRST, then WP4's seven, and
  // the hash below is still the pre-WP4 route's — not re-recorded. So the
  // closed-gate prompt statements, the concepts step and everything else in
  // the file are the pre-WP4 text, character for character.
  const PRE_WP4_ROUTE_SHA256 = 'cdf064342533edc168b986317674c7576e5d288bb6f079628db4dcb4580e68d7';
  const PRE_WP4_ROUTE_LENGTH = 62881;
  // A WP5 comment group inside POST, in the same form as WP4's below.
  const C5 = String.raw`(?<=\n)[ \t]*//[^\n]*Phase 14 WP5 \(A6\)[^\n]*\n(?:[ \t]*//[^\n]*\n)*`;
  const wp5Reversals: Array<[string, RegExp, string]> = [
    ['the WP5 block above POST (header comment through the end marker)', /\/\/ ─+\n\/\/ Phase 14 WP5 — PROMPT ALIGNMENT \(A6\)[\s\S]*?\/\/ \[WP5:END\]\n\n/, ''],
    ['the prompt step', new RegExp(C5 + String.raw`    const executePrompt = alignPromptToAuthority\(\{ cachedSystem, prompt, layoutBoundsText \}, authority, \{\n(?:      [A-Za-z]+(?:: [A-Za-z_.]+)?,\n)+    \}\);\n\n`), ''],
    ['the model call reading the step\'s output', /(?<=\n)      prompt: executePrompt\.prompt,\n      cachedSystem: executePrompt\.cachedSystem,\n/, '      prompt,\n      cachedSystem,\n'],
    ['the dry-run harness reporting the bounds that were sent', /(?<=\n)        layout_bounds: executePrompt\.layoutBoundsText,\n/, '        layout_bounds: layoutBoundsText,\n'],
  ];
  const WP5_NAMES = /alignPromptToAuthority|assignedBuildBounds|executePrompt|ASSIGNED_[A-Z_]+|ExecutePrompt|AssignedPromptFacts|WP5/;
  let withoutWp5 = WP4_ROUTE_SOURCE;
  const wp5NotOnce: string[] = [];
  for (const [name, pattern, replacement] of wp5Reversals) {
    const hits = (withoutWp5.match(new RegExp(pattern.source, 'g')) ?? []).length;
    if (hits !== 1) wp5NotOnce.push(`${name} (${hits})`);
    withoutWp5 = withoutWp5.replace(pattern, () => replacement);
  }
  // A WP4 comment group inside POST: a line naming "Phase 14 WP4 (A3)" and
  // the comment lines that follow it, up to the statement it introduces.
  const C = String.raw`(?<=\n)[ \t]*//[^\n]*Phase 14 WP4 \(A3\)[^\n]*\n(?:[ \t]*//[^\n]*\n)*`;
  const reversals: Array<[string, RegExp, string]> = [
    ['the WP4 block above POST (header comment through the end marker)', /\/\/ ─+\n\/\/ Phase 14 WP4 — ROUTE INTEGRATION \(A3\)[\s\S]*?\/\/ \[WP4:END\]\n\n/, ''],
    ['the decision\'s carrier variable', new RegExp(C + String.raw`    let obtainedAssignment: ArchitectureAssignment \| null = null;\n`), ''],
    ['the decision carried out of the assignment block', /(?<=\n)      obtainedAssignment = assignment;\n/, ''],
    ['the authority step and its log line', new RegExp(C + String.raw`    const authority = routeAuthority\(\n      RITUAL_RECIPE_GENERATION_ENABLED,\n      obtainedAssignment,\n      chosenTemplate \?\? heuristicTemplate,\n    \);\n    if \(authority\) \{\n      if \(authority\.decision\) console\.log\(describeRouteAuthority\(authority, shop\.id\)\);\n      else console\.warn\(describeRouteAuthority\(authority, shop\.id\)\);\n    \}\n\n`), ''],
    ['the carry step (and the renamed destructuring binding)', new RegExp(String.raw`\.\.\.modelGeneration \} = generation;\n` + C + String.raw`    const legacyGeneration = carryAuthority\(modelGeneration, authority\);\n`), '...legacyGeneration } = generation;\n'],
    ['the WP4 template pin', new RegExp(C + String.raw`    if \(authority\) \{\n      config\.template_key = authority\.template;\n    \}\n`), ''],
    ['the assigned-look branch (and the `else` it put before `if (archetype)`)', new RegExp(C + String.raw`    const assignedLook = applyAssignedLook\(config, archetype, legacyGeneration\.layout, authority\);\n    if \(assignedLook\) \{\n      config = assignedLook;\n      console\.log\([^\n]*\);\n    \} else if \(archetype\) \{\n`), '    if (archetype) {\n'],
  ];
  const WP4_IMPORTS = ['ARCHITECTURES', 'DEFAULT_STOREFRONT_FAMILY', 'STOREFRONT_FAMILIES', 'SUBTRACTION_TEMPLATE_KEY', 'assignedRecipeGrid', 'carryStorefrontDecision', 'composeVisualSystem', 'isStorefrontDecision', 'type ArchitectureAssignment', 'type StorefrontDecision', 'type WebsiteConfig', 'type WebsiteGeneration', 'type WebsiteLayout'];

  let restored = withoutWp5;
  const notOnce: string[] = [];
  for (const [name, pattern, replacement] of reversals) {
    const hits = (restored.match(new RegExp(pattern.source, 'g')) ?? []).length;
    if (hits !== 1) notOnce.push(`${name} (${hits})`);
    // A function replacement, so `$` in the replacement text is never special.
    restored = restored.replace(pattern, () => replacement);
  }
  const importStart = restored.indexOf('import {\nMatrixWebsiteGenerationSchema,');
  const importEnd = restored.indexOf("} from '@/lib/siteTemplates';");
  let importList = importStart !== -1 && importEnd > importStart ? restored.slice(importStart, importEnd) : '';
  const importsNotOnce: string[] = [];
  for (const name of WP4_IMPORTS) {
    const line = `  ${name},\n`;
    if (importList.split(line).length - 1 !== 1) importsNotOnce.push(name);
    importList = importList.replace(line, () => '');
  }
  if (importList) restored = restored.slice(0, importStart) + importList + restored.slice(importEnd);
  const digest = crypto.createHash('sha256').update(restored, 'utf8').digest('hex');

  check(`each of WP5's ${wp5Reversals.length} edits is found in the route exactly once`, WP4_ROUTE_SOURCE.length > 0 && wp5NotOnce.length === 0, wp5NotOnce);
  check('the WP5 reversal really removes WP5: nothing of it is left once its edits are reversed, and WP5 added no name to the lib import', !WP5_NAMES.test(withoutWp5), withoutWp5.match(WP5_NAMES)?.[0]);
  // The two block reversals delete a header comment as well as the lifted
  // code. Only the code BETWEEN the markers is lifted, run and scanned, so the
  // span above each BEGIN marker must hold nothing but comment lines —
  // otherwise a module-level statement placed there would be hashed away
  // without any section ever running or reading it.
  const headerAbove = (pattern: RegExp, begin: string): string[] => {
    const matched = WP4_ROUTE_SOURCE.match(pattern)?.[0] ?? '';
    const at = matched.indexOf(begin);
    return at === -1 ? ['<begin marker not found>'] : matched.slice(0, at).split('\n').filter((line) => line !== '');
  };
  const headerLines = [...headerAbove(wp5Reversals[0][1], '// [WP5:BEGIN]'), ...headerAbove(reversals[0][1], '// [WP4:BEGIN]')];
  check('the header spans the two block reversals delete — everything above the WP5 and WP4 BEGIN markers — are comment lines only: no statement can sit where it is neither lifted nor hashed',
    headerLines.length > 20 && headerLines.every((line) => line.startsWith('//')), headerLines.filter((line) => !line.startsWith('//')).slice(0, 3));
  check(`each of WP4's ${reversals.length} edits is found in the route exactly once`, WP4_ROUTE_SOURCE.length > 0 && notOnce.length === 0, notOnce);
  check(`each of the ${WP4_IMPORTS.length} names WP4 added to the lib import is listed exactly once`, importList.length > 0 && importsNotOnce.length === 0, importsNotOnce);
  check('POST IDENTITY: with WP5\'s and WP4\'s edits reversed the route is byte-identical to the pre-WP4 route (sha256) — nothing else in the file changed: no other statement, comment, log line, prompt character or RPC argument',
    digest === PRE_WP4_ROUTE_SHA256 && restored.length === PRE_WP4_ROUTE_LENGTH, { digest, length: restored.length, wantLength: PRE_WP4_ROUTE_LENGTH });
  check('the reversal really removes WP4 and WP5: nothing of either is left in the restored text',
    !/routeAuthority|carryAuthority|applyAssignedLook|describeRouteAuthority|obtainedAssignment|modelGeneration|assignedLook|\bauthority\b|WP4/.test(restored) && !WP5_NAMES.test(restored), restored.match(/routeAuthority|carryAuthority|applyAssignedLook|describeRouteAuthority|obtainedAssignment|modelGeneration|assignedLook|\bauthority\b|WP4/)?.[0] ?? restored.match(WP5_NAMES)?.[0]);
  // What the identity buys for the closed gate: outside the lifted block, the
  // only WP4 code in the file is the six statements reversed above — two that
  // only assign a local, the authority step (null when closed, [37]), the
  // carry step (same object under null, [37]), and two branches behind a
  // non-null authority / assigned look. (Counted with WP5's edits reversed:
  // its prompt step is handed the authority and is counted on its own below.)
  const outsideBlock = withoutWp5.replace(reversals[0][1], () => '');
  const wp4Lines = outsideBlock.split('\n').filter((line) => !line.trim().startsWith('//') && /routeAuthority|carryAuthority|applyAssignedLook|describeRouteAuthority|obtainedAssignment|modelGeneration|assignedLook|\bauthority\b/.test(line));
  check('outside the lifted block, WP4 is 14 lines of code in POST — every one of them part of an edit reversed above', wp4Lines.length === 14, wp4Lines.map((line) => line.trim().slice(0, 60)));
  // The same for WP5: outside ITS lifted block it is four lines of code in
  // POST — the step's opening line (the one new reader of the authority), the
  // two model-call arguments and the dry-run field — each part of a reversal.
  const outsideWp5Block = WP4_ROUTE_SOURCE.replace(wp5Reversals[0][1], () => '');
  const wp5Lines = outsideWp5Block.split('\n').filter((line) => !line.trim().startsWith('//') && WP5_NAMES.test(line));
  check('outside its lifted block, WP5 is 4 lines of code in POST — every one of them part of an edit reversed above', wp5Lines.length === 4, wp5Lines.map((line) => line.trim().slice(0, 60)));
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 14 WP5 — PROMPT ALIGNMENT (A6). Shared fixtures for [40]–[45].
// Three pieces of the route are LIFTED from its source and run here, in both
// gate states:
//   · the WP5 block (between its two markers): the second cached block, the
//     bounds step and the prompt step;
//   · the two module-level prompt helpers that block uses (describeLayoutBounds
//     and the copy-integrity directives);
//   · POST's OWN execute-step prompt statements — everything from
//     `const archetypeDirection` to the model call, the WP5 step included — so
//     what is examined below is what POST hands generateWithFallback, built by
//     POST's statements, not a script-side copy of them.
// ─────────────────────────────────────────────────────────────────────────────

const WP5_BEGIN = '// [WP5:BEGIN]';
const WP5_END = '// [WP5:END]';
const sliceFrom = (source: string, from: string, to: string, includeTo = false): string => {
  const a = source.indexOf(from);
  const b = a === -1 ? -1 : source.indexOf(to, a + from.length);
  return a === -1 || b === -1 ? '' : source.slice(a, includeTo ? b + to.length : b);
};
const WP5_BLOCK = sliceFrom(WP4_ROUTE_SOURCE, WP5_BEGIN, WP5_END).slice(WP5_BEGIN.length);
/** The route's two module-level prompt helpers (they sit above the WP4 block). */
const ROUTE_PROMPT_HELPERS = sliceFrom(WP4_ROUTE_SOURCE, 'function describeLayoutBounds(bounds: LayoutBounds): string {', '</copy_integrity>`;', true);
const POST_MODEL_CALL = 'const { data: generation, provider } = await generateWithFallback({';
/** POST's execute-step prompt statements: the template catalog, then every
 *  statement from the archetype direction to (not including) the model call. */
const POST_PROMPT_STATEMENTS =
  sliceFrom(WP4_POST, 'const templateCatalog = Object.values(SITE_TEMPLATES)', ".join('\\n');", true) + '\n' +
  sliceFrom(WP4_POST, 'const archetypeDirection = archetype', POST_MODEL_CALL);
/** The concepts step, whole: from its guard to the execute step's banner. */
const POST_CONCEPTS_STEP = sliceFrom(WP4_POST, "if (step === 'concepts') {", '// STEP 2 — Execution');

const sha256 = (text: string): string => crypto.createHash('sha256').update(text, 'utf8').digest('hex');
const transpileFragment = (source: string): string =>
  ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText;
/** Evaluate a fragment of the route in strict mode with ONLY `scope` and
 *  `params` in reach — a reference to anything else throws. */
function liftFragment<T>(source: string, scope: Record<string, unknown>, params: readonly string[], returns: readonly string[]): (...args: unknown[]) => T {
  const names = Object.keys(scope);
  const factory = new Function(...names, ...params, `'use strict';\n${transpileFragment(source)}\nreturn { ${returns.join(', ')} };`);
  return (...args: unknown[]): T => factory(...names.map((n) => scope[n]), ...args) as T;
}

type ExecutePrompt = { cachedSystem: string; prompt: string; layoutBoundsText: string };
type PromptFacts = {
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
type PromptHelpers = { describeLayoutBounds: (bounds: LayoutBounds) => string; COPY_INTEGRITY_DIRECTIVES: string };
type PromptSteps = {
  ASSIGNED_CACHED_SYSTEM: string;
  assignedBuildBounds: (authority: RouteAuthority, archetype: SiteArchetype | null) => { bounds: LayoutBounds; bundleApplied: boolean };
  alignPromptToAuthority: (closedGate: ExecutePrompt, authority: RouteAuthority | null, facts: PromptFacts) => ExecutePrompt;
};
/** What POST's prompt statements read: route locals, as fixtures. */
type PostPromptInputs = {
  archetype: SiteArchetype | null;
  concept: SiteConcept | null;
  chosenTemplate: TemplateKey | undefined;
  nicheContext: string;
  heuristicTemplate: TemplateKey;
  variationSeed: string | null;
  shop: { shop_name: string; bio: string | null };
  nicheLabel: string | null;
  featuredBlock: string;
  products: unknown[];
  inventorySummary: string;
  authority: RouteAuthority | null;
};
const POST_PROMPT_INPUTS = ['archetype', 'concept', 'chosenTemplate', 'nicheContext', 'heuristicTemplate', 'variationSeed', 'shop', 'nicheLabel', 'featuredBlock', 'products', 'inventorySummary', 'authority'] as const;
/** What those statements leave behind: the closed-gate prompt POST built
 *  (cachedSystem / prompt / layoutBoundsText) and what the WP5 step returned
 *  — `executePrompt`, the object the model call and the dry-run harness read. */
type PostPromptRun = ExecutePrompt & { executePrompt: ExecutePrompt };

/** Every outside name the lifted WP5 block may use: lib exports, the shared
 *  copy rules, and (added below) the route's own two prompt helpers. */
const WP5_SCOPE: Record<string, unknown> = {
  ACCENT_PRESET_SLOTS,
  DEFAULT_STOREFRONT_FAMILY,
  ELITE_COPY_RULES,
  SITE_TEMPLATES,
  archetypeLayoutBounds,
  assignedRecipeGrid,
  classicLayoutBounds,
  composeVisualSystem,
};
const WP5_STEP_NAMES = ['ASSIGNED_CACHED_SYSTEM', 'assignedBuildBounds', 'alignPromptToAuthority'] as const;

type PromptPath = RoutePath & { concept: SiteConcept | null };
const WP5_CONCEPT: SiteConcept = SiteConceptSchema.parse({
  template_key: 'editorial',
  concept_name: 'CONCEPTSENTINEL Amber Hour',
  tagline: 'Oils pressed for slow mornings',
  vibe: 'Cold-pressed marula, bottled in amber glass and blended weekly.',
  palette: 'Nine oils and serums for one calm routine.',
  hero_headline: 'Skin Drinks Golden Light',
  hero_subheadline: 'Cold-pressed oils for skin that keeps its glow.',
});
/** The nine WP4 request paths — the two concept paths now carrying their
 *  approved concept — plus a concept whose template_key DRIFTED from its
 *  archetype's (the archetype's template wins in the route's resolution). */
const WP5_PATHS: PromptPath[] = [
  ...WP4_PATHS.map((p): PromptPath => ({
    ...p,
    concept: p.name.startsWith('concept') ? { ...WP5_CONCEPT, template_key: p.chosenTemplate ?? WP5_CONCEPT.template_key, ...(p.archetype ? { archetype_key: p.archetype.key } : {}) } : null,
  })),
  { name: 'concept-drifted/deep-luxury', archetype: ARCHETYPES['deep-luxury'], chosenTemplate: ARCHETYPES['deep-luxury'].template_key, forcedTemplate: { template: ARCHETYPES['deep-luxury'].template_key, source: 'concept' }, concept: { ...WP5_CONCEPT, template_key: 'vitality', archetype_key: 'deep-luxury' } },
];
/** What varies per request besides the path: the seed, the declared niche, the bio. */
type PromptRequest = { seed: string | null; nicheLabel: string | null; bio: string | null };
const WP5_REQUESTS: PromptRequest[] = [
  { seed: null, nicheLabel: null, bio: null },
  { seed: 'SEEDSENTINEL-7', nicheLabel: null, bio: 'BIOSENTINEL — pressed in small batches.' },
  { seed: null, nicheLabel: 'NICHESENTINEL Atelier', bio: null },
  { seed: 'SEEDSENTINEL-9', nicheLabel: 'NICHESENTINEL Atelier', bio: 'BIOSENTINEL — pressed in small batches.' },
];
/** A marker inside every per-request value — none may reach a cached block. */
const WP5_SENTINELS = ['SHOPSENTINEL', 'BIOSENTINEL', 'NICHESENTINEL', 'SEEDSENTINEL', 'FEATUREDSENTINEL', 'INVENTORYSENTINEL', 'CONCEPTSENTINEL'];
const WP5_FEATURED_BLOCK = 'FEATURED PRODUCTS (the 2 pieces the storefront displays in the hero and collection grid — story, product_grid intro and hero copy must reference ONLY these):\n1. FEATUREDSENTINEL Marula Oil (Serums, D450): Cold-pressed.\n2. Baobab Serum (Serums, D520)';
const WP5_INVENTORY_SUMMARY = '- INVENTORYSENTINEL Marula Oil (Serums, D450): Cold-pressed.\n- Baobab Serum (Serums, D520)\n- Shea Balm (Balms, D300)';
function postPromptInputs(p: PromptPath, q: PromptRequest, heuristicTemplate: TemplateKey, authority: RouteAuthority | null): PostPromptInputs {
  return {
    archetype: p.archetype,
    concept: p.concept,
    chosenTemplate: p.chosenTemplate,
    // The route's own two forms of this line (declared niche / inventory only).
    nicheContext: q.nicheLabel
      ? `seller-declared niche "${q.nicheLabel}" (inventory's dominant category: "serums") — tailor every structural and copy decision to this niche`
      : 'dominant category "serums"',
    heuristicTemplate,
    variationSeed: q.seed,
    shop: { shop_name: 'SHOPSENTINEL Oils', bio: q.bio },
    nicheLabel: q.nicheLabel,
    featuredBlock: WP5_FEATURED_BLOCK,
    products: new Array(9).fill(null),
    inventorySummary: WP5_INVENTORY_SUMMARY,
    authority,
  };
}
const promptFactsOf = (p: PromptPath, q: PromptRequest): PromptFacts => ({
  shopName: 'SHOPSENTINEL Oils', shopBio: q.bio, nicheLabel: q.nicheLabel, featuredBlock: WP5_FEATURED_BLOCK, productCount: 9,
  inventorySummary: WP5_INVENTORY_SUMMARY, concept: p.concept, archetype: p.archetype, entropyEngine: q.seed ? `\n\n<entropy_engine>\nVariation Seed: ${q.seed}\n</entropy_engine>` : '',
});

let wp5LiftError: string | null = null;
const PROMPT_HELPERS: PromptHelpers | null = ((): PromptHelpers | null => {
  if (!ROUTE_PROMPT_HELPERS) { wp5LiftError = 'the route\'s prompt helpers (describeLayoutBounds … COPY_INTEGRITY_DIRECTIVES) were not found'; return null; }
  try {
    return liftFragment<PromptHelpers>(ROUTE_PROMPT_HELPERS, {}, [], ['describeLayoutBounds', 'COPY_INTEGRITY_DIRECTIVES'])();
  } catch (error) {
    wp5LiftError = `prompt helpers: ${String(error)}`;
    return null;
  }
})();
const PROMPT_STEPS: PromptSteps | null = ((): PromptSteps | null => {
  if (!PROMPT_HELPERS) return null;
  if (!WP5_BLOCK) { wp5LiftError = 'WP5 markers not found in the route'; return null; }
  try {
    return liftFragment<PromptSteps>(WP5_BLOCK, { ...WP5_SCOPE, ...PROMPT_HELPERS }, [], WP5_STEP_NAMES)();
  } catch (error) {
    wp5LiftError = `WP5 block: ${String(error)}`;
    return null;
  }
})();
const POST_PROMPT: ((inputs: PostPromptInputs) => PostPromptRun) | null = ((): ((inputs: PostPromptInputs) => PostPromptRun) | null => {
  if (!PROMPT_HELPERS || !PROMPT_STEPS) return null;
  try {
    const scope = { ACCENT_PRESET_SLOTS, ELITE_COPY_RULES, SITE_TEMPLATES, TEMPLATE_KEYS, archetypeLayoutBounds, classicLayoutBounds, ...PROMPT_HELPERS, alignPromptToAuthority: PROMPT_STEPS.alignPromptToAuthority };
    const statements = liftFragment<PostPromptRun>(POST_PROMPT_STATEMENTS, scope, POST_PROMPT_INPUTS, ['cachedSystem', 'prompt', 'layoutBoundsText', 'executePrompt']);
    const runIt = (inputs: PostPromptInputs): PostPromptRun => statements(...POST_PROMPT_INPUTS.map((name) => inputs[name]));
    // One run per branch of the statements, so a stray reference surfaces here.
    for (const p of WP5_PATHS) for (const q of WP5_REQUESTS) runIt(postPromptInputs(p, q, 'ritual', null));
    return runIt;
  } catch (error) {
    wp5LiftError = `POST prompt statements: ${String(error)}`;
    return null;
  }
})();

console.log('\n[40] Phase 14 WP5 — the prompt step: lifted, pure, and handed the authority alone');
{
  const count = (source: string, needle: string): number => source.split(needle).length - 1;
  check('route source: the WP5 block is found between its two markers, after the WP4 block and above POST',
    WP5_BLOCK.length > 0 && count(WP4_ROUTE_SOURCE, WP5_BEGIN) === 1 && count(WP4_ROUTE_SOURCE, WP5_END) === 1 &&
    WP4_ROUTE_SOURCE.indexOf(WP4_END) < WP4_ROUTE_SOURCE.indexOf(WP5_BEGIN) && WP4_ROUTE_SOURCE.indexOf(WP5_END) < WP4_ROUTE_SOURCE.indexOf('export async function POST'));
  check('the route\'s two prompt helpers lift and run with NOTHING in scope (no import, no route local)',
    PROMPT_HELPERS !== null && typeof PROMPT_HELPERS.describeLayoutBounds === 'function' && typeof PROMPT_HELPERS.COPY_INTEGRITY_DIRECTIVES === 'string' && PROMPT_HELPERS.COPY_INTEGRITY_DIRECTIVES.startsWith('<copy_integrity>'), wp5LiftError);
  check('the WP5 block lifts and runs against lib exports, the shared copy rules and those two helpers alone (no route local, no client, no gate constant, no WP4 step in scope)',
    PROMPT_STEPS !== null && typeof PROMPT_STEPS.ASSIGNED_CACHED_SYSTEM === 'string' && typeof PROMPT_STEPS.assignedBuildBounds === 'function' && typeof PROMPT_STEPS.alignPromptToAuthority === 'function', wp5LiftError);
  check('POST\'s own execute-step prompt statements lift and run — `const archetypeDirection` through the WP5 step, on every request path — so the prompts below are built by POST\'s statements, not by a mirror',
    POST_PROMPT !== null && POST_PROMPT_STATEMENTS.includes('const cachedSystem = `<system_context>') && POST_PROMPT_STATEMENTS.includes('const prompt = `<seller_data>') && POST_PROMPT_STATEMENTS.includes('const executePrompt = alignPromptToAuthority('), wp5LiftError);

  const impure = /\b(await|async|console|process|fetch|require|import|supabase|admin|Date|setTimeout)\b|Math\.random/;
  check('the WP5 block is pure: no I/O, no logging, no clock, no randomness, no await', WP5_BLOCK.length > 0 && !impure.test(WP5_BLOCK), WP5_BLOCK.match(impure)?.[0]);
  const reDerives = /RITUAL_RECIPE_GENERATION_ENABLED|\bgateOpen\b|obtainedAssignment|assignArchitecture|ArchitectureAssignment|alignAssignmentInputs|isStorefrontDecision|STOREFRONT_FAMILIES|\bARCHITECTURES\b|TEMPLATE_KEYS|SUBTRACTION_TEMPLATE_KEY|routeAuthority|carryAuthority|applyAssignedLook|describeRouteAuthority|carryStorefrontDecision|guardRecipeGridPick|templateFromCategory|chosenTemplate|heuristicTemplate|templateOverride|forcedTemplate/;
  check('the WP5 block does not re-derive or re-validate the authority: it never names the gate, the assignment object or engine, a validator, a WP4 step, a guard, or the seller\'s / heuristic template',
    WP5_BLOCK.length > 0 && !reDerives.test(WP5_BLOCK), WP5_BLOCK.match(reDerives)?.[0]);
  const reads = [...new Set([...WP5_BLOCK.matchAll(/\bauthority\.(\w+(?:\.\w+)?)/g)].map((m) => m[1]))].sort();
  const decisionFields = /\.(architecture|eligibility|signals|reason|confidence|sellerTemplate|overriddenBy|commercePreference|familyReason|floor)\b/;
  check('the WP5 block consumes the authority only: its template, whether it holds a decision, and that decision\'s family — the recipe grid through assignedRecipeGrid, exactly as the WP4 log line does; no other field of the decision',
    reads.join() === 'decision,decision.family,template' && count(WP5_BLOCK, 'assignedRecipeGrid(authority.decision)') === 1 && count(WP5_BLOCK, 'assignedRecipeGrid(') === 1 && !decisionFields.test(WP5_BLOCK), { reads, field: WP5_BLOCK.match(decisionFields)?.[0] });
  check('the WP5 block does not recompute template ownership: it compares no template keys (no `.template_key` read) and takes "is the archetype on its own template?" from the WP3 composition',
    WP5_BLOCK.length > 0 && !/\.template_key\b/.test(WP5_BLOCK) && count(WP5_BLOCK, 'composeVisualSystem(archetype, authority.template)') === 1 && count(WP5_BLOCK, 'composeVisualSystem(') === 1 && count(WP5_BLOCK, 'look.templateChanged') === 1);

  check('POST: the prompt step is called once — handed the closed-gate prompt POST just built, the authority, and seller / creative facts only (no template, no gate, no assignment)',
    count(WP4_POST, 'alignPromptToAuthority(') === 1 &&
    /const executePrompt = alignPromptToAuthority\(\{ cachedSystem, prompt, layoutBoundsText \}, authority, \{\s*shopName: shop\.shop_name,\s*shopBio: shop\.bio,\s*nicheLabel,\s*featuredBlock,\s*productCount: products\.length,\s*inventorySummary,\s*concept,\s*archetype,\s*entropyEngine,\s*\}\);/.test(WP4_POST));
  check('POST: the model is sent the step\'s output and nothing else — `executePrompt` is named four times: where it is made, the two model-call arguments, and the dry-run harness\'s layout_bounds',
    count(WP4_POST, 'executePrompt') === 4 && WP4_POST.includes('layout_bounds: executePrompt.layoutBoundsText,') &&
    /generateWithFallback\(\{\s*schema: MatrixWebsiteGenerationSchema,\s*prompt: executePrompt\.prompt,\s*cachedSystem: executePrompt\.cachedSystem,\s*callerName: 'generate-website',/.test(WP4_POST));
  check('POST: the concepts step still sends its own cached block and prompt — the WP5 step is not in it',
    POST_CONCEPTS_STEP.length > 0 && /generateWithFallback\(\{\s*schema: ConceptPairSchema,\s*prompt,\s*cachedSystem,\s*callerName: 'generate-website:concepts',/.test(POST_CONCEPTS_STEP) &&
    !/authority|executePrompt|alignPromptToAuthority|ASSIGNED_|WP5/.test(POST_CONCEPTS_STEP));

  const root = process.cwd();
  const read = (rel: string): string => {
    try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch { return ''; }
  };
  const walk = (rel: string, out: string[] = []): string[] => {
    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true }); } catch { return out; }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const child = `${rel}/${e.name}`;
      if (e.isDirectory()) walk(child, out);
      else if (/\.(ts|tsx|mts|js|jsx|mjs)$/.test(e.name)) out.push(child);
    }
    return out;
  };
  const WP5_STEP_NAMES_RE = /\b(alignPromptToAuthority|assignedBuildBounds|ASSIGNED_CACHED_SYSTEM|ASSIGNED_FAMILY_FACTS|ASSIGNED_GRID_FACTS|AssignedPromptFacts)\b/;
  const others = [...walk('app'), ...walk('components'), ...walk('lib')].filter((f) => f !== WP4_ROUTE_FILE);
  const users = others.filter((f) => WP5_STEP_NAMES_RE.test(read(f)));
  check(`WP5 lives in the generation route alone — no library, component, page or other route names a WP5 step (${others.length} files, the engine file included)`, others.length > 50 && others.includes('lib/siteTemplates.ts') && users.length === 0, users);
}

if (!ROUTE_STEPS || !PROMPT_HELPERS || !PROMPT_STEPS || !POST_PROMPT) {
  check('sections [41]–[45] need the lifted WP4 steps, the lifted WP5 block and POST\'s lifted prompt statements — NOT RUN', false, wp4LiftError ?? wp5LiftError);
} else {
  const R = ROUTE_STEPS;
  const H = PROMPT_HELPERS;
  const S = PROMPT_STEPS;
  const postPrompt = POST_PROMPT;
  const count = (source: string, needle: string): number => source.split(needle).length - 1;
  /** Which of `values` a text names as a quoted token — `"ritual"`, `"subtraction"`, `"counter"`. */
  const named = (text: string, values: readonly string[]): string[] => values.filter((v) => text.includes(`"${v}"`));
  /** What the pre-WP5 prompt says where it asks the model to CHOOSE an Assignment-owned value. */
  const CHOICE_PHRASES = [
    'TEMPLATE SELECTION', 'choose the single best template_key', 'Heuristic suggestion', 'AVAILABLE TEMPLATES', 'IF template_key is',
    'the seller has explicitly chosen', 'the seller approved the "', 'You MUST set template_key', 'why this template',
    'ALWAYS set this', 'SUBTRACTION RULES', 'SUBTRACTION DEFAULTS', 'route the section rhythm', 'keep choosing',
    `one of ${TEMPLATE_KEYS.map((k) => `"${k}"`).join(' | ')}`,
  ];
  const CHOICE_PATTERN = /\b(choose|select|pick|prefer)\b[^.\n]{0,120}\b(template|template_key|storefront_family|storefront family|family)\b/i;
  const asksToChoose = (text: string): string | null => CHOICE_PHRASES.find((phrase) => text.includes(phrase)) ?? text.match(CHOICE_PATTERN)?.[0] ?? null;
  const RECIPE_GRIDS = ['counter', 'gallery'] as const;

  console.log('\n[41] Phase 14 WP5 — gate matrix, CLOSED: both AI steps send the pre-WP5 prompt, byte for byte');
  {
    // Recorded from the route as it stood BEFORE WP5 (commit 752dd09), by
    // running that file's own prompt statements over the matrix below.
    const PRE_WP5_CACHED_SHA256 = '64a1a9179205f746933a0027ba96e643a19ab2d836d4794c390a1cf94f9e4b1f';
    const PRE_WP5_CACHED_LENGTH = 10649;
    const PRE_WP5_DYNAMIC_SHA256 = 'c92017e0b9d2ddb4f639ebb05d3ebf847c41ffe61b9d00dc35af3d9054859cdb';
    const PRE_WP5_CONCEPTS_STEP_SHA256 = 'd383a1dd9ba4d2a1780452d4aa283519b605e749e281f9c321a7d8f717d91fec';

    check('the generation gate constant is still false — production sends the closed-gate prompt', RITUAL_RECIPE_GENERATION_ENABLED === false);
    check('closed: the authority POST hands the prompt step is null, whatever Assignment returned',
      [null, undefined, ...WP3_DECISIONS.map(([, d]) => d)].every((d) => R.routeAuthority(RITUAL_RECIPE_GENERATION_ENABLED, d, 'ritual') === null));

    // The step itself: under a null authority it returns the object it was handed.
    const handed: ExecutePrompt = Object.freeze({ cachedSystem: 'CACHED', prompt: 'PROMPT', layoutBoundsText: 'BOUNDS' });
    let passThrough = true;
    let passCases = 0;
    for (const p of WP5_PATHS) {
      for (const q of WP5_REQUESTS) {
        passCases += 1;
        if (S.alignPromptToAuthority(handed, null, promptFactsOf(p, q)) !== handed) passThrough = false;
      }
    }
    check(`closed: with no authority the prompt step returns the SAME object it was handed — never a copy, never rebuilt (${passCases} requests: ${WP5_PATHS.length} paths × ${WP5_REQUESTS.length} request shapes; the handed object is frozen)`, passThrough && passCases === WP5_PATHS.length * WP5_REQUESTS.length);

    // POST's own statements, run for every request path with a null authority.
    const runs: Array<{ name: string; run: PostPromptRun }> = [];
    for (const p of WP5_PATHS) {
      for (const q of WP5_REQUESTS) {
        for (const heuristic of TEMPLATE_KEYS) {
          runs.push({ name: `${p.name}|seed=${q.seed}|niche=${q.nicheLabel}|bio=${q.bio !== null}|heuristic=${heuristic}`, run: postPrompt(postPromptInputs(p, q, heuristic, null)) });
        }
      }
    }
    const sent = runs.every(({ run }) => run.executePrompt.cachedSystem === run.cachedSystem && run.executePrompt.prompt === run.prompt && run.executePrompt.layoutBoundsText === run.layoutBoundsText);
    check(`closed: what POST sends the model IS what its closed-gate statements built — cached block, dynamic prompt and the dry-run bounds text, on every request path (${runs.length} requests: ${WP5_PATHS.length} paths × ${WP5_REQUESTS.length} request shapes × ${TEMPLATE_KEYS.length} heuristic templates)`,
      sent && runs.length === WP5_PATHS.length * WP5_REQUESTS.length * TEMPLATE_KEYS.length);
    const cachedBlocks = [...new Set(runs.map(({ run }) => run.executePrompt.cachedSystem))];
    check('closed: the cached block is ONE string on every request path — and it is byte-identical to the pre-WP5 cached block (sha256 + length recorded from the pre-WP5 route)',
      cachedBlocks.length === 1 && sha256(cachedBlocks[0]) === PRE_WP5_CACHED_SHA256 && cachedBlocks[0].length === PRE_WP5_CACHED_LENGTH, { blocks: cachedBlocks.length, digest: sha256(cachedBlocks[0] ?? ''), length: cachedBlocks[0]?.length });
    const dynamicDigest = sha256(JSON.stringify(runs.map(({ name, run }) => [name, run.executePrompt.prompt, run.executePrompt.layoutBoundsText])));
    check(`closed: the dynamic prompt and the bounds text are byte-identical to the pre-WP5 route's on all ${runs.length} requests (sha256 over the whole matrix, recorded from the pre-WP5 route)`, dynamicDigest === PRE_WP5_DYNAMIC_SHA256, dynamicDigest);
    check('closed: the second cached block is never sent and the prompt carries no <assignment> section',
      runs.every(({ run }) => run.executePrompt.cachedSystem !== S.ASSIGNED_CACHED_SYSTEM && !run.executePrompt.prompt.includes('<assignment>') && !run.executePrompt.cachedSystem.includes('<assignment')));
    // Today's behaviour, preserved: the closed prompt still asks the model to choose.
    const onboardingClosed = runs.find(({ name }) => name.startsWith('onboarding|'))!.run.executePrompt;
    check('closed: the model is still asked to choose the template, the family and Subtraction (today\'s behaviour, untouched) — the detector section [42] uses fires on it',
      onboardingClosed.prompt.includes('TEMPLATE SELECTION: choose the single best template_key') && onboardingClosed.cachedSystem.includes('"storefront_family"    : ALWAYS set this') && onboardingClosed.cachedSystem.includes('SUBTRACTION RULES') &&
      asksToChoose(onboardingClosed.cachedSystem) !== null && asksToChoose(onboardingClosed.prompt) !== null);
    check('closed: split_cta is asked for whenever an archetype is in play — as before WP5',
      runs.every(({ name, run }) => run.executePrompt.prompt.includes('Write the split_cta object') === (WP5_PATHS.find((p) => name.startsWith(`${p.name}|`))!.archetype !== null)));

    // The concepts step is out of WP5's scope: its source is the pre-WP5 text.
    check('concepts step: its whole source — cached block, dynamic prompt, model call, pinning, log line and response — is byte-identical to the pre-WP5 route (sha256)',
      POST_CONCEPTS_STEP.length > 0 && sha256(POST_CONCEPTS_STEP) === PRE_WP5_CONCEPTS_STEP_SHA256, sha256(POST_CONCEPTS_STEP));

    // Logs, config, persistence.
    const logCalls = (WP4_ROUTE_SOURCE.match(/console\.(log|warn|error|info|debug)\(/g) ?? []).length;
    check('logs: WP5 adds no log statement — the route still has the 23 it had after WP4, none of them in the WP5 block', logCalls === 23 && !/console\./.test(WP5_BLOCK), logCalls);
    const tailStart = WP4_POST.indexOf('const { brand_tokens, matrix_theme, ...modelGeneration } = generation;');
    const tail = WP4_POST.slice(tailStart).split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
    check('config and persistence: after the model answers, the step\'s output is read ONCE — the dry-run harness\'s layout_bounds — so no carrier, pin, expression write, cleanup or RPC argument can depend on the prompt step ([37] and [39] prove the tail itself is unchanged)',
      tailStart > 0 && count(tail, 'executePrompt') === 1 && count(tail, 'layout_bounds: executePrompt.layoutBoundsText,') === 1 && !/alignPromptToAuthority|ASSIGNED_/.test(tail));
  }

  // ── Open gate. One build per (merchant × niche × request path), plus the
  // Classic floor reached five ways. For each: the authority the route's own
  // step returns, and the prompt POST's own statements then build from it.
  type OpenBuild = {
    label: string;
    p: PromptPath;
    q: PromptRequest;
    facts: RouteFacts;
    floorCase: { obtained: ArchitectureAssignment | null | undefined } | undefined;
    authority: RouteAuthority;
    family: string;
    grid: string | null;
    sent: ExecutePrompt;
    full: string;
  };
  const hostileDecision = new Proxy({}, { get() { throw new Error('unreadable decision'); } }) as unknown as ArchitectureAssignment;
  const counterDecision = WP3_DECISIONS[0][1];
  const FLOORS: Array<[string, ArchitectureAssignment | null | undefined]> = [
    ['missing: null', null],
    ['missing: undefined', undefined],
    ['unreadable: reading the decision throws', hostileDecision],
    ['invalid: a closed-gate object while the gate is open', closed({ niche: 'tech', products: photographed(20, 20, ['Phones', 'Laptops', 'Audio']), heroMedia: banner })],
    ['invalid: a family that is not a family', { ...counterDecision, family: 'not-a-family' } as unknown as ArchitectureAssignment],
    ['invalid: Counter on a template that cannot render it', { ...counterDecision, template: 'editorial' } as unknown as ArchitectureAssignment],
    ['invalid: a Counter decision relabelled Subtraction', { ...counterDecision, family: 'subtraction' } as unknown as ArchitectureAssignment],
  ];
  const openBuilds: OpenBuild[] = [];
  let openBuildError: string | null = null;
  let openMerchants = 0;
  try {
    const sampled = wp2Merchants().filter((_, i) => i % 577 === 0);
    const merchants: Merchant[] = [...WP4_MERCHANTS.map(([, m]) => m), ...sampled];
    openMerchants = merchants.length;
    const push = (label: string, m: Merchant, p: PromptPath, bodyNiche: unknown, q: PromptRequest, floorCase?: { obtained: ArchitectureAssignment | null | undefined }): void => {
      const facts = routeFacts(m, p, bodyNiche, true);
      const authority = R.routeAuthority(true, floorCase ? floorCase.obtained : facts.assignment, p.chosenTemplate ?? facts.heuristicTemplate);
      if (!authority) throw new Error(`gate open returned no authority (${label})`);
      const sent = postPrompt(postPromptInputs(p, q, facts.heuristicTemplate, authority)).executePrompt;
      openBuilds.push({
        label, p, q, facts, floorCase, authority,
        family: authority.decision ? authority.decision.family : DEFAULT_STOREFRONT_FAMILY,
        grid: authority.decision ? assignedRecipeGrid(authority.decision) : null,
        sent, full: `${sent.cachedSystem}\n${sent.prompt}`,
      });
    };
    merchants.forEach((m, mi) => WP4_NICHES.forEach((bodyNiche, ni) => WP5_PATHS.forEach((p, pi) => {
      push(`merchant ${mi} / niche ${String(bodyNiche)} / ${p.name}`, m, p, bodyNiche, WP5_REQUESTS[(mi + ni + pi) % WP5_REQUESTS.length]);
    })));
    FLOORS.forEach(([name, obtained], fi) => [WP4_MERCHANTS[0][1], WP4_MERCHANTS[2][1]].forEach((m, mi) => WP5_PATHS.forEach((p, pi) => {
      push(`floor (${name}) / merchant ${mi} / ${p.name}`, m, p, 'general', WP5_REQUESTS[(fi + mi + pi) % WP5_REQUESTS.length], { obtained });
    })));
  } catch (error) {
    openBuildError = String(error);
  }
  const decided = openBuilds.filter((b) => b.authority.decision !== null);
  const floored = openBuilds.filter((b) => b.authority.decision === null);
  /** The model pushing against every Assignment-owned value at once, twice
   *  over — whatever the authority is, at least one of these differs from it
   *  in the template, the family and the recipe grid. */
  const pushyModels: WebsiteGeneration[] = [
    { ...GENERATION, template_key: 'vitality', layout: modelLayout('subtraction', 'counter') },
    { ...GENERATION, template_key: 'editorial', layout: modelLayout('menu-occasion', 'gallery') },
    { ...GENERATION, template_key: 'ritual', layout: modelLayout('product-first', 'masonry') },
  ];
  const tailOf = (b: OpenBuild, model: WebsiteGeneration, steps: RouteSteps = R) => routeTail(steps, b.facts, b.p, model, true, b.floorCase);
  const section = (text: string, tag: string): string => sliceFrom(text, `<${tag}>\n`, `\n</${tag}>`).slice(tag.length + 3);

  console.log('\n[42] Phase 14 WP5 — gate OPEN, ownership: the prompt states the authority\'s template, family and recipe grid, and asks the model for none of them');
  {
    const outcomes = [...new Set(decided.map((b) => `${b.authority.decision!.architecture}/${b.family}`))].sort();
    const floorKinds = [...new Set(floored.map((b) => b.authority.floor))].sort();
    check(`fixtures: ${openBuilds.length} open-gate prompts built by POST's own statements (${openMerchants} merchants × ${WP4_NICHES.length} niches × ${WP5_PATHS.length} paths, plus ${FLOORS.length} floors × 2 merchants × ${WP5_PATHS.length} paths) — every decision outcome (${outcomes.join(', ')}) and the Classic floor reached as ${floorKinds.join(' / ')}`,
      openBuildError === null && openMerchants > WP4_MERCHANTS.length && decided.length === openMerchants * WP4_NICHES.length * WP5_PATHS.length && floored.length === FLOORS.length * 2 * WP5_PATHS.length &&
      ['classic/lifestyle-story', 'classic/menu-occasion', 'classic/product-first', 'classic/subtraction', 'counter/product-first', 'gallery/lifestyle-story'].every((outcome) => outcomes.includes(outcome)) && floorKinds.join() === 'invalid,missing,unreadable',
      openBuildError ?? { decided: decided.length, floored: floored.length, outcomes, floorKinds });

    let templateOk = true;
    let familyOk = true;
    let gridOk = true;
    let builtOk = true;
    let reasoningOk = true;
    let noChoice = true;
    let tagsOk = true;
    let sellerDataOk = true;
    let discardedSeller = 0;
    let discardedConcept = 0;
    let discardedHeuristic = 0;
    let ownedGrids = 0;
    let offender: unknown;
    const note = (what: string, b: OpenBuild, detail?: unknown): void => { offender = offender ?? { what, build: b.label, detail }; };
    for (const b of openBuilds) {
      const t = b.authority.template;
      const assignment = section(b.sent.prompt, 'assignment');
      // TEMPLATE — stated as fixed; the only template the whole prompt names.
      if (
        named(b.full, TEMPLATE_KEYS).join() !== t || !assignment.includes(`TEMPLATE — FIXED: "${t}" (${SITE_TEMPLATES[t].name} — ${SITE_TEMPLATES[t].niche}).`) ||
        !assignment.includes(`Set template_key to "${t}".`) || count(assignment, 'TEMPLATE — FIXED:') !== 1
      ) { templateOk = false; note('template', b, named(b.full, TEMPLATE_KEYS)); }
      if (b.p.chosenTemplate && b.p.chosenTemplate !== t) discardedSeller += 1;
      if (b.p.concept && b.p.concept.template_key !== t) discardedConcept += 1;
      if (b.facts.heuristicTemplate !== t) discardedHeuristic += 1;
      // FAMILY — stated as fixed; the only family the whole prompt names; never a key the dynamic prompt asks for.
      if (
        named(b.full, STOREFRONT_FAMILIES).join() !== b.family || !assignment.includes(`STOREFRONT FAMILY — FIXED: "${b.family}".`) || count(assignment, 'STOREFRONT FAMILY — FIXED:') !== 1 ||
        b.sent.prompt.includes('storefront_family') || count(b.sent.cachedSystem, 'storefront_family') !== 1 || !b.sent.cachedSystem.includes('never write "layout.storefront_family"')
      ) { familyOk = false; note('family', b, named(b.full, STOREFRONT_FAMILIES)); }
      // RECIPE GRID — stated as fixed when owned; otherwise the presentation grid is the model's and no recipe grid is named.
      const fixedLine = count(assignment, 'COLLECTION GRID — FIXED:');
      const yoursLine = count(assignment, 'COLLECTION GRID — YOURS:');
      if (b.grid) ownedGrids += 1;
      if (
        named(b.full, RECIPE_GRIDS).join() !== (b.grid ?? '') ||
        (b.grid ? fixedLine !== 1 || yoursLine !== 0 || !assignment.includes(`COLLECTION GRID — FIXED: "${b.grid}"`) || !assignment.includes('Do not write layout_strategy.grid.') : fixedLine !== 0 || yoursLine !== 1)
      ) { gridOk = false; note('grid', b, { named: named(b.full, RECIPE_GRIDS), owned: b.grid }); }
      // What is stated is what the build does, whatever the model answers.
      for (const model of pushyModels) {
        const run4 = tailOf(b, model);
        if (run4.config.template_key !== t || run4.config.storefront_family !== b.family || recipeOf(run4.legacyGeneration.layout?.layout_strategy?.grid) !== (b.grid ?? 'none')) {
          builtOk = false; note('built', b, { config: `${run4.config.template_key}/${run4.config.storefront_family}/${recipeOf(run4.legacyGeneration.layout?.layout_strategy?.grid)}`, stated: `${t}/${b.family}/${b.grid ?? 'none'}` });
        }
      }
      // NICHE REASONING — explains the authority's template.
      if (
        !assignment.includes(`NICHE REASONING: write niche_reasoning explaining how the "${t}" template is styled for this inventory.`) || count(b.sent.prompt, 'niche_reasoning') !== 1 ||
        !b.sent.cachedSystem.includes('- "niche_reasoning"  : 1-2 sentences on how the assigned template and your structural choices fit this inventory')
      ) { reasoningOk = false; note('niche reasoning', b); }
      // No request to choose an Assignment-owned value, anywhere in the prompt.
      const asked = asksToChoose(b.full);
      if (asked !== null) { noChoice = false; note('choice', b, asked); }
      // Every section the cached block points the model at is in the user message.
      const wantsDirection = b.p.concept !== null || b.p.archetype !== null;
      // (Tags are counted as SECTION openers — on a line of their own — since
      // the prose may refer to <layout_bounds> by name.)
      const opens = (tag: string): number => count(`\n${b.sent.prompt}`, `\n<${tag}>\n`);
      const at = (needle: string): number => b.sent.prompt.indexOf(needle);
      if (
        opens('seller_data') !== 1 || opens('assignment') !== 1 || count(b.sent.prompt, '\n</assignment>\n') !== 1 || opens('layout_bounds') !== 1 || opens('copy_integrity') !== 1 ||
        opens('chosen_archetype') !== (wantsDirection ? 1 : 0) || opens('entropy_engine') !== (b.q.seed ? 1 : 0) ||
        !(at('\n</seller_data>\n') < at('\n<assignment>\n') && at('\n</assignment>\n') < at('\n<layout_bounds>\n') && at('\n</layout_bounds>\n') < at('\n<copy_integrity>\n')) ||
        (wantsDirection && !(at('\n</assignment>\n') < at('\n<chosen_archetype>\n') && at('\n</chosen_archetype>\n') < at('\n<layout_bounds>\n')))
      ) { tagsOk = false; note('sections', b); }
      // The seller data is the closed-gate prompt's, character for character.
      const closedPrompt = postPrompt(postPromptInputs(b.p, b.q, b.facts.heuristicTemplate, null)).executePrompt.prompt;
      const sellerEnd = '</seller_data>';
      if (b.sent.prompt.slice(0, b.sent.prompt.indexOf(sellerEnd)) !== closedPrompt.slice(0, closedPrompt.indexOf(sellerEnd)) || !b.sent.prompt.endsWith(closedPrompt.slice(closedPrompt.indexOf('<copy_integrity>')))) { sellerDataOk = false; note('seller data', b); }
    }
    check(`TEMPLATE: every open-gate prompt states the authority's template as FIXED and names no other template anywhere — cached block or user message (${openBuilds.length} prompts)`, templateOk && openBuilds.length > 0, offender);
    check(`TEMPLATE: the seller's own template (${discardedSeller} prompts), an approved concept's template (${discardedConcept}) and the category heuristic's (${discardedHeuristic}) are never named once Assignment set them aside — the prompt never requests a template the build will not use`,
      templateOk && discardedSeller > 100 && discardedConcept > 20 && discardedHeuristic > 100, { discardedSeller, discardedConcept, discardedHeuristic });
    check('FAMILY: every open-gate prompt states the authority\'s family as FIXED (the default family at the Classic floor), names no other family, and tells the model never to write the key', familyOk, offender);
    check(`RECIPE GRID: where the authority owns one it is stated as FIXED and the model is told not to write the grid (${ownedGrids} prompts); where it owns none, no recipe grid is named and the presentation grid is marked the model's`, gridOk && ownedGrids > 100, offender);
    check(`what the prompt states is what the build does: for each prompt, the config POST's tail assembles carries that template, that family and that recipe grid whatever the model answers (${openBuilds.length} prompts × ${pushyModels.length} model generations pushing the other way)`, builtOk, offender);
    check('NICHE REASONING: the prompt asks the model to explain the authority\'s template — the only template it names — and the field spec speaks of "the assigned template"', reasoningOk, offender);
    check('NO CHOICE: no open-gate prompt asks the model to choose, select or prefer a template or a family, and none carries a pre-WP5 selection instruction (TEMPLATE SELECTION, AVAILABLE TEMPLATES, "ALWAYS set this", SUBTRACTION RULES / DEFAULTS, the per-template bounds list)', noChoice, offender);
    check('no contradiction by omission: every section the cached block points at is in the user message, once, in order — <seller_data>, <assignment>, <chosen_archetype> exactly when a concept or archetype was approved, <layout_bounds>, <entropy_engine> exactly when a seed was posted', tagsOk, offender);
    check('the seller data, the copy-integrity directives and the entropy block are the closed-gate prompt\'s own text, character for character — WP5 changed what the model is told about ownership, nothing else', sellerDataOk, offender);

    // The Classic floor.
    let floorOk = true;
    let floorWords = true;
    let floorOffender: unknown;
    const FLOOR_BANNED = /subtraction|recipe|\bcounter\b|\bgallery\b/i;
    for (const b of floored) {
      const floorTemplate = b.p.chosenTemplate ?? b.facts.heuristicTemplate;
      const assignment = section(b.sent.prompt, 'assignment');
      if (b.authority.template !== floorTemplate || b.family !== DEFAULT_STOREFRONT_FAMILY || b.grid !== null || !assignment.includes(`TEMPLATE — FIXED: "${floorTemplate}"`) || !assignment.includes(`STOREFRONT FAMILY — FIXED: "${DEFAULT_STOREFRONT_FAMILY}".`) || !assignment.includes('COLLECTION GRID — YOURS:')) { floorOk = false; floorOffender = floorOffender ?? b.label; }
      if (FLOOR_BANNED.test(b.full)) { floorWords = false; floorOffender = floorOffender ?? { build: b.label, word: b.full.match(FLOOR_BANNED)?.[0] }; }
    }
    check(`CLASSIC FLOOR: with no usable decision the prompt states the floor template (the seller's, else the category heuristic's) and the default family as FIXED (${floored.length} prompts: ${FLOORS.length} floors × 2 merchants × ${WP5_PATHS.length} paths)`, floorOk && floored.length > 0, floorOffender);
    check('CLASSIC FLOOR: the whole prompt — cached block and user message — never mentions Subtraction, a recipe, or a recipe grid', floorWords && floored.length > 0, floorOffender);
    // Decisions that own no recipe grid read the same way; Subtraction is named only when it is the assigned family.
    const subtractionOnlyWhenAssigned = decided.every((b) => /subtraction/i.test(b.full) === (b.family === 'subtraction'));
    const recipeOnlyWhenOwned = decided.every((b) => /recipe/i.test(b.full) === false && (/\bcounter\b|\bgallery\b/i.test(b.full) === (b.grid !== null)));
    check('Subtraction is mentioned only where it is the ASSIGNED family (stated, never offered), and Counter / Gallery only where the authority owns that grid — no Subtraction selection rules or defaults in any open-gate prompt',
      subtractionOnlyWhenAssigned && recipeOnlyWhenOwned && decided.some((b) => b.family === 'subtraction') && !openBuilds.some((b) => /SUBTRACTION (RULES|DEFAULTS)/.test(b.full)));
    // The decision the prompt consumed is the one the WP4 log line reports.
    const logAgrees = openBuilds.every((b) => R.describeRouteAuthority(b.authority, 'shop-1').endsWith(`template=${b.authority.template} family=${b.family} grid=${b.grid ?? 'none'}`));
    check('the template, family and grid the prompt states are the ones the WP4 authority log line reports for the same authority', logAgrees);
  }

  console.log('\n[43] Phase 14 WP5 — gate OPEN, bounds parity: the bounds the prompt advertises are the bounds the build applies');
  {
    // The WP4 steps lifted a second time with ONE change to their scope: the
    // layout carrier records the bounds it is handed. So for an archetype on
    // a changed template the "applied" bounds below are the very object the
    // route's applyAssignedLook passed — not a recomputation of it.
    const handedBounds: LayoutBounds[] = [];
    let spied: RouteSteps | null = null;
    try {
      const scope: Record<string, unknown> = { ...WP4_SCOPE, applyGenerationLayout: (config: WebsiteConfig, layout: WebsiteLayout | null | undefined, bounds: LayoutBounds) => { handedBounds.push(bounds); return applyGenerationLayout(config, layout, bounds); } };
      spied = liftFragment<RouteSteps>(WP4_BLOCK, scope, [], ['routeAuthority', 'carryAuthority', 'applyAssignedLook', 'describeRouteAuthority'])();
    } catch {
      spied = null;
    }
    check('the WP4 steps lift a second time with a recording layout carrier in scope', spied !== null);

    const seenCases: Record<string, number> = { 'archetype on its own template': 0, 'archetype on a changed template': 0, 'no archetype': 0 };
    let parity = true;
    let textOk = true;
    let caseOk = true;
    let leversOk = true;
    let leverProbes = 0;
    let offender: unknown;
    const note = (what: string, b: OpenBuild, detail?: unknown): void => { offender = offender ?? { what, build: b.label, detail }; };
    const model: WebsiteGeneration = { ...GENERATION, template_key: 'vitality', layout: modelLayout('subtraction', 'gallery') };
    openBuilds.forEach((b, index) => {
      if (!spied) return;
      const advertised = S.assignedBuildBounds(b.authority, b.p.archetype);
      handedBounds.length = 0;
      const run4 = tailOf(b, model, spied);
      const which = run4.recomposed ? 'archetype on a changed template' : b.p.archetype ? 'archetype on its own template' : 'no archetype';
      seenCases[which] += 1;
      // The bounds the route applies, case by case.
      const applied: LayoutBounds | undefined =
        run4.recomposed ? handedBounds[handedBounds.length - 1]             // the object applyAssignedLook handed the carrier
        : b.p.archetype ? archetypeLayoutBounds(b.p.archetype)              // applyArchetype's own bounds (its last statement)
        : classicLayoutBounds(run4.config.template_key);                    // POST's `classicLayoutBounds(config.template_key)`, template pinned
      if (!applied || JSON.stringify(advertised.bounds) !== JSON.stringify(applied) || advertised.bounds.templateKey !== run4.config.template_key) { parity = false; note('bounds', b, { which, advertised: advertised.bounds, applied }); }
      if (run4.recomposed !== (handedBounds.length === 1) || advertised.bundleApplied !== (which === 'archetype on its own template')) { caseOk = false; note('case', b, { which, handed: handedBounds.length, bundleApplied: advertised.bundleApplied }); }
      // …and the text the model reads is those bounds, described by the route's own helper — one set, never the per-template list.
      const shown = section(b.sent.prompt, 'layout_bounds');
      if (!applied || shown !== H.describeLayoutBounds(applied) || b.sent.layoutBoundsText !== shown || shown.includes('IF template_key is')) { textOk = false; note('bounds text', b, shown.slice(0, 120)); }
      // Behaviour, lever by lever (a rotating third of the builds): what the
      // advertised bounds offer is honoured by the build, what they do not
      // offer is not.
      if (index % 3 !== 0) return;
      const build = (layout: WebsiteLayout): WebsiteConfig => tailOf(b, { ...GENERATION, template_key: 'editorial', layout }).config;
      const baseline = build({});
      for (let i = 0; i < ACCENT_PRESET_SLOTS; i += 1) {
        leverProbes += 1;
        const want = i < advertised.bounds.accentPresets.length ? advertised.bounds.accentPresets[i].hex : baseline.theme?.accent;
        const got = build({ theme_preset_index: i }).theme?.accent;
        if (got !== want) { leversOk = false; note('accent lever', b, { index: i, got, want }); }
      }
      for (const face of SITE_FONT_KEYS) {
        leverProbes += 1;
        const want = advertised.bounds.displayFonts.includes(face) ? face : baseline.theme?.display_font;
        const got = build({ display_font: face }).theme?.display_font;
        if (got !== want) { leversOk = false; note('face lever', b, { face, got, want }); }
      }
      leverProbes += 1;
      const carousel = build({ product_grid_display: 'carousel' }).blocks?.find((block) => block.type === 'product_grid')?.displayMode === 'carousel';
      if (carousel !== advertised.bounds.carouselHonored) { leversOk = false; note('carousel lever', b, { carousel, advertised: advertised.bounds.carouselHonored }); }
      // An advertised extra section, placed second, is seated there (the bundle path mints it).
      leverProbes += 1;
      const second = build({ block_order: ['hero_banner', 'split_cta', 'product_grid'] }).blocks?.[1]?.type;
      if ((second === 'split_cta') !== advertised.bounds.blockMix.includes('split_cta')) { leversOk = false; note('section lever', b, { second, mix: advertised.bounds.blockMix }); }
    });
    check(`all three cases are walked: archetype on its own template (${seenCases['archetype on its own template']}), archetype on a changed template (${seenCases['archetype on a changed template']}), no archetype (${seenCases['no archetype']}) — decisions and Classic floors alike`,
      seenCases['archetype on its own template'] > 100 && seenCases['archetype on a changed template'] > 100 && seenCases['no archetype'] > 100 && floored.length > 0, seenCases);
    check('the prompt step picks the case the route\'s tail picks: bundle bounds exactly when applyArchetype runs, composed bounds exactly when the assigned look is seated, classic bounds with no archetype', caseOk && spied !== null, offender);
    check(`ADVERTISED = APPLIED: the bounds object behind the prompt deep-equals the bounds the build applies — the archetype's own on its own template, composeVisualSystem(archetype, authority.template).bounds on a changed one (the object the route handed the carrier), classicLayoutBounds(authority.template) with none (${openBuilds.length} builds)`, parity && spied !== null, offender);
    check('the <layout_bounds> text the model reads — and the dry-run harness reports — is those applied bounds described by the route\'s own helper: one template\'s bounds, never the per-template "IF template_key is" list', textOk && spied !== null, offender);
    check(`behaviour agrees: every accent preset, every display face, the carousel and an extra section are honoured by the build exactly where the advertised bounds offer them (${leverProbes} lever probes through POST's tail)`, leversOk && leverProbes > 2000, offender ?? leverProbes);
    // Named: the three cases on one Counter merchant (Assignment pins Ritual).
    const counterMerchant = WP4_MERCHANTS[0][1];
    const boundsFor = (pathName: string) => {
      const p = WP5_PATHS.find((x) => x.name === pathName)!;
      const facts = routeFacts(counterMerchant, p, 'general', true);
      const authority = R.routeAuthority(true, facts.assignment, p.chosenTemplate ?? facts.heuristicTemplate)!;
      return { authority, out: S.assignedBuildBounds(authority, p.archetype) };
    };
    const own = boundsFor('studio/deep-luxury');
    const changed = boundsFor('studio/warm-editorial');
    const none = boundsFor('override/vitality');
    check('Counter merchant, Deep Luxury (a Ritual archetype) → the archetype\'s own bounds: its section mix with split_cta and testimonials, its accents, its faces',
      own.authority.template === 'ritual' && own.out.bundleApplied && JSON.stringify(own.out.bounds) === JSON.stringify(archetypeLayoutBounds(ARCHETYPES['deep-luxury'])) && own.out.bounds.blockMix.includes('split_cta') && own.out.bounds.serverGated.join() === 'testimonials');
    check('Counter merchant, Warm Editorial (an Editorial archetype) → Ritual\'s own section mix with the archetype\'s surviving accents and faces — no split_cta, no testimonials slot',
      changed.authority.template === 'ritual' && !changed.out.bundleApplied && JSON.stringify(changed.out.bounds) === JSON.stringify(composeVisualSystem(ARCHETYPES['warm-editorial'], 'ritual').bounds) &&
      changed.out.bounds.blockMix.join() === CLASSIC_BLOCK_MIX.join() && changed.out.bounds.accentPresets === ARCHETYPES['warm-editorial'].accentPresets && changed.out.bounds.serverGated.length === 0);
    check('Counter merchant, seller override "vitality", no archetype → Ritual\'s classic bounds (the assigned template\'s, not the seller\'s Vitality)',
      none.authority.template === 'ritual' && !none.out.bundleApplied && JSON.stringify(none.out.bounds) === JSON.stringify(classicLayoutBounds('ritual')) && JSON.stringify(none.out.bounds) !== JSON.stringify(classicLayoutBounds('vitality')));
  }

  console.log('\n[44] Phase 14 WP5 — gate OPEN, split_cta: requested only when the archetype bundle is actually applied');
  {
    const ASK = 'Write the split_cta object for this site';
    let agrees = true;
    let minted = true;
    let voiceOk = true;
    let asked = 0;
    let voiceOnly = 0;
    let offender: unknown;
    for (const b of openBuilds) {
      // GENERATION carries a split_cta, so a bundle that is applied mints the block.
      const run4 = tailOf(b, { ...GENERATION, template_key: 'editorial', layout: modelLayout('menu-occasion', 'masonry') });
      const bundleApplied = b.p.archetype !== null && !run4.recomposed;
      const asks = b.sent.prompt.includes(ASK);
      if (asks) asked += 1;
      // Outside <layout_bounds> (where the bundle's section mix lists the slot) the key is named by the request alone.
      const outsideBounds = b.sent.prompt.replace(section(b.sent.prompt, 'layout_bounds'), '');
      if (asks !== bundleApplied || count(outsideBounds, 'split_cta') !== (asks ? 1 : 0) || section(b.sent.prompt, 'layout_bounds').includes('split_cta') !== bundleApplied) { agrees = false; offender = offender ?? { build: b.label, asks, bundleApplied }; }
      const hasBlock = (run4.config.blocks ?? []).some((block) => block.type === 'split_cta');
      if (hasBlock !== asks) { minted = false; offender = offender ?? { build: b.label, asks, hasBlock }; }
      // The archetype's voice survives either way; only the bundle's spread does not.
      if (b.p.archetype) {
        const direction = section(b.sent.prompt, 'chosen_archetype');
        if (!direction.includes(`"${b.p.archetype.name}". ${b.p.archetype.vibe}\nVOICE: ${b.p.archetype.copyDirection}`)) { voiceOk = false; offender = offender ?? { build: b.label, what: 'voice' }; }
        if (!bundleApplied) voiceOnly += 1;
      }
    }
    check(`split_cta is requested in exactly the prompts whose build applies the archetype bundle — an archetype on the template Assignment kept (${asked} prompts) — and in no other: not on a changed template (${voiceOnly}), not without an archetype — and the split_cta slot is in the advertised section mix exactly where it is requested`, agrees && asked > 100 && voiceOnly > 100, offender);
    check('…and the build agrees: with a model that writes split_cta, the assembled config carries the block exactly where the prompt asked for it — never an unrequested spread, never a requested one dropped', minted, offender);
    check('an archetype on a changed template keeps its voice in the prompt (name, vibe, copy direction — the WP3 survival rule) and loses only the split_cta request', voiceOk, offender);
    check('the cached block keeps the rule the request depends on: split_cta is written ONLY when the user message asks for it', S.ASSIGNED_CACHED_SYSTEM.includes('- "split_cta"        : OPTIONAL — write it ONLY when the user\'s instructions ask for it.'));
    // Named: the same Counter merchant under a Ritual and an Editorial archetype.
    const promptFor = (pathName: string): string => openBuilds.find((b) => b.label === `merchant 0 / niche general / ${pathName}`)!.sent.prompt;
    check('Counter merchant: Deep Luxury (Ritual — bundle applied) is asked for split_cta; Warm Editorial (Editorial — look carried under Ritual) is not',
      promptFor('studio/deep-luxury').includes(ASK) && !promptFor('studio/warm-editorial').includes(ASK) && promptFor('studio/warm-editorial').includes('ARCHETYPE DIRECTION — the approved direction is "Warm Editorial".'));
  }

  console.log('\n[45] Phase 14 WP5 — the open-gate cached block: one byte-stable string, and no contradiction with the user message');
  {
    // Recorded when WP5 shipped. Any edit to the block — or to a constant it
    // interpolates — opens a new prompt-cache namespace, and must be made here on purpose.
    const OPEN_CACHED_SHA256 = '847340823e636a9ea6034ddf7c91dad479210b0c9fdd0bf5c235e20daeaaef07';
    const OPEN_CACHED_LENGTH = 8893;
    const block = S.ASSIGNED_CACHED_SYSTEM;
    const closedBlock = postPrompt(postPromptInputs(WP5_PATHS[0], WP5_REQUESTS[0], 'ritual', null)).executePrompt.cachedSystem;
    check(`every open-gate request is sent the SAME cached block — one string across ${openBuilds.length} prompts: every decision outcome, every floor, every path, seed, niche and bio`, openBuilds.length > 0 && openBuilds.every((b) => b.sent.cachedSystem === block) && block !== closedBlock);
    check('byte-stable: the block matches its recorded sha256 and length', sha256(block) === OPEN_CACHED_SHA256 && block.length === OPEN_CACHED_LENGTH, { digest: sha256(block), length: block.length });
    check('no per-request value reaches it: none of the shop, bio, niche, seed, featured, inventory or concept markers appears in the block (they all appear in the user message)',
      WP5_SENTINELS.every((marker) => !block.includes(marker)) && WP5_SENTINELS.every((marker) => openBuilds.some((b) => b.sent.prompt.includes(marker))), WP5_SENTINELS.filter((marker) => block.includes(marker)));
    // Structure: a module-level constant — built once, outside any function —
    // whose only interpolations are module constants.
    const declaration = sliceFrom(WP5_BLOCK, '\nconst ASSIGNED_CACHED_SYSTEM = `', '`;\n', true);
    const interpolations = [...new Set([...declaration.matchAll(/\$\{([^}]*)\}/g)].map((m) => m[1].trim()))].sort();
    check('no per-request interpolation is possible: the block is a module-level constant (declared at column 0, outside every function, assigned once) whose only interpolations are ELITE_COPY_RULES and ACCENT_PRESET_SLOTS',
      declaration.length > 0 && count(WP5_BLOCK, 'ASSIGNED_CACHED_SYSTEM =') === 1 && interpolations.join(' | ') === 'ACCENT_PRESET_SLOTS - 1 | ELITE_COPY_RULES' &&
      WP5_BLOCK.indexOf('\nconst ASSIGNED_CACHED_SYSTEM = `') < WP5_BLOCK.indexOf('\nfunction ') && count(WP5_BLOCK, 'cachedSystem: ASSIGNED_CACHED_SYSTEM') === 1, interpolations);
    // What the block must not say — it is sent at the Classic floor too.
    const blockNames = [...named(block, TEMPLATE_KEYS), ...named(block, STOREFRONT_FAMILIES), ...named(block, RECIPE_GRIDS)];
    check('the block names no template, no family and no recipe grid, lists no template catalog, and never mentions Subtraction or a recipe — those values arrive only in <assignment>',
      blockNames.length === 0 && !/subtraction|recipe|\bcounter\b|\bgallery\b/i.test(block) && !block.includes('AVAILABLE TEMPLATES') && asksToChoose(block) === null, blockNames);
    // What it must still say: everything of the pre-WP5 block that is not about ownership.
    const fieldSpec = (text: string): string[] => text.split('\n').filter((line) => /^- "(matrix_theme|brand_tokens|hero|value_props|product_grid|story|cta|seo|split_cta|layout)"/.test(line) || /^ {4}"(tagline|headline|subheadline|title|intro|block_order|product_grid_display|block_padding|block_align|theme_preset_index|display_font|layout_strategy)"/.test(line) || /^ {8}"hero" :/.test(line));
    const kept = fieldSpec(closedBlock);
    check(`nothing but ownership changed in the field spec: all ${kept.length} pre-WP5 spec lines for the copy fields and the model-owned levers (matrix_theme through display_font, the hero variant) are in the open block verbatim, with the copy rules and the brevity mandate`,
      kept.length >= 18 && kept.every((line) => block.includes(line)) && block.includes(ELITE_COPY_RULES) && block.includes('BREVITY MANDATE — BINDING FOR EVERY FIELD:') && block.includes('<system_context>') && block.includes('3. Zero-Clutter Integrity:') && block.includes('4. Matrix Routing & Brand Tokens:'),
      kept.filter((line) => !block.includes(line)));
    // Cached block ⇄ user message: each rule the block states has its fact in <assignment>.
    check('cached ⇄ dynamic, template: the block says to set template_key to the template <assignment> names; every user message names exactly one',
      block.includes('- "template_key"     : the template <assignment> names, verbatim — assigned, never chosen') && openBuilds.every((b) => count(b.sent.prompt, 'Set template_key to "') === 1));
    check('cached ⇄ dynamic, grid: the block says to write layout_strategy.grid ONLY when <assignment> marks the collection grid YOURS; every user message marks it exactly one way — FIXED or YOURS',
      block.includes('ONLY when <assignment> marks the collection grid as YOURS') && openBuilds.every((b) => count(b.sent.prompt, 'COLLECTION GRID — FIXED:') + count(b.sent.prompt, 'COLLECTION GRID — YOURS:') === 1) &&
      ['"masonry"', '"featured-first"', '"standard"'].every((value) => block.includes(value)));
    check('cached ⇄ dynamic, precedence: the block says <assignment> stands over a creative direction — and no approved-concept text in a user message names a template',
      block.includes('Where a creative direction in the user message and <assignment> differ, <assignment> stands.') &&
      openBuilds.filter((b) => b.p.concept).every((b) => named(section(b.sent.prompt, 'chosen_archetype'), TEMPLATE_KEYS).length === 0 && section(b.sent.prompt, 'chosen_archetype').includes('APPROVED CREATIVE DIRECTION')));
    check('the generation gate constant is still false, and the guard still strips both recipe grids — WP5 activated nothing',
      RITUAL_RECIPE_GENERATION_ENABLED === false && guardRecipeGridPick('counter', 'ritual') === undefined && guardRecipeGridPick('gallery', 'ritual') === undefined);
  }
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
