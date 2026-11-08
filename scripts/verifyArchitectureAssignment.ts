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
  assignArchitecture,
  describeArchitectureAssignment,
  guardRecipeGridPick,
  normalizeCategoryForAssignment,
  resolveRitualComposition,
  resolveRitualRecipe,
  type ArchitectureAssignment,
  type ArchitectureAssignmentInput,
  type HeroMedia,
  type SiteProduct,
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

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
