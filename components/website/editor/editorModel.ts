import {
  BLOCK_SETTINGS,
  SiteBlockSchema,
  type BlockGroupSetting,
  type BlockSettingDescriptor,
  type SiteBlock,
  type SiteBlockType,
} from '@/lib/siteTemplates';
import { z } from 'zod';
import type { VideoHeroSelection } from '@/components/website/VideoHeroPicker';

// ─────────────────────────────────────────────────────────────────────────────
// Editor model — the PURE core of the Site Editor, shared by the split-screen
// shell (SiteCopyEditor), the section rail (SectionRail), and the mobile
// sheets. No React here: field budgets, block field access, commit semantics,
// section labels, and the block builders. Since the Shopify-engine pass this
// module DERIVES its field tables from BLOCK_SETTINGS (lib/siteTemplates.ts)
// — the registry is the single source of truth, so the inspector, the sheet
// budgets, and the zod gates can never disagree.
// ─────────────────────────────────────────────────────────────────────────────

export type FieldMeta = { label: string; max: number; multiline: boolean };

// Field paths normalized with `*` for array indices ("items.0.title" →
// "items.*.title"). Derived from BLOCK_SETTINGS — budgets flow from
// SITE_COPY_LIMITS through the registry, the same constants the zod schemas
// are built from, so the counter can never disagree with the validation gate.
function buildFieldMeta(): Record<string, FieldMeta> {
  const meta: Record<string, FieldMeta> = {};
  for (const [type, descriptors] of Object.entries(BLOCK_SETTINGS)) {
    for (const d of descriptors) {
      if (d.kind === 'text' || d.kind === 'textarea') {
        meta[`${type}:${d.path}`] = { label: d.label, max: d.maxChars, multiline: d.kind === 'textarea' };
      } else if (d.kind === 'repeatable-group') {
        for (const f of d.fields) {
          meta[`${type}:${d.path}.*.${f.path}`] = { label: f.label, max: f.maxChars, multiline: f.kind === 'textarea' };
        }
      }
    }
  }
  return meta;
}

export const FIELD_META: Record<string, FieldMeta> = buildFieldMeta();

// PUT /api/websites/content rejects payloads beyond 12 blocks — the add
// buttons disable at the same ceiling so a save can never bounce on length.
export const MAX_BLOCKS = 12;

/** Section labels for the tree + the mobile settings sheet. */
export const SECTION_LABELS: Record<SiteBlockType, string> = {
  hero_banner: 'Hero banner',
  value_props: 'Value props',
  product_grid: 'Collection',
  story_text: 'Brand story',
  cta_banner: 'Closing banner',
  product_tabs: 'Product tabs',
  video_hero: 'Brand film',
};

// ─────────────────────────────────────────────────────────────────────────────
// Full add catalog (Shopify-engine Item 2): every block type is addable —
// hero/cta duplicates included (renderers map over blocks in array order).
// The Phase-4 "seller-added only" contract is retired; MAX_BLOCKS stays the
// only ceiling. Descriptions feed the add-bar and the mobile add sheet.
// ─────────────────────────────────────────────────────────────────────────────

export const SECTION_CATALOG: ReadonlyArray<{ type: SiteBlockType; description: string }> = [
  { type: 'hero_banner', description: 'A bold opening banner — headline, support line, and CTAs' },
  { type: 'value_props', description: 'Trust points that ride the moving brand banner' },
  { type: 'product_grid', description: 'Your live products, as a grid or a carousel' },
  { type: 'story_text', description: 'A brand-story passage in your own voice' },
  { type: 'cta_banner', description: 'A dark closing banner with one clear call to action' },
  { type: 'product_tabs', description: 'Details, delivery and returns in tidy tabs' },
  { type: 'video_hero', description: 'A cinematic Ad Studio commercial on your page' },
];

/** REMOVE GUARD: everything is removable EXCEPT the last product_grid — a
 *  store without its collection is a broken store (the hero CTAs and nav all
 *  anchor to it). A second grid makes either one removable until one is left;
 *  hidden grids still count (they exist and can be un-hidden). */
export function canRemoveBlock(blocks: SiteBlock[], blockId: string): boolean {
  const block = blocks.find((b) => b.id === blockId);
  if (!block) return false;
  if (block.type !== 'product_grid') return true;
  return blocks.filter((b) => b.type === 'product_grid').length > 1;
}

export const REMOVE_GUARD_HINT =
  'Your store needs its product collection — every other section can be removed.';

