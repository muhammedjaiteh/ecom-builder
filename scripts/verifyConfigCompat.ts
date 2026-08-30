// ─────────────────────────────────────────────────────────────────────────────
// Phase-3 compatibility gate — proves the block-era WebsiteConfigSchema is a
// STRICT SUPERSET of the legacy schema (constraint A: no DB migration, every
// stored row must keep validating) and that the block adapters round-trip.
//
// Run (from repo root):
//   npx tsc scripts/verifyConfigCompat.ts lib/siteTemplates.ts --outDir .verify-compat \
//     --module commonjs --target es2020 --moduleResolution node --esModuleInterop --skipLibCheck
//   node .verify-compat/scripts/verifyConfigCompat.js
//
// Exits non-zero on any failure.
// ─────────────────────────────────────────────────────────────────────────────

import {
  ARCHETYPES,
  WebsiteConfigSchema,
  WebsiteGenerationSchema,
  applyArchetype,
  blocksToLegacySite,
  buildPreviousDesign,
  buildTestimonialsFromReviews,
  generationToConfig,
  legacySiteToBlocks,
  pickConceptArchetypes,
  resolveBlocks,
  resolveVisibleBlocks,
  type SiteBlock,
  type WebsiteConfig,
} from '../lib/siteTemplates';
import { judgeAccent, judgeThemeTokens, siteThemeVars } from '../lib/siteTheme';

let failures = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  PASS  ${name}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// Representative LEGACY row (pre-Phase-3): exactly the shape the original
// generator stored — no `blocks` key anywhere.
const legacyConfig = {
  template_key: 'ritual',
  niche_reasoning: 'Beauty inventory built on oils and serums suits the minimal ritual layout.',
  site: {
    tagline: 'Skin Rituals, Perfected',
    hero_headline: 'Skin Drinks Golden Light',
    hero_subheadline: 'Cold-pressed marula and baobab oils, blended in small batches for skin that keeps its glow.',
    brand_story: 'We started at a kitchen table with one bottle of marula oil and a belief: skincare should be food for the skin. Every batch is still blended by hand, poured in amber glass, and tested on nobody but ourselves.',
    value_props: [
      { title: 'Cold-Pressed Oils', body: 'Marula and baobab pressed within days of harvest, never heat-treated.' },
      { title: 'Small Batches', body: 'Blended weekly so every bottle reaches you months from expiry, not days.' },
      { title: 'Amber Glass Only', body: 'Light-proof bottles keep actives potent from first drop to last.' },
    ],
    collection_title: 'The Ritual Edit',
    collection_intro: 'Nine oils and serums, each one a single step in a routine that takes minutes and lasts all day.',
    cta_banner: {
      headline: 'Your Skin Remembers Ritual',
      subtext: 'Order before noon and your ritual ships the same day, wrapped in kraft and string.',
      button_label: 'Begin The Ritual',
    },
    seo: {
      title: 'Golden Ritual Oils — Small-Batch Skincare',
      description: 'Cold-pressed marula and baobab skincare, blended in small batches. Delivery and pickup available.',
    },
  },
};

// NEW row: the same copy carried as blocks + mirror, exactly as the Phase-3
// generator/content API store it.
const legacyParsedForBlocks = WebsiteConfigSchema.parse(legacyConfig);
const newConfig = {
  ...legacyConfig,
  blocks: legacySiteToBlocks(legacyParsedForBlocks.site),
};

console.log('WebsiteConfigSchema superset checks:');

const legacyResult = WebsiteConfigSchema.safeParse(legacyConfig);
check('legacy config (no blocks) validates', legacyResult.success,
  legacyResult.success ? undefined : JSON.stringify(legacyResult.error.issues));

const newResult = WebsiteConfigSchema.safeParse(newConfig);
check('new config (with blocks) validates', newResult.success,
  newResult.success ? undefined : JSON.stringify(newResult.error.issues));

