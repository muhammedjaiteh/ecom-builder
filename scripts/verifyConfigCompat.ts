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
}

if (failures > 0) {
  console.error(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log('\nAll compatibility checks passed.');