/** Visibility toggle (Item 2). Un-hiding DELETES the key — the canonical
 *  absent form, so a hide→show round trip leaves the block byte-identical
 *  and legacy rows never grow a redundant `hidden: false`. */
export function toggleBlockHidden(blocks: SiteBlock[], blockId: string): SiteBlock[] {
  return blocks.map((b) => {
    if (b.id !== blockId) return b;
    if (b.hidden) {
      const next = { ...b };
      delete next.hidden;
      return next;
    }
    return { ...b, hidden: true };
  });
}

// Fields that may legitimately end EMPTY (key removed) — derived from the
// registry's `optional` flags (hero tagline, film copy); every other field
// is zod min(1). Group fields are never optional (array items are required
// whole objects).
function buildOptionalFieldKeys(): Set<string> {
  const keys = new Set<string>();
  for (const [type, descriptors] of Object.entries(BLOCK_SETTINGS)) {
    for (const d of descriptors) {
      if ((d.kind === 'text' || d.kind === 'textarea') && d.optional) {
        keys.add(`${type}:${d.path}`);
      }
    }
  }
  return keys;
}

const OPTIONAL_FIELD_KEYS = buildOptionalFieldKeys();

export function normalizeFieldPath(field: string): string {
  return field.replace(/\.\d+\./g, '.*.');
}

export function fieldMetaFor(type: SiteBlockType, path: string[]): FieldMeta | undefined {
  return FIELD_META[`${type}:${normalizeFieldPath(path.join('.'))}`];
}

export function isOptionalField(type: SiteBlockType, path: string[]): boolean {
  return OPTIONAL_FIELD_KEYS.has(`${type}:${normalizeFieldPath(path.join('.'))}`);
}

export type EditorField = {
  path: string[];
  meta: FieldMeta;
  optional: boolean;
};

/** Current item count of a repeatable group (0 when the path is not an
 *  array — cannot happen for schema-valid blocks, guarded anyway). */
export function groupItemCount(block: SiteBlock, groupPath: string): number {
  const arr = (block as unknown as Record<string, unknown>)[groupPath];
  return Array.isArray(arr) ? arr.length : 0;
}

/** The ordered, editable copy fields ONE descriptor contributes for a block
 *  (text/textarea → one field; repeatable-group → fields per current item;
 *  select/image/video → none — they are controls, not copy). */
export function descriptorFields(block: SiteBlock, d: BlockSettingDescriptor): EditorField[] {
  if (d.kind === 'text' || d.kind === 'textarea') {
    return [{
      path: d.path.split('.'),
      meta: { label: d.label, max: d.maxChars, multiline: d.kind === 'textarea' },
      optional: d.optional === true,
    }];
  }
  if (d.kind === 'repeatable-group') {
    const out: EditorField[] = [];
    for (let i = 0; i < groupItemCount(block, d.path); i += 1) {
      for (const f of d.fields) {
        out.push({
          path: [d.path, String(i), f.path],
          meta: { label: f.label, max: f.maxChars, multiline: f.kind === 'textarea' },
          optional: false,
        });
      }
    }
    return out;
  }
  return [];
}

/** The ordered, editable copy fields of a block — ONE registry-driven
 *  derivation consumed by the inspector (inline inputs), the mobile controls
 *  list (sheet rows), and the canvas→inspector focus bridge. */
export function fieldsForBlock(block: SiteBlock): EditorField[] {
  return BLOCK_SETTINGS[block.type].flatMap((d) => descriptorFields(block, d));
}

/** The repeatable-group descriptor of a block type at a group path, if any. */
export function groupSettingFor(type: SiteBlockType, groupPath: string): BlockGroupSetting | undefined {
  return BLOCK_SETTINGS[type].find(
    (d): d is BlockGroupSetting => d.kind === 'repeatable-group' && d.path === groupPath
  );
}

/** Escape a value for interpolation inside a CSS attribute selector
 *  ([data-x="…"]) — block ids and field paths are config-provided strings,
 *  so quotes/backslashes must never break selection or highlight rules. */
export function cssAttrEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

type MutableRecord = Record<string, unknown>;

export function readBlockField(block: SiteBlock, path: string[]): string | undefined {
  let cursor: unknown = block;
  for (const key of path) {
    if (typeof cursor !== 'object' || cursor === null) return undefined;
    cursor = (cursor as MutableRecord)[key];
  }
  return typeof cursor === 'string' ? cursor : undefined;
}

