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
// ─────────────────────────────────────────────────────────────────────────────

import {
  RITUAL_RECIPE_GENERATION_ENABLED,
  applyExpressionSelection,
  assignArchitecture,
  assignmentDecisionSource,
  describeArchitectureAssignment,
  formatArchitectureAssignment,
  formatExpressionSelection,
  groupCounterAisles,
  guardRecipeGridPick,
  isExpressionForArchitecture,
  normalizeCategoryForAssignment,
  resolveRitualComposition,
  resolveRitualRecipe,
  selectExpression,
  selectGalleryExhibits,
  type ArchitectureAssignment,
  type ArchitectureAssignmentInput,
  type ExpressionSignals,
  type HeroMedia,
  type SiteProduct,
  type WebsiteConfig,
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

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
