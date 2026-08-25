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
  WebsiteConfigSchema,
  blocksToLegacySite,
  legacySiteToBlocks,
  resolveBlocks,
  type WebsiteConfig,
} from '../lib/siteTemplates';

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
}

if (failures > 0) {
  console.error(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log('\nAll compatibility checks passed.');