/** Immutable single-field write — returns a fresh block, inputs untouched.
 *  An empty string REMOVES the key: the only fields that can legitimately end
 *  empty are the schema-optional ones (required fields always revert to their
 *  non-empty snapshot on commit), and `tagline: ''` would fail its min(1)
 *  where an absent key validates. */
export function writeBlockField(block: SiteBlock, path: string[], value: string): SiteBlock {
  const next = structuredClone(block) as unknown as MutableRecord;
  let cursor: unknown = next;
  for (let i = 0; i < path.length - 1; i += 1) {
    if (typeof cursor !== 'object' || cursor === null) return block;
    cursor = (cursor as MutableRecord)[path[i]];
  }
  if (typeof cursor !== 'object' || cursor === null) return block;
  const lastKey = path[path.length - 1];
  if (value === '') {
    delete (cursor as MutableRecord)[lastKey];
  } else {
    (cursor as MutableRecord)[lastKey] = value;
  }
  return next as unknown as SiteBlock;
}

/** Commit semantics shared by every edit surface (canvas sheet, inspector
 *  blur, save-path sanitize): keep the trimmed value, or revert to the
 *  edit-start snapshot when a required field was emptied. Optional fields
 *  carry an empty snapshot by construction, so emptying them deletes the key. */
export function commitValue(blocks: SiteBlock[], blockId: string, path: string[], snapshot: string): SiteBlock[] {
  return blocks.map((b) => {
    if (b.id !== blockId) return b;
    const raw = readBlockField(b, path) ?? '';
    const trimmed = raw.trim();
    return writeBlockField(b, path, trimmed || snapshot);
  });
}

/** Payload gate mirrored from PUT /api/websites/content — the Save button
 *  disables (with an honest hint) instead of ever bouncing on the server. */
const BlocksArraySchema = z.array(SiteBlockSchema).min(1).max(MAX_BLOCKS);

export function blocksAreValid(blocks: SiteBlock[]): boolean {
  return (
    BlocksArraySchema.safeParse(blocks).success &&
    new Set(blocks.map((b) => b.id)).size === blocks.length
  );
}

/** Readable unique id for a seller-added block ("film-1", "tabs-2", …) —
 *  collision-checked against the current array, so the PUT unique-ids gate
 *  passes by construction. */
export function mintBlockId(prefix: string, blocks: SiteBlock[]): string {
  let n = 1;
  while (blocks.some((b) => b.id === `${prefix}-${n}`)) n += 1;
  return `${prefix}-${n}`;
}

/** Default insert positions: directly after the first block of the anchor
 *  type. video_hero anchors to hero_banner (the film follows the opening);
 *  product_tabs anchors to product_grid (the tabs elaborate on the
 *  collection). Fallbacks keep insertion sane on reordered configs. */
export function insertAfterType(
  blocks: SiteBlock[],
  block: SiteBlock,
  anchor: SiteBlockType,
  fallback: 'start' | 'before_cta' | 'end'
): SiteBlock[] {
  const idx = blocks.findIndex((b) => b.type === anchor);
  if (idx !== -1) return [...blocks.slice(0, idx + 1), block, ...blocks.slice(idx + 1)];
  if (fallback === 'start') return [block, ...blocks];
  if (fallback === 'end') return [...blocks, block];
  const ctaIdx = blocks.findIndex((b) => b.type === 'cta_banner');
  if (ctaIdx !== -1) return [...blocks.slice(0, ctaIdx), block, ...blocks.slice(ctaIdx)];
  return [...blocks, block];
}

/** Readable id prefixes per type (mintBlockId collision-checks, and the
 *  legacy bare ids 'hero'/'values'/… can never collide with `${prefix}-n`). */
export const BLOCK_ID_PREFIXES: Record<SiteBlockType, string> = {
  hero_banner: 'hero',
  value_props: 'values',
  product_grid: 'grid',
  story_text: 'story',
  cta_banner: 'cta',
  product_tabs: 'tabs',
  video_hero: 'film',
};

/** Canonical-anatomy insert rules for every addable type: a new section
 *  lands after its natural anchor (duplicates directly after the first of
 *  their kind), with honest fallbacks on reordered configs. */