if (legacyResult.success && newResult.success) {
  console.log('Adapter checks:');

  // resolveBlocks on a legacy row = deterministic default projection.
  const projected = resolveBlocks(legacyResult.data);
  check('legacy resolveBlocks yields 5 blocks', projected.length === 5, `got ${projected.length}`);
  check(
    'legacy resolveBlocks ids/order are hero,values,grid,story,cta',
    JSON.stringify(projected.map((b) => b.id)) === JSON.stringify(['hero', 'values', 'grid', 'story', 'cta'])
  );

  // resolveBlocks on a new row = the stored blocks, untouched.
  const stored = resolveBlocks(newResult.data);
  check('new resolveBlocks returns stored blocks', stored === newResult.data.blocks);

  // Round trip: site → blocks → site must be copy-identical (seo preserved).
  const roundTripped = blocksToLegacySite(projected, legacyResult.data.site);
  check(
    'site → blocks → site round-trips identically',
    JSON.stringify(roundTripped) === JSON.stringify(legacyResult.data.site)
  );

  // Purity: the round trip must not have mutated the parsed site.
  const reParsed = WebsiteConfigSchema.parse(legacyConfig);
  check(
    'adapters are pure (input site unmutated)',
    JSON.stringify(legacyResult.data.site) === JSON.stringify(reParsed.site)
  );

  // Optional-tagline path: a hero block without a tagline keeps the mirror's
  // existing tagline (the editor's empty-tagline delete semantics rely on it).
  const noTaglineBlocks = projected.map((b) =>
    b.type === 'hero_banner' ? { ...b, tagline: undefined } : b
  ) as typeof projected;
  const noTaglineParse = WebsiteConfigSchema.safeParse({ ...legacyConfig, blocks: noTaglineBlocks });
  check('hero block without tagline still validates', noTaglineParse.success,
    noTaglineParse.success ? undefined : JSON.stringify(noTaglineParse.error.issues));
  const mirrored = blocksToLegacySite(noTaglineBlocks, legacyResult.data.site);
  check('missing hero tagline preserves the mirror tagline', mirrored.tagline === legacyResult.data.site.tagline);

  // Negative control: a block field over its budget must FAIL (limits match
  // the site.* counterparts, so copy always round-trips through validation).
  const oversized: WebsiteConfig = {
    ...legacyResult.data,
    blocks: projected.map((b) =>
      b.type === 'cta_banner' ? { ...b, button_label: 'x'.repeat(41) } : b
    ),
  };
  check('over-budget block field is rejected', !WebsiteConfigSchema.safeParse(oversized).success);

  // ── Premium Visual Editor: config.assets superset checks ─────────────────
  console.log('Assets superset checks:');

  // A row carrying the new OPTIONAL assets object must validate…
  const assetsConfig = {
    ...newConfig,
    assets: {
      logo_url: 'https://cdn.example.com/brand/site-assets/shop-1/logo-1700000000000.png',
      hero_image_url: 'https://cdn.example.com/brand/site-assets/shop-1/hero-1700000000000.jpg',
      generated_at: '2026-08-20T12:00:00.000Z',
    },
  };
  const assetsResult = WebsiteConfigSchema.safeParse(assetsConfig);
  check('config with assets validates', assetsResult.success,
    assetsResult.success ? undefined : JSON.stringify(assetsResult.error.issues));

  // …a PARTIAL assets object validates (every key optional; {} is the
  // editor's cleared-slots form)…
  check('partial assets object validates',
    WebsiteConfigSchema.safeParse({ ...newConfig, assets: { hero_image_url: 'https://cdn.example.com/h.jpg' } }).success);
  check('empty assets object validates',
    WebsiteConfigSchema.safeParse({ ...newConfig, assets: {} }).success);

  // …and assets never leak into the block/site model: resolveBlocks output is
  // identical with or without the key.
  if (assetsResult.success) {
    check(
      'assets do not perturb resolveBlocks',
      JSON.stringify(resolveBlocks(assetsResult.data)) === JSON.stringify(resolveBlocks(newResult.data))
    );
  }

  // Negative control: a non-URL asset value must FAIL.
  check('non-URL asset value is rejected',
    !WebsiteConfigSchema.safeParse({ ...newConfig, assets: { logo_url: 'not-a-url' } }).success);

  // ── Customize cockpit: config.theme superset checks ──────────────────────
  console.log('Theme superset checks:');

  // A row carrying the new OPTIONAL theme object must validate…
  const themedConfig = {
    ...newConfig,
    theme: { accent: '#1a2e1a', display_font: 'lora' },
  };
  const themedResult = WebsiteConfigSchema.safeParse(themedConfig);
  check('config with theme validates', themedResult.success,
    themedResult.success ? undefined : JSON.stringify(themedResult.error.issues));

  // …a PARTIAL theme validates (each key optional; {} is the cockpit's
  // cleared form), on both legacy (no blocks) and block-carrying rows…
  check('accent-only theme validates',
    WebsiteConfigSchema.safeParse({ ...newConfig, theme: { accent: '#8a3412' } }).success);
  check('font-only theme validates',
    WebsiteConfigSchema.safeParse({ ...newConfig, theme: { display_font: 'bodoni' } }).success);
  check('empty theme object validates',
    WebsiteConfigSchema.safeParse({ ...newConfig, theme: {} }).success);
  check('legacy config (no blocks) + theme validates',
    WebsiteConfigSchema.safeParse({ ...legacyConfig, theme: { accent: '#1e3a5f' } }).success);
  check('theme + assets coexist',
    WebsiteConfigSchema.safeParse({
      ...newConfig,
      assets: { hero_image_url: 'https://cdn.example.com/h.jpg' },
      theme: { accent: '#5f1a1a', display_font: 'fraunces' },
    }).success);

  // …and theme never leaks into the block/site model: resolveBlocks output is
  // identical with or without the key.
  if (themedResult.success) {
    check(
      'theme does not perturb resolveBlocks',
      JSON.stringify(resolveBlocks(themedResult.data)) === JSON.stringify(resolveBlocks(newResult.data))
    );
  }

  // Negative controls: malformed accents and unknown fonts must FAIL (the
  // accent lands in a style attribute — the hex regex is the injection gate).
  check('non-hex accent is rejected',
    !WebsiteConfigSchema.safeParse({ ...newConfig, theme: { accent: 'red' } }).success);
  check('3-digit hex accent is rejected',
    !WebsiteConfigSchema.safeParse({ ...newConfig, theme: { accent: '#fff' } }).success);
  check('css-injection accent is rejected',
    !WebsiteConfigSchema.safeParse({ ...newConfig, theme: { accent: '#123456; background:url(x)' } }).success);
  check('unknown display_font is rejected',
    !WebsiteConfigSchema.safeParse({ ...newConfig, theme: { display_font: 'comic-sans' } }).success);

  // ── Phase 8: value_props 2–4 window (relaxed from exactly-3) ─────────────
  console.log('value_props 2-4 window checks:');

  const withProps = (n: number) => ({
    ...legacyConfig,
    site: {
      ...legacyConfig.site,
      value_props: Array.from({ length: n }, (_, i) => ({
        title: `Signal ${i + 1}`,
        body: `Benefit ${i + 1}, stated in one tight sentence well under the field budget.`,
      })),
    },
  });

  // The stored population holds exactly 3 — the superset law demands it stays
  // valid; the new window admits 2 and 4 and rejects everything outside.
  check('legacy exactly-3 row still validates', WebsiteConfigSchema.safeParse(withProps(3)).success);
  check('2-prop config validates', WebsiteConfigSchema.safeParse(withProps(2)).success);
  check('4-prop config validates', WebsiteConfigSchema.safeParse(withProps(4)).success);
  check('1-prop config is rejected', !WebsiteConfigSchema.safeParse(withProps(1)).success);
  check('5-prop config is rejected', !WebsiteConfigSchema.safeParse(withProps(5)).success);

  // Block-carrying rows across the window validate, and the adapters stay
  // TOTAL: site → blocks → site round-trips identically for 2, 3, and 4.
  for (const n of [2, 3, 4]) {
    const parsedN = WebsiteConfigSchema.parse(withProps(n));
    const blocksN = legacySiteToBlocks(parsedN.site);
    check(
      `${n}-prop blocks validate`,
      WebsiteConfigSchema.safeParse({ ...withProps(n), blocks: blocksN }).success
    );
    const roundN = blocksToLegacySite(blocksN, parsedN.site);
    check(
      `${n}-prop mirrors round-trip identically`,
      JSON.stringify(roundN) === JSON.stringify(parsedN.site)
    );
  }

  // ── Shopify-engine Item 2: hidden?: boolean superset checks ──────────────
  console.log('Hidden-block superset checks:');

  // A hidden-bearing row validates on every variant position…
  const hiddenBlocks = projected.map((b) =>
    b.type === 'story_text' ? { ...b, hidden: true } : b
  );
  const hiddenResult = WebsiteConfigSchema.safeParse({ ...legacyConfig, blocks: hiddenBlocks });
  check('config with a hidden block validates', hiddenResult.success,
    hiddenResult.success ? undefined : JSON.stringify(hiddenResult.error.issues));
  check('hidden on every variant validates',
    WebsiteConfigSchema.safeParse({
      ...legacyConfig,
      blocks: projected.map((b) => ({ ...b, hidden: true })),
    }).success);
  check('hidden: false also validates (non-canonical but legal)',
    WebsiteConfigSchema.safeParse({
      ...legacyConfig,
      blocks: projected.map((b) => (b.type === 'cta_banner' ? { ...b, hidden: false } : b)),
    }).success);

  if (hiddenResult.success) {
    // resolveBlocks is UNPERTURBED (the editor keeps seeing hidden blocks)…
    const full = resolveBlocks(hiddenResult.data);
    check('resolveBlocks keeps hidden blocks', full.length === 5,
      `got ${full.length}`);
    // …resolveVisibleBlocks is the render projection that skips them…
    const visible = resolveVisibleBlocks(hiddenResult.data);
    check('resolveVisibleBlocks skips hidden blocks',
      visible.length === 4 && !visible.some((b) => b.type === 'story_text'));
    // …and the mirror is a CONTENT store: a hidden block still mirrors its
    // copy (hide → un-hide is lossless; legacy consumers keep their copy).
    const mirroredHidden = blocksToLegacySite(hiddenResult.data.blocks!, legacyResult.data.site);
    check('hidden blocks still mirror into site.*',
      mirroredHidden.brand_story === legacyResult.data.site.brand_story);
    check('hidden-bearing mirrors round-trip identically',
      JSON.stringify(mirroredHidden) === JSON.stringify(legacyResult.data.site));
  }

  // Negative control: a non-boolean hidden must FAIL.
  check('non-boolean hidden is rejected',
    !WebsiteConfigSchema.safeParse({
      ...legacyConfig,
      blocks: projected.map((b) => (b.type === 'story_text' ? { ...b, hidden: 'yes' } : b)),
    }).success);

  // ── Shopify-engine Item 5: config.previous (the snapshot ritual) ─────────
  console.log('Previous-design (snapshot ritual) checks:');

  // Two distinct designs: A = the legacy ritual row (as blocks), B = a
  // "regenerated" design with a different headline.
  const configA = WebsiteConfigSchema.parse({
    ...legacyConfig,
    blocks: legacySiteToBlocks(legacyParsedForBlocks.site),
  });
  const siteB = { ...legacyParsedForBlocks.site, hero_headline: 'A Regenerated Opening' };
  const configB = WebsiteConfigSchema.parse({
    ...legacyConfig,
    site: siteB,
    blocks: legacySiteToBlocks(siteB),
  });

  // Execute-step write: B upserts wholesale carrying previous = snapshot(A).
  const snapA = buildPreviousDesign(configA);
  check('buildPreviousDesign produces a snapshot', snapA !== null);
  const regenParse = WebsiteConfigSchema.safeParse({ ...configB, previous: snapA });
  check('previous-bearing config validates', regenParse.success,
    regenParse.success ? undefined : JSON.stringify(regenParse.error.issues));

  // Lax law: partial and junk-key snapshots must NEVER fail requireSite —
  // the snapshot is a backup, not a service contract.
  check('partial previous validates',
    WebsiteConfigSchema.safeParse({ ...configB, previous: { saved_at: '2026-08-29T00:00:00.000Z' } }).success);
  check('junk-key previous validates',
    WebsiteConfigSchema.safeParse({ ...configB, previous: { some_future_field: { nested: true } } }).success);
  check('legacy row (no previous) still validates',
    WebsiteConfigSchema.safeParse(legacyConfig).success);
  // The only malformation rejected: a non-object previous (never written by
  // any writer — buildPreviousDesign returns null for non-objects).
  check('non-object previous is rejected',
    !WebsiteConfigSchema.safeParse({ ...configB, previous: 'yesterday' }).success);
  check('buildPreviousDesign refuses non-objects', buildPreviousDesign('yesterday') === null);

  if (regenParse.success && snapA) {
    // previous never leaks into the render model…
    check('previous does not perturb resolveBlocks',
      JSON.stringify(resolveBlocks(regenParse.data)) === JSON.stringify(resolveBlocks(configB)));
    // …and zod keeps the DECLARED snapshot through a content-API-style
    // reparse (an undeclared key would be silently stripped on every save).
    // Compared per key — zod re-orders keys to schema order, which is
    // serialization cosmetics, not content.
    const reparsedPrev = regenParse.data.previous as Record<string, unknown>;
    const originalPrev = snapA as Record<string, unknown>;
    check('reparse preserves the snapshot',
      Object.keys(originalPrev).length === Object.keys(reparsedPrev).length &&
        Object.keys(originalPrev).every(
          (k) => JSON.stringify(reparsedPrev[k]) === JSON.stringify(originalPrev[k])
        ));

    // The restore route's swap, simulated exactly: strict-parse the
    // snapshot (nested previous dropped defensively), outgoing → previous.
    const restore = (stored: WebsiteConfig): WebsiteConfig => {
      const candidate = { ...(stored.previous as Record<string, unknown>) };
      delete candidate.previous;
      const parsed = WebsiteConfigSchema.parse(candidate);
      const outgoing = buildPreviousDesign(stored)!;
      return { ...parsed, previous: outgoing };
    };
    const stripPrevious = (c: WebsiteConfig) => {
      const rest = { ...c };
      delete rest.previous;
      return rest;
    };

    const restoredOnce = restore(regenParse.data);
    check('restored config validates strictly', WebsiteConfigSchema.safeParse(restoredOnce).success);
    check('restore brings design A back',
      restoredOnce.site.hero_headline === configA.site.hero_headline);
    check('restore snapshot is non-recursive',
      !('previous' in (restoredOnce.previous as Record<string, unknown>)));

    // Reversibility: restoring AGAIN round-trips design B exactly.
    const restoredTwice = restore(restoredOnce);
    check('double restore round-trips design B',
      JSON.stringify(stripPrevious(restoredTwice)) === JSON.stringify(stripPrevious(configB)));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PILLAR 3 — archetype pass: new block types + honest testimonial seeding.
// ─────────────────────────────────────────────────────────────────────────────
console.log('Archetype block-type checks (Pillar 3):');

const legacyParsedP3 = WebsiteConfigSchema.parse(legacyConfig);
const baseBlocksP3 = legacySiteToBlocks(legacyParsedP3.site);

const testimonialsBlock: SiteBlock = {
  id: 'testimonials',
  type: 'testimonials',
  title: 'In Their Words',
  items: [
    { quote: 'The serum arrived in two days and my skin has never felt calmer.', author: 'Fatou · Verified Purchase' },
    { quote: 'Beautiful packaging, honest sizing, and the oil smells incredible.', author: 'Verified buyer' },
  ],
};
const splitCtaBlock: SiteBlock = {
  id: 'split-cta',
  type: 'split_cta',
  headline: 'Made To Be Kept',
  body: 'Cold-pressed oils in amber glass — blended weekly, delivered fast.',
  button_label: 'Explore The Collection',
};

check('config with testimonials + split_cta validates',
  WebsiteConfigSchema.safeParse({ ...legacyConfig, blocks: [...baseBlocksP3, testimonialsBlock, splitCtaBlock] }).success);
check('testimonials below 2 quotes is rejected',
  !WebsiteConfigSchema.safeParse({
    ...legacyConfig,
    blocks: [...baseBlocksP3, { ...testimonialsBlock, items: testimonialsBlock.type === 'testimonials' ? testimonialsBlock.items.slice(0, 1) : [] }],
  }).success);
check('testimonials above 6 quotes is rejected',
  !WebsiteConfigSchema.safeParse({
    ...legacyConfig,
    blocks: [...baseBlocksP3, {
      ...testimonialsBlock,
      items: Array.from({ length: 7 }, (_, i) => ({ quote: `A real quote number ${i + 1} with substance.`, author: 'Verified buyer' })),
    }],
  }).success);

// The mirror stays TOTAL: new types have no site.* counterpart and fall
// through blocksToLegacySite untouched.
const mirroredWithNew = blocksToLegacySite([...baseBlocksP3, testimonialsBlock, splitCtaBlock], legacyParsedP3.site);
check('new types do not perturb the site.* mirror',
  JSON.stringify(mirroredWithNew) === JSON.stringify(legacyParsedP3.site));

// Honest seeding: quotes come only from qualifying reviews; too few → null.
const seeded = buildTestimonialsFromReviews([
  { rating: 5, comment: 'Absolutely stunning craftsmanship, worth every dalasi.', reviewer_name: 'Awa', verified_purchase: true },
  { rating: 4, comment: 'Fast delivery and the fit is exactly as described.', reviewer_name: null, external_author: 'Instagram' },
  { rating: 2, comment: 'Not for me.', reviewer_name: 'X' },
  { rating: 5, comment: 'ok', reviewer_name: 'Y' },
]);
check('review seeding builds a valid block from qualifying reviews',
  seeded !== null && seeded.items.length === 2 &&
  WebsiteConfigSchema.safeParse({ ...legacyConfig, blocks: [...baseBlocksP3, seeded] }).success);
check('review seeding refuses to fabricate (0 reviews → no block)',
  buildTestimonialsFromReviews([]) === null);
check('review seeding refuses thin evidence (1 quote → no block)',
  buildTestimonialsFromReviews([
    { rating: 5, comment: 'One glowing sentence about the product quality.', reviewer_name: 'Solo' },
  ]) === null);

// ── Full archetype assembly: generation → applyArchetype → strict validation
console.log('Archetype assembly checks:');

const generationSample = WebsiteGenerationSchema.parse({
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

for (const key of Object.keys(ARCHETYPES) as Array<keyof typeof ARCHETYPES>) {
  const archetype = ARCHETYPES[key];
  const assembled = applyArchetype(
    generationToConfig(generationSample),
    archetype,
    generationSample,
    [
      { rating: 5, comment: 'Absolutely stunning craftsmanship, worth every dalasi.', reviewer_name: 'Awa', verified_purchase: true },
      { rating: 5, comment: 'Fast delivery and the glow is real — my third order.', reviewer_name: 'Mariama' },
    ]
  );
  const parsedAssembled = WebsiteConfigSchema.safeParse(assembled);
  check(`archetype "${key}" assembly validates strictly`, parsedAssembled.success,
    parsedAssembled.success ? undefined : JSON.stringify(parsedAssembled.error.issues).slice(0, 300));
  check(`archetype "${key}" pins its base template`, assembled.template_key === archetype.template_key);
  check(`archetype "${key}" blocks follow its blockMix order`,
    JSON.stringify((assembled.blocks ?? []).map((b) => b.type)) === JSON.stringify(archetype.blockMix));
  // WCAG guard: every shipped preset must clear its own cockpit gates.
  const accentVerdict = archetype.theme.accent ? judgeAccent(archetype.template_key, archetype.theme.accent) : null;
  check(`archetype "${key}" accent clears the CTA-label guard`,
    accentVerdict !== null && !accentVerdict.blocked,
    accentVerdict ? `label ${accentVerdict.vsLabel.toFixed(2)}:1` : 'unparsable accent');
  const tokenVerdict = judgeThemeTokens(archetype.template_key, archetype.theme);
  check(`archetype "${key}" text/background clears 4.5:1`,
    tokenVerdict !== null && !tokenVerdict.textBlocked,
    tokenVerdict ? `text ${tokenVerdict.textOnBg.toFixed(2)}:1` : 'unparsable tokens');
}

// Deterministic variety: the pick is stable per shop and varies across shops.
const pickA = pickConceptArchetypes('11111111-1111-4111-8111-111111111111', 'skincare');
const pickA2 = pickConceptArchetypes('11111111-1111-4111-8111-111111111111', 'skincare');
check('archetype pick is deterministic per shop',
  pickA[0].key === pickA2[0].key && pickA[1].key === pickA2[1].key);
check('archetype pick pitches two different bundles', pickA[0].key !== pickA[1].key);
const variedPair = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((c) =>
  pickConceptArchetypes(`${c}${c}${c}${c}${c}${c}${c}${c}-0000-4000-8000-000000000000`, 'skincare')[0].key
);
check('archetype pick varies across shop ids', new Set(variedPair).size > 1, variedPair.join(','));

// ─────────────────────────────────────────────────────────────────────────────
// PILLAR 4 — token cascade + inspector depth supersets.
// ─────────────────────────────────────────────────────────────────────────────
console.log('Theme-token superset checks (Pillar 4):');

check('full token theme validates',
  WebsiteConfigSchema.safeParse({
    ...legacyConfig,
    theme: { accent: '#7a5c33', display_font: 'bodoni', primary: '#1d1a15', background: '#12100d', text: '#e8e2d6', button_radius: 'sharp', sticky_nav: false },
  }).success);
check('partial token theme validates (radius only)',
  WebsiteConfigSchema.safeParse({ ...legacyConfig, theme: { button_radius: 'pill' } }).success);
check('sticky_nav-only theme validates',
  WebsiteConfigSchema.safeParse({ ...legacyConfig, theme: { sticky_nav: false } }).success);
check('legacy accent+font theme still validates',
  WebsiteConfigSchema.safeParse({ ...legacyConfig, theme: { accent: '#1a2e1a', display_font: 'lora' } }).success);
check('non-hex primary is rejected',
  !WebsiteConfigSchema.safeParse({ ...legacyConfig, theme: { primary: 'charcoal' } }).success);
check('css-injection background is rejected',
  !WebsiteConfigSchema.safeParse({ ...legacyConfig, theme: { background: '#123456; background:url(x)' } }).success);
check('unknown button_radius is rejected',
  !WebsiteConfigSchema.safeParse({ ...legacyConfig, theme: { button_radius: 'circle' } }).success);
check('non-boolean sticky_nav is rejected',
  !WebsiteConfigSchema.safeParse({ ...legacyConfig, theme: { sticky_nav: 'yes' } }).success);

// The var seam: full tokens emit every variable (muted derived from text/bg);
// a theme-less config emits nothing (byte-identical law).
const fullVars = siteThemeVars({
  template_key: 'ritual',
  theme: { accent: '#7a5c33', primary: '#1d1a15', background: '#12100d', text: '#e8e2d6', button_radius: 'sharp' },
} as Pick<WebsiteConfig, 'theme' | 'template_key'>);
check('siteThemeVars emits the full token set (+ derived muted)',
  fullVars !== null &&
  ['--site-accent', '--site-primary', '--site-bg', '--site-text', '--site-muted', '--site-radius'].every((k) => Boolean(fullVars[k])));
check('siteThemeVars emits nothing for a theme-less config',
  siteThemeVars({ template_key: 'ritual', theme: undefined } as Pick<WebsiteConfig, 'theme' | 'template_key'>) === null);

console.log('Inspector-depth superset checks (Pillar 4):');

const paddedBlocks = baseBlocksP3.map((b) =>
  b.type === 'product_grid' ? { ...b, padding: 'spacious' as const, align: 'left' as const } : b
);
check('padding/align on a classic block validates',
  WebsiteConfigSchema.safeParse({ ...legacyConfig, blocks: paddedBlocks }).success);
check('padding/align on EVERY variant validates',
  WebsiteConfigSchema.safeParse({
    ...legacyConfig,
    blocks: [...baseBlocksP3.map((b) => ({ ...b, padding: 'compact' as const, align: 'center' as const })), { ...testimonialsBlock, padding: 'spacious' as const }, { ...splitCtaBlock, align: 'left' as const }],
  }).success);
check('unknown padding value is rejected',
  !WebsiteConfigSchema.safeParse({
    ...legacyConfig,
    blocks: baseBlocksP3.map((b) => (b.type === 'story_text' ? { ...b, padding: 'huge' } : b)),
  }).success);
check('unknown align value is rejected',
  !WebsiteConfigSchema.safeParse({
    ...legacyConfig,
    blocks: baseBlocksP3.map((b) => (b.type === 'cta_banner' ? { ...b, align: 'right' } : b)),
  }).success);
check('padding/align do not perturb the site.* mirror',
  JSON.stringify(blocksToLegacySite(paddedBlocks, legacyParsedP3.site)) === JSON.stringify(legacyParsedP3.site));
check('legacy row (no new keys anywhere) STILL validates untouched',
  WebsiteConfigSchema.safeParse(legacyConfig).success);

if (failures > 0) {
  console.error(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log('\nAll compatibility checks passed.');
