import {
  SITE_COPY_LIMITS,
  SiteBlockSchema,
  type SiteBlock,
  type SiteBlockType,
} from '@/lib/siteTemplates';
import { z } from 'zod';
import type { VideoHeroSelection } from '@/components/website/VideoHeroPicker';

// ─────────────────────────────────────────────────────────────────────────────
// Editor model — the PURE core of the Site Editor, shared by the split-screen
// shell (SiteCopyEditor), the section rail (SectionRail), and the mobile
// sheets. No React here: field budgets, block field access, commit semantics,
// section labels, and the seller-added-block builders, extracted from the
// pre-split SiteCopyEditor so both the canvas path and the inspector path
// operate on ONE set of rules.
// ─────────────────────────────────────────────────────────────────────────────

export type FieldMeta = { label: string; max: number; multiline: boolean };

// Field paths normalized with `*` for array indices ("items.0.title" →
// "items.*.title"). Budgets come from SITE_COPY_LIMITS — the same constants
// the zod schemas are built from, so the counter can never disagree with the
// validation gate.
export const FIELD_META: Record<string, FieldMeta> = {
  'hero_banner:tagline': { label: 'Tagline', max: SITE_COPY_LIMITS.tagline, multiline: false },
  'hero_banner:headline': { label: 'Hero headline', max: SITE_COPY_LIMITS.hero_headline, multiline: false },
  'hero_banner:subheadline': { label: 'Hero subheadline', max: SITE_COPY_LIMITS.hero_subheadline, multiline: true },
  'value_props:items.*.title': { label: 'Value prop title', max: SITE_COPY_LIMITS.value_title, multiline: false },
  'value_props:items.*.body': { label: 'Value prop body', max: SITE_COPY_LIMITS.value_body, multiline: true },
  'product_grid:title': { label: 'Collection title', max: SITE_COPY_LIMITS.collection_title, multiline: false },
  'product_grid:intro': { label: 'Collection intro', max: SITE_COPY_LIMITS.collection_intro, multiline: true },
  'story_text:body': { label: 'Brand story', max: SITE_COPY_LIMITS.brand_story, multiline: true },
  'cta_banner:headline': { label: 'Banner headline', max: SITE_COPY_LIMITS.cta_headline, multiline: false },
  'cta_banner:subtext': { label: 'Banner subtext', max: SITE_COPY_LIMITS.cta_subtext, multiline: true },
  'cta_banner:button_label': { label: 'Button label', max: SITE_COPY_LIMITS.cta_button_label, multiline: false },
  'product_tabs:title': { label: 'Tabs heading', max: SITE_COPY_LIMITS.tabs_heading, multiline: false },
  'product_tabs:tabs.*.title': { label: 'Tab title', max: SITE_COPY_LIMITS.tab_title, multiline: false },
  'product_tabs:tabs.*.content': { label: 'Tab content', max: SITE_COPY_LIMITS.tab_content, multiline: true },
  'video_hero:headline': { label: 'Film headline', max: SITE_COPY_LIMITS.hero_headline, multiline: false },
  'video_hero:subheadline': { label: 'Film subheadline', max: SITE_COPY_LIMITS.hero_subheadline, multiline: true },
};

// PUT /api/websites/content rejects payloads beyond 12 blocks — the add
// buttons disable at the same ceiling so a save can never bounce on length.
export const MAX_BLOCKS = 12;

// The ONLY block types the seller can add and remove (Phase 4 contract). The
// classic five are fixed anatomy: every template anchors design slots and
// chrome copy to them, so they are never offered for removal. Reordering is
// open to ALL types — renderers respect stored array order.
export const SELLER_ADDED_TYPES = new Set<SiteBlockType>(['product_tabs', 'video_hero']);

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

// Fields that may legitimately end EMPTY (key removed): the hero tagline and
// the film copy are schema-optional; every other field is zod min(1).
const OPTIONAL_FIELD_KEYS = new Set([
  'hero_banner:tagline',
  'video_hero:headline',
  'video_hero:subheadline',
]);

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

/** The ordered, editable copy fields of a block — ONE derivation consumed by
 *  the inspector (inline inputs), the mobile controls list (sheet rows), and
 *  the canvas→inspector focus bridge. */
export function fieldsForBlock(block: SiteBlock): EditorField[] {
  const f = (path: string[]): EditorField | null => {
    const meta = fieldMetaFor(block.type, path);
    return meta ? { path, meta, optional: isOptionalField(block.type, path) } : null;
  };
  const present = (fields: Array<EditorField | null>) =>
    fields.filter((x): x is EditorField => x !== null);

  switch (block.type) {
    case 'hero_banner':
      return present([f(['tagline']), f(['headline']), f(['subheadline'])]);
    case 'value_props':
      return present(
        block.items.flatMap((_, i) => [f(['items', String(i), 'title']), f(['items', String(i), 'body'])])
      );
    case 'product_grid':
      return present([f(['title']), f(['intro'])]);
    case 'story_text':
      return present([f(['body'])]);
    case 'cta_banner':
      return present([f(['headline']), f(['subtext']), f(['button_label'])]);
    case 'product_tabs':
      return present([
        f(['title']),
        ...block.tabs.flatMap((_, i) => [f(['tabs', String(i), 'title']), f(['tabs', String(i), 'content'])]),
      ]);
    case 'video_hero':
      return present([f(['headline']), f(['subheadline'])]);
  }
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
  fallback: 'start' | 'before_cta'
): SiteBlock[] {
  const idx = blocks.findIndex((b) => b.type === anchor);
  if (idx !== -1) return [...blocks.slice(0, idx + 1), block, ...blocks.slice(idx + 1)];
  if (fallback === 'start') return [block, ...blocks];
  const ctaIdx = blocks.findIndex((b) => b.type === 'cta_banner');
  if (ctaIdx !== -1) return [...blocks.slice(0, ctaIdx), block, ...blocks.slice(ctaIdx)];
  return [...blocks, block];
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

/** Add a tab to a product_tabs block (no-op at the 4-tab ceiling). */
export function addTabToBlock(block: SiteBlock): SiteBlock {
  if (block.type !== 'product_tabs' || block.tabs.length >= 4) return block;
  return { ...block, tabs: [...block.tabs.map((t) => ({ ...t })), buildStarterTab()] };
}

/** Remove a tab from a product_tabs block (no-op at the 2-tab floor). */
export function removeTabFromBlock(block: SiteBlock, index: number): SiteBlock {
  if (block.type !== 'product_tabs' || block.tabs.length <= 2) return block;
  return { ...block, tabs: block.tabs.filter((_, i) => i !== index).map((t) => ({ ...t })) };
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