export const INSERT_RULES: Record<SiteBlockType, { anchor: SiteBlockType; fallback: 'start' | 'before_cta' | 'end' }> = {
  hero_banner: { anchor: 'hero_banner', fallback: 'start' },
  value_props: { anchor: 'hero_banner', fallback: 'start' },
  product_grid: { anchor: 'product_grid', fallback: 'before_cta' },
  story_text: { anchor: 'product_grid', fallback: 'before_cta' },
  cta_banner: { anchor: 'cta_banner', fallback: 'end' },
  product_tabs: { anchor: 'product_grid', fallback: 'before_cta' },
  video_hero: { anchor: 'hero_banner', fallback: 'start' },
};

// ── Starter builders (full catalog, Item 2) — real, sellable on-brand
// defaults inside every SITE_COPY_LIMITS budget; the seller rewrites them
// inline. product_grid defaults to grid (displayMode key ABSENT — the
// canonical stored form). ──────────────────────────────────────────────────

export function buildHeroBannerBlock(id: string): SiteBlock {
  return {
    id,
    type: 'hero_banner',
    headline: 'A New Chapter Begins Here',
    subheadline:
      'Introduce this section in one confident line — what it is, who it is for, and why it matters.',
  };
}

export function buildValuePropsBlock(id: string): SiteBlock {
  return {
    id,
    type: 'value_props',
    items: [
      {
        title: 'Made With Care',
        body: 'Tell customers what goes into every piece — the material, the craft, the check before it ships.',
      },
      {
        title: 'Delivered Right',
        body: 'Orders confirmed on WhatsApp and kept on track until they reach your customer.',
      },
    ],
  };
}

export function buildProductGridBlock(id: string): SiteBlock {
  return {
    id,
    type: 'product_grid',
    title: 'The Collection',
    intro: 'A closer look at the pieces we make — each one listed with honest details and current stock.',
  };
}

export function buildStoryTextBlock(id: string): SiteBlock {
  return {
    id,
    type: 'story_text',
    body: 'Every brand has a story. Use this space to tell yours — where it began, what you make, and the standard you refuse to compromise on.',
  };
}

export function buildCtaBannerBlock(id: string): SiteBlock {
  return {
    id,
    type: 'cta_banner',
    headline: 'Ready When You Are',
    subtext: 'Browse the full collection and order in a tap — we confirm every order on WhatsApp.',
    button_label: 'Shop The Collection',
  };
}

/** Catalog dispatch for the picker-less types. video_hero returns null — it
 *  REQUIRES an Ad Studio selection (never an invented URL, Law 4), so the
 *  editor routes it through the film picker instead. */
export function buildBlockForType(type: SiteBlockType, id: string): SiteBlock | null {
  switch (type) {
    case 'hero_banner': return buildHeroBannerBlock(id);
    case 'value_props': return buildValuePropsBlock(id);
    case 'product_grid': return buildProductGridBlock(id);
    case 'story_text': return buildStoryTextBlock(id);
    case 'cta_banner': return buildCtaBannerBlock(id);
    case 'product_tabs': return buildProductTabsBlock(id);
    case 'video_hero': return null;
  }
}

/** One-call add path for the catalog: mint the block and insert it per the
 *  type's INSERT_RULES. No-op (identity) at capacity or for video_hero. */
export function insertNewBlock(blocks: SiteBlock[], type: SiteBlockType, id: string): SiteBlock[] {
  if (blocks.length >= MAX_BLOCKS) return blocks;
  const block = buildBlockForType(type, id);
  if (!block) return blocks;
  const rule = INSERT_RULES[type];
  return insertAfterType(blocks, block, rule.anchor, rule.fallback);
}

// Starter copy for a fresh tabs section — real, sellable defaults inside
// every SITE_COPY_LIMITS budget; the seller rewrites them inline.
export function buildProductTabsBlock(id: string): SiteBlock {
  return {
    id,
    type: 'product_tabs',
    title: 'Good To Know',
    tabs: [
      {
        title: 'Details',
        content:
          'Every piece in this collection is checked by hand before it ships. Materials, sizing, and finish are listed on each product page — and if you need more detail, message us and we will answer the same day.',
      },
      {
        title: 'Delivery & Pickup',
        content:
          'Orders are confirmed on WhatsApp and prepared within 24 hours. Delivery timing and pickup options are shown at checkout, and we keep you updated at every step until your order reaches your hands.',
      },
      {
        title: 'Returns',
        content:
          'If something is not right, contact us within 48 hours of delivery and we will make it right — an exchange, a repair, or a refund where it applies. Keep the original packaging to speed things up.',
      },
    ],
  };
}

// Starter copy for a fresh film section. headline/subheadline are seeded
// (not left absent) so every edit surface has copy to target.
export function buildVideoHeroBlock(id: string, selection: VideoHeroSelection): SiteBlock {
  const block: Extract<SiteBlock, { type: 'video_hero' }> = {
    id,
    type: 'video_hero',
    videoUrl: selection.videoUrl,
    headline: 'See The Collection In Motion',
    subheadline:
      'A closer look at the craft — real texture, real finish, and the way each piece moves in natural light.',
  };
  if (selection.posterUrl) block.posterUrl = selection.posterUrl;
  return block;
}

/** Starter copy for a newly added tab (schema allows 2–4). */
export function buildStarterTab(): { title: string; content: string } {
  return {
    title: 'More Info',
    content:
      'Add the answer your customers ask for most — sizing guidance, care instructions, or how to order in bulk. Short, direct paragraphs read best here.',
  };
}

/** Starter copy for a newly added value prop (schema allows 2–4, Phase 8) —
 *  real, sellable defaults inside the SITE_COPY_LIMITS budgets. */
export function buildStarterValueProp(): { title: string; body: string } {
  return {
    title: 'Why It Matters',
    body: 'Name the benefit, ingredient, or craft detail your customers ask about most — one short line.',
  };
}

// Starter items per repeatable group ("type:groupPath") — a new group in the
// registry ships its starter here and the generic add path just works.
const GROUP_STARTERS: Record<string, () => Record<string, string>> = {
  'value_props:items': buildStarterValueProp,
  'product_tabs:tabs': buildStarterTab,
};

/** Generic bounded group add — no-op at the registry ceiling or without a
 *  starter. Replaces the bespoke addTabToBlock/addValuePropToBlock pair. */
export function addGroupItem(block: SiteBlock, groupPath: string): SiteBlock {
  const setting = groupSettingFor(block.type, groupPath);
  const starter = GROUP_STARTERS[`${block.type}:${groupPath}`];
  if (!setting || !starter) return block;
  const record = block as unknown as Record<string, unknown>;
  const arr = record[groupPath];
  if (!Array.isArray(arr) || arr.length >= setting.max) return block;
  return {
    ...block,
    [groupPath]: [...arr.map((item) => ({ ...(item as Record<string, string>) })), starter()],
  } as SiteBlock;
}

/** Generic bounded group remove — no-op at the registry floor. */
export function removeGroupItem(block: SiteBlock, groupPath: string, index: number): SiteBlock {
  const setting = groupSettingFor(block.type, groupPath);
  if (!setting) return block;
  const record = block as unknown as Record<string, unknown>;
  const arr = record[groupPath];
  if (!Array.isArray(arr) || arr.length <= setting.min) return block;
  return {
    ...block,
    [groupPath]: arr.filter((_, i) => i !== index).map((item) => ({ ...(item as Record<string, string>) })),
  } as SiteBlock;
}

/** Reorder blocks to a new id order (ids not present are dropped — cannot
 *  happen through the Reorder UI, guarded anyway; ids missing from the new
 *  order keep the array intact by falling back to identity). */
export function reorderBlocksByIds(blocks: SiteBlock[], ids: string[]): SiteBlock[] {
  if (ids.length !== blocks.length) return blocks;
  const byId = new Map(blocks.map((b) => [b.id, b]));
  const next: SiteBlock[] = [];
  for (const id of ids) {
    const block = byId.get(id);
    if (!block) return blocks;
    next.push(block);
  }
  return next;
}

/** Move a block one step up/down (mobile arrow reorder). */
export function moveBlock(blocks: SiteBlock[], blockId: string, direction: -1 | 1): SiteBlock[] {
  const idx = blocks.findIndex((b) => b.id === blockId);
  if (idx === -1) return blocks;
  const target = idx + direction;
  if (target < 0 || target >= blocks.length) return blocks;
  const next = [...blocks];
  const [moved] = next.splice(idx, 1);
  next.splice(target, 0, moved);
  return next;
}

/** Short preview line for a tree row — the block's leading copy. */
export function blockExcerpt(block: SiteBlock): string {
  switch (block.type) {
    case 'hero_banner':
      return block.headline;
    case 'value_props':
      return block.items[0]?.title ?? '';
    case 'product_grid':
      return block.title;
    case 'story_text':
      return block.body;
    case 'cta_banner':
      return block.headline;
    case 'product_tabs':
      return block.title;
    case 'video_hero':
      return block.headline ?? 'Brand film';
  }
}
