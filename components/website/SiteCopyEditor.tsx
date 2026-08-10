'use client';

import { createBrowserClient } from '@supabase/ssr';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Clapperboard,
  CloudOff,
  Film,
  GalleryHorizontal,
  LayoutGrid,
  Loader2,
  MousePointerClick,
  Plus,
  RefreshCw,
  Rows3,
  Save,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { fetchJSON, isTransportError } from '@/lib/transport';
import {
  clearWebsiteOutbox,
  flushWebsiteOutbox,
  queueWebsiteSave,
  readWebsiteOutbox,
} from '@/lib/offlineOutbox';
import EditorialTemplate from '@/components/site-templates/EditorialTemplate';
import RitualTemplate from '@/components/site-templates/RitualTemplate';
import BottomSheet from '@/components/website/BottomSheet';
import VideoHeroPicker, { type VideoHeroSelection } from '@/components/website/VideoHeroPicker';
import { useIsMobileViewport } from '@/lib/useIsMobileViewport';
import {
  SITE_COPY_LIMITS,
  blocksToLegacySite,
  resolveBlocks,
  resolveHeroMedia,
  type ShopWebsiteRow,
  type SiteBlock,
  type SiteBlockType,
  type SiteProduct,
  type SiteShop,
  type SiteTemplateProps,
  type TemplateKey,
  type WebsiteConfig,
} from '@/lib/siteTemplates';

// ─────────────────────────────────────────────────────────────────────────────
// SiteCopyEditor — the inline text editor of the Site Editor section
// (founder mandate: click "Skin Drinks Golden Light", type your own).
//
// The seller's REAL home page renders inside a scaled, scrollable frame (same
// scaling approach as MiniSitePreview, pointer events ON), fed entirely from
// the local `blocks` state — every keystroke re-renders the actual template
// component live. Clicking any node carrying data-block-id/data-block-field
// opens an overlay input/textarea positioned over that node.
//
// WHY AN OVERLAY INPUT (not in-place contentEditable):
//   1. Live preview requires re-rendering the template from state on every
//      keystroke. A controlled contentEditable inside that re-render loses
//      its caret each time React replaces the text node — the two models are
//      fundamentally at odds. The overlay is a separate controlled input; the
//      preview re-renders freely beneath it.
//   2. The preview is scaled to ~0.3–0.6×. Text inside a scaled
//      contentEditable is unreadably small and caret hit-testing inside CSS
//      transforms is glitchy across browsers. The overlay lives in UNSCALED
//      coordinate space (positioned via post-transform rects), so editing
//      happens at a readable size.
//   3. A plain <input>/<textarea> gives maxLength budgets, Enter/Escape
//      semantics, and mobile keyboards for free.
//
// Interaction contract (per spec): typing updates the block JSON in state →
// preview updates live; Escape cancels (reverts to the value at edit start);
// Enter or blur commits to local state. A sticky save bar appears when the
// blocks differ from the last-saved state: Save PUTs to
// /api/websites/content, Discard restores.
//
// Phase 4 Step 3 — block presentation editing rides the SAME dirty/save flow:
//   - Clicking a configurable section (its wrapper carries data-block-section)
//     opens a floating settings chip: Grid|Carousel toggle on product_grid,
//     Remove (+ Change film for video_hero) on the two seller-added types.
//   - Interactive islands stay live inside the preview: plain [role=tab]
//     clicks switch tabs (the active tab's pencil is the explicit edit
//     affordance for its title) and [data-carousel-nav] clicks page the
//     carousel — the click-capture routes both through untouched.
//   - "Add section" below the preview inserts video_hero (via the Ad Studio
//     film picker) or product_tabs at sensible default positions. ONLY those
//     two types are addable/removable — the classic five are fixed anatomy.
//
// Gambia Standard Step 3 — mobile (< 768px via SSR-safe matchMedia hook)
// swaps the pointer affordances for a touch model; DESKTOP IS UNCHANGED:
//   - No hover reveals: tapping a configurable section outlines it
//     persistently and opens its settings as a bottom sheet; tapping a copy
//     node opens a keyboard-safe bottom-sheet editor (the scaled preview
//     never hosts an absolutely-positioned input on a phone). Interactive
//     islands keep their routing: [role=tab] switches, [data-carousel-nav]
//     pages — never swallowed by selection.
//   - The copy sheet mirrors desktop commit semantics exactly: Save /
//     backdrop / drag-dismiss commit (desktop's blur), Cancel / Escape
//     restore the edit-start snapshot. While it is open the active node
//     keeps a persistent highlight and is scrolled into view INSIDE the
//     preview scroll container.
//   - "Add a section" opens as a sheet listing the two seller-added types.
//   - Sheets are sized against the visual viewport (keyboard-safe), the save
//     bar carries safe-area padding, and preview/sheet scrolling is
//     overscroll-contained so pull-to-refresh never fights a gesture.
// ─────────────────────────────────────────────────────────────────────────────

// Only the block-driven templates are editable surfaces. Vitality stays
// legacy-driven by design (Phase 3 spec) and is never offered here — the
// parent gates on this map, so no dead editor ever renders.
export const EDITABLE_TEMPLATE_COMPONENTS: Partial<Record<TemplateKey, ComponentType<SiteTemplateProps>>> = {
  ritual: RitualTemplate,
  editorial: EditorialTemplate,
};

// Desktop width the preview is laid out at before scaling (matches
// MiniSitePreview so both surfaces present identical typography).
const DESIGN_WIDTH = 1366;

type FieldMeta = { label: string; max: number; multiline: boolean };

// Field paths normalized with `*` for array indices ("items.0.title" →
// "items.*.title"). Budgets come from SITE_COPY_LIMITS — the same constants
// the zod schemas are built from, so the counter can never disagree with the
// validation gate.
const FIELD_META: Record<string, FieldMeta> = {
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
const MAX_BLOCKS = 12;

// The ONLY block types the seller can add and remove (Phase 4 contract). The
// classic five are fixed anatomy: every template anchors design slots and
// chrome copy to them, so they are never offered for removal.
const SELLER_ADDED_TYPES = new Set<SiteBlockType>(['product_tabs', 'video_hero']);

const CHIP_LABELS: Partial<Record<SiteBlockType, string>> = {
  product_grid: 'Collection layout',
  product_tabs: 'Product tabs',
  video_hero: 'Brand film',
};

/** Readable unique id for a seller-added block ("film-1", "tabs-2", …) —
 *  collision-checked against the current array, so the PUT unique-ids gate
 *  passes by construction. */
function mintBlockId(prefix: string, blocks: SiteBlock[]): string {
  let n = 1;
  while (blocks.some((b) => b.id === `${prefix}-${n}`)) n += 1;
  return `${prefix}-${n}`;
}

/** Default insert positions: directly after the first block of the anchor
 *  type. video_hero anchors to hero_banner (the film follows the opening);
 *  product_tabs anchors to product_grid (the tabs elaborate on the
 *  collection). Fallbacks keep insertion sane on reordered configs. */
function insertAfterType(
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
function buildProductTabsBlock(id: string): SiteBlock {
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
// (not left absent) so the overlay editor always has nodes to target.
function buildVideoHeroBlock(id: string, selection: VideoHeroSelection): SiteBlock {
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

function normalizeFieldPath(field: string): string {
  return field.replace(/\.\d+\./g, '.*.');
}

/** Escape a value for interpolation inside a CSS attribute selector
 *  ([data-x="…"]) — block ids and field paths are config-provided strings,
 *  so quotes/backslashes must never break the mobile highlight rules. */
function cssAttrEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

type MutableRecord = Record<string, unknown>;

function readBlockField(block: SiteBlock, path: string[]): string | undefined {
  let cursor: unknown = block;
  for (const key of path) {
    if (typeof cursor !== 'object' || cursor === null) return undefined;
    cursor = (cursor as MutableRecord)[key];
  }
  return typeof cursor === 'string' ? cursor : undefined;
}

/** Immutable single-field write — returns a fresh block, inputs untouched.
 *  An empty string REMOVES the key: the only field that can legitimately end
 *  empty is the optional hero tagline (required fields always revert to their
 *  non-empty snapshot on commit), and `tagline: ''` would fail its min(1)
 *  where an absent key validates. */
function writeBlockField(block: SiteBlock, path: string[], value: string): SiteBlock {
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

/** Commit semantics shared by blur/Enter and the save-path sanitize: keep the
 *  trimmed value, or revert to the edit-start snapshot when emptied. */
function commitValue(blocks: SiteBlock[], blockId: string, path: string[], snapshot: string): SiteBlock[] {
  return blocks.map((b) => {
    if (b.id !== blockId) return b;
    const raw = readBlockField(b, path) ?? '';
    const trimmed = raw.trim();
    return writeBlockField(b, path, trimmed || snapshot);
  });
}

type EditingState = {
  blockId: string;
  path: string[];
  meta: FieldMeta;
  /** Value when the edit began — Escape restores it. */
  snapshot: string;
  /** Overlay position inside the (unscaled) scroll-content wrapper. */
  left: number;
  top: number;
  width: number;
};

/** Floating block-settings chip, anchored to a clicked section's
 *  post-transform rect (same coordinate space as the copy overlay). */
type ChipState = {
  blockId: string;
  left: number;
  top: number;
};

type PickerState = { mode: 'add' } | { mode: 'replace'; blockId: string };

type ToastState = { kind: 'success' | 'error'; message: string };

type SiteCopyEditorProps = {
  /** Auth user id — namespaces the offline outbox (shared phones: one
   *  account's queued edit must never flush under another's session). */
  userId: string;
  website: ShopWebsiteRow;
  shop: SiteShop;
  /** Receives the fresh row after a successful save (single source of truth
   *  lives in the page's SWR cache — the studio's copy preview updates with
   *  it, and the persisted cache with both). */
  onSaved: (row: ShopWebsiteRow) => void;
};

export default function SiteCopyEditor({ userId, website, shop, onSaved }: SiteCopyEditorProps) {
  // Mount-time outbox seed: a save queued offline (possibly in a previous
  // session) IS the seller's latest truth for this exact build — the editor
  // reopens showing it in 'queued' sync state instead of silently presenting
  // the older server copy. Entries pinned to a different generated_at are
  // ignored here; the flush below drops them with an honest message.
  const [outboxSeed] = useState(() => {
    const entry = readWebsiteOutbox(userId);
    return entry && entry.baseGeneratedAt === website.generated_at ? entry : null;
  });
  const [blocks, setBlocks] = useState<SiteBlock[]>(() =>
    structuredClone(outboxSeed ? outboxSeed.blocks : resolveBlocks(website.config))
  );
  const [savedBlocks, setSavedBlocks] = useState<SiteBlock[]>(() =>
    structuredClone(outboxSeed ? outboxSeed.blocks : resolveBlocks(website.config))
  );
  // 'queued' = the last save is stored on this device awaiting connectivity.
  const [syncState, setSyncState] = useState<'idle' | 'queued'>(outboxSeed ? 'queued' : 'idle');
  const [products, setProducts] = useState<SiteProduct[]>([]);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [chip, setChip] = useState<ChipState | null>(null);
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [scale, setScale] = useState(0.4);
  const [contentHeight, setContentHeight] = useState(2400);
  // Mobile editor UX (< 768px): bottom sheets replace the floating chip, the
  // overlay input, and the film-picker modal; taps replace hover. SSR-safe
  // (server snapshot: false) — no hydration mismatch, flips live on
  // breakpoint crossings.
  const isMobile = useIsMobileViewport();
  // Tap-to-select (mobile): the last-tapped configurable section keeps a
  // persistent outline — hover affordances don't exist on touch. The outline
  // survives closing the settings sheet; tapping the section again reopens it.
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  // Mobile "Add a section" bottom sheet.
  const [addSheet, setAddSheet] = useState(false);

  const frameRef = useRef<HTMLDivElement | null>(null);
  const spacerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const chipRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // The seller's live inventory — products carry versioned PUBLIC-read RLS
  // (unlike shop_websites), so a browser read is correct here. Same columns
  // and dual ownership match as the /site home read (siteData.ts).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data } = await supabase
        .from('products')
        .select('id, name, price, description, image_url, ad_video_url, ad_hero_image_url, category, stock_quantity')
        .or(`shop_id.eq.${shop.id},user_id.eq.${shop.id}`)
        .order('created_at', { ascending: false })
        .limit(12);
      if (!cancelled) setProducts((data ?? []) as SiteProduct[]);
    })();
    return () => { cancelled = true; };
  }, [shop.id]);

  // Outbox flush — on mount, on window 'online', and via the manual "Sync
  // now" affordance. flushWebsiteOutbox dedupes in-flight runs (the page
  // section flushes opportunistically too), re-checks the row's generated_at
  // before PUTting, and reports how the entry resolved so the banner and the
  // page cache reconcile truthfully.
  const attemptFlush = useCallback(() => {
    const entry = readWebsiteOutbox(userId);
    if (!entry) {
      // Nothing queued (another surface may have flushed it already) — a
      // stale 'queued' banner must not survive.
      setSyncState('idle');
      return;
    }
    void flushWebsiteOutbox(userId).then((result) => {
      if (result.status === 'flushed') {
        setSyncState('idle');
        setToast({ kind: 'success', message: 'Back online — your saved changes are synced.' });
        onSaved(result.row);
      } else if (result.status === 'dropped') {
        setSyncState('idle');
        setToast({ kind: 'error', message: result.error });
      } else if (result.status === 'empty') {
        setSyncState('idle');
      }
      // 'kept': still offline — stay queued for the next trigger.
    });
  }, [userId, onSaved]);

  useEffect(() => {
    attemptFlush();
    window.addEventListener('online', attemptFlush);
    return () => window.removeEventListener('online', attemptFlush);
  }, [attemptFlush]);

  // Scale to the frame width; track the unscaled content height so the
  // scroll spacer matches the VISUAL height (transforms don't affect layout).
  useLayoutEffect(() => {
    const frame = frameRef.current;
    const content = contentRef.current;
    if (!frame || !content) return;
    const update = () => {
      if (frame.clientWidth > 0) setScale(frame.clientWidth / DESIGN_WIDTH);
      if (content.offsetHeight > 0) setContentHeight(content.offsetHeight);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  // Success toasts auto-dismiss; errors stay until dismissed or superseded.
  useEffect(() => {
    if (toast?.kind !== 'success') return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Focus + select the overlay input the moment an edit begins. `editing`
  // only changes identity on open/close/retarget — never on keystrokes
  // (typing mutates `blocks`), so this cannot steal the caret mid-edit.
  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  // Mobile copy sheet: keep the node being edited visible while the sheet
  // covers the lower viewport — scroll INSIDE the preview scroll container so
  // the highlighted node sits near the top of the frame. editing.top is the
  // node's post-transform offset within the spacer, i.e. exactly the frame's
  // scroll coordinate space.
  useEffect(() => {
    if (!isMobile || !editing) return;
    frameRef.current?.scrollTo({ top: Math.max(0, editing.top - 96), behavior: 'smooth' });
  }, [isMobile, editing]);

  const previewConfig = useMemo<WebsiteConfig>(
    () => ({
      ...website.config,
      site: blocksToLegacySite(blocks, website.config.site),
      blocks,
    }),
    [blocks, website.config]
  );

  const heroMedia = useMemo(() => resolveHeroMedia(products, shop), [products, shop]);

  const dirty = useMemo(
    () => JSON.stringify(blocks) !== JSON.stringify(savedBlocks),
    [blocks, savedBlocks]
  );

  const Template = EDITABLE_TEMPLATE_COMPONENTS[website.template_key];
  if (!Template) return null;

  const applyFieldValue = (blockId: string, path: string[], value: string) => {
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? writeBlockField(b, path, value) : b)));
  };

  const editingValue = (() => {
    if (!editing) return '';
    const block = blocks.find((b) => b.id === editing.blockId);
    return block ? readBlockField(block, editing.path) ?? '' : '';
  })();

  const beginEdit = (node: HTMLElement) => {
    const blockId = node.getAttribute('data-block-id');
    const field = node.getAttribute('data-block-field');
    const spacer = spacerRef.current;
    if (!blockId || !field || !spacer) return;

    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;
    const meta = FIELD_META[`${block.type}:${normalizeFieldPath(field)}`];
    if (!meta) return;

    const path = field.split('.');
    // Post-transform rects: the node's on-screen box relative to the scroll
    // content wrapper. The overlay lives INSIDE that wrapper, so it scrolls
    // with the page and never drifts.
    const nodeRect = node.getBoundingClientRect();
    const spacerRect = spacer.getBoundingClientRect();
    const containerWidth = spacerRect.width;
    const left = Math.max(8, Math.min(nodeRect.left - spacerRect.left, Math.max(8, containerWidth - 288)));
    const top = Math.max(0, nodeRect.top - spacerRect.top);
    const width = Math.min(Math.max(nodeRect.width, 280), containerWidth - left - 8);

    setChip(null);
    // Mobile: exactly one highlight at a time — the copy sheet's active-node
    // outline takes over from any section selection.
    setSelectedSection(null);
    setEditing({
      blockId,
      path,
      meta,
      snapshot: readBlockField(block, path) ?? '',
      left,
      top,
      width,
    });
  };

  // ── Block-settings chip + section operations (Phase 4 Step 3) ─────────────

  const openChipForSection = (sectionEl: HTMLElement) => {
    const spacer = spacerRef.current;
    const blockId = sectionEl.getAttribute('data-block-section');
    if (!spacer || !blockId) return;
    const block = blocks.find((b) => b.id === blockId);
    if (!block || !CHIP_LABELS[block.type]) return;
    setEditing(null);
    if (isMobile) {
      // Tap-to-select: persistent outline + the settings bottom sheet.
      // Coordinates are meaningless for a sheet — zeroed by convention.
      setSelectedSection(blockId);
      setChip({ blockId, left: 0, top: 0 });
      return;
    }
    const rect = sectionEl.getBoundingClientRect();
    const spacerRect = spacer.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.left - spacerRect.left + 12, Math.max(8, spacerRect.width - 380)));
    const top = Math.max(0, rect.top - spacerRect.top + 12);
    setChip({ blockId, left, top });
  };

  /** Grid|Carousel toggle. 'grid' REMOVES the key (absent means grid — the
   *  canonical stored form), so toggling away and back leaves the block
   *  byte-identical and the dirty check settles clean. */
  const setGridDisplayMode = (blockId: string, mode: 'grid' | 'carousel') => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId || b.type !== 'product_grid') return b;
        if (mode === 'carousel') return { ...b, displayMode: 'carousel' as const };
        const next = { ...b };
        delete next.displayMode;
        return next;
      })
    );
  };

  /** Removal is guarded to the seller-added types — the classic five stay
   *  fixed anatomy even if a hand-crafted call slips a wrong id through. */
  const removeBlock = (blockId: string) => {
    setChip(null);
    setEditing(null);
    setSelectedSection(null);
    setBlocks((prev) => prev.filter((b) => !(b.id === blockId && SELLER_ADDED_TYPES.has(b.type))));
  };

  const addProductTabsBlock = () => {
    setChip(null);
    setEditing(null);
    setBlocks((prev) => {
      if (prev.length >= MAX_BLOCKS) return prev;
      return insertAfterType(prev, buildProductTabsBlock(mintBlockId('tabs', prev)), 'product_grid', 'before_cta');
    });
  };

  const addVideoHeroBlock = (selection: VideoHeroSelection) => {
    setChip(null);
    setEditing(null);
    setBlocks((prev) => {
      if (prev.length >= MAX_BLOCKS) return prev;
      return insertAfterType(prev, buildVideoHeroBlock(mintBlockId('film', prev), selection), 'hero_banner', 'start');
    });
  };

  /** "Change film" on an existing video_hero: swaps the asset, replaces the
   *  poster with the new ad's hero still (or drops the stale one on a manual
   *  URL), and leaves the seller's headline/subheadline copy untouched. */
  const replaceVideoHeroAsset = (blockId: string, selection: VideoHeroSelection) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId || b.type !== 'video_hero') return b;
        const next: Extract<SiteBlock, { type: 'video_hero' }> = { ...b, videoUrl: selection.videoUrl };
        if (selection.posterUrl) next.posterUrl = selection.posterUrl;
        else delete next.posterUrl;
        return next;
      })
    );
  };

  const commitEdit = () => {
    if (!editing) return;
    // Empty copy can never save (every required field is zod min(1)) — an
    // emptied node reverts to its value at edit start.
    setBlocks((prev) => commitValue(prev, editing.blockId, editing.path, editing.snapshot));
    setEditing(null);
  };

  const cancelEdit = () => {
    if (!editing) return;
    applyFieldValue(editing.blockId, editing.path, editing.snapshot);
    setEditing(null);
  };

  const handleOverlayKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commitEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  };

  // Capture-phase interception: the preview renders REAL <a>/<Link> markup —
  // preventDefault + stopPropagation keeps every click on-page (Next's Link
  // handler bails on defaultPrevented), then the nearest annotated copy node
  // opens the editor. Clicks inside the overlay input and the settings chip
  // pass through untouched. Two island routes stay LIVE inside the preview:
  // plain [role=tab] clicks switch tabs and [data-carousel-nav] clicks page
  // the carousel (both are buttons — nothing to prevent). The active tab's
  // pencil IS a copy node inside its [role=tab], so it takes the edit path
  // with propagation stopped — title editing never triggers a switch.
  const handlePreviewClickCapture = (e: ReactMouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (overlayRef.current?.contains(target)) return;
    if (chipRef.current?.contains(target)) return;

    const copyNode = target.closest<HTMLElement>('[data-block-id][data-block-field]');
    if (!copyNode && (target.closest('[role="tab"]') || target.closest('[data-carousel-nav]'))) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    if (copyNode) {
      beginEdit(copyNode);
      return;
    }

    // No copy node hit: a click inside a configurable section opens its
    // settings chip (mobile: selects it + opens the settings sheet);
    // anywhere else dismisses an open one and clears the tap-selection.
    const sectionNode = target.closest<HTMLElement>('[data-block-section]');
    if (sectionNode) {
      openChipForSection(sectionNode);
    } else {
      setChip(null);
      setSelectedSection(null);
    }
  };

  const handleDiscard = () => {
    setEditing(null);
    setChip(null);
    setPicker(null);
    setBlocks(structuredClone(savedBlocks));
    setToast(null);
  };

  const handleSave = async () => {
    // Sanitize any in-flight edit into the payload SYNCHRONOUSLY. Clicking
    // Save while an overlay is open fires blur (commit) before this handler,
    // but this closure still sees the pre-commit state — recomputing the same
    // commitValue here is idempotent with the blur path, so both orderings
    // produce the identical payload.
    let payload = blocks;
    if (editing) {
      payload = commitValue(blocks, editing.blockId, editing.path, editing.snapshot);
      setBlocks(payload);
      setEditing(null);
    }
    // Optimistic: the UI settles clean immediately; the failure paths below
    // decide between queue (connectivity) and rollback (server verdict).
    const rollback = savedBlocks;
    setSavedBlocks(structuredClone(payload));
    // Latest-wins: this save supersedes any queued older payload. Cleared
    // BEFORE the PUT so a concurrent outbox flush can never land stale
    // blocks on top of this newer write.
    clearWebsiteOutbox(userId);
    setSaving(true);
    setToast(null);
    try {
      const row = await fetchJSON<ShopWebsiteRow>('/api/websites/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks: payload }),
      });
      setSyncState('idle');
      setToast({ kind: 'success', message: 'Copy saved — your site is updated.' });
      onSaved(row);
    } catch (err) {
      if (isTransportError(err) && (err.kind === 'offline' || err.kind === 'timeout')) {
        // Connectivity failure: queue on-device (user-namespaced, pinned to
        // this build's generated_at) and tell the truth in the save bar.
        const queued = queueWebsiteSave(userId, {
          blocks: payload,
          baseGeneratedAt: website.generated_at,
        });
        if (queued) {
          setSyncState('queued');
        } else {
          // localStorage refused (quota/private mode) — stay dirty + honest.
          setSavedBlocks(rollback);
          setToast({
            kind: 'error',
            message: 'You appear to be offline and this change could not be stored for later — please try again once connected.',
          });
        }
      } else if (isTransportError(err) && err.kind === 'server') {
        // The API rejected the payload (validation/409) — NEVER queue a
        // payload that cannot succeed. Roll back the saved marker so the
        // dirty bar returns, but KEEP the seller's text in the editor.
        setSavedBlocks(rollback);
        setToast({ kind: 'error', message: err.message || 'Failed to save your changes.' });
      } else if (isTransportError(err) && err.kind === 'abort') {
        // External abort — restore the dirty state silently.
        setSavedBlocks(rollback);
      } else {
        setSavedBlocks(rollback);
        setToast({ kind: 'error', message: 'Network error saving your changes. Please try again.' });
      }
    } finally {
      setSaving(false);
    }
  };

  const atBudget = editing ? editingValue.length >= editing.meta.max : false;
  // Chip block resolved live from state: removal or discard unmounts the chip
  // automatically, and the toggle reads the current displayMode each render.
  const chipBlock = chip ? blocks.find((b) => b.id === chip.blockId) : undefined;
  const atBlockCapacity = blocks.length >= MAX_BLOCKS;
  const queued = syncState === 'queued';

  return (
    <div className="sndk-copy-editor">
      {/* Editing affordances — scoped to the editor frame only; the public
          site never loads this component. Hover reveals are DESKTOP-ONLY
          (≥768px, matching the isMobile hook): on touch there is no hover, so
          mobile runs the tap-to-select model via the persistent-highlight
          style tags below. The tab-title pencil (display-hidden in public
          markup) is revealed here on every viewport — it is the always-visible
          edit affordance on the active tab. */}
      <style>{`
        .sndk-copy-editor {
          -webkit-tap-highlight-color: transparent;
        }
        .sndk-copy-editor [data-block-id][data-block-field] {
          cursor: pointer;
          outline: 2px dashed transparent;
          outline-offset: 6px;
          transition: outline-color .15s ease, background-color .15s ease;
        }
        .sndk-copy-editor [data-block-section] {
          outline: 2px dashed transparent;
          outline-offset: -6px;
          transition: outline-color .15s ease;
        }
        .sndk-copy-editor .sndk-tab-edit {
          display: inline-flex;
        }
        @media (min-width: 768px) {
          .sndk-copy-editor [data-block-id][data-block-field]:hover {
            outline-color: rgba(240, 165, 0, .85);
            background-color: rgba(240, 165, 0, .08);
          }
          .sndk-copy-editor [data-block-section]:hover {
            outline-color: rgba(240, 165, 0, .4);
          }
        }
      `}</style>

      {/* Mobile persistent highlights (tap-to-select replaces hover): the
          selected section keeps its outline until the seller taps elsewhere;
          the node being edited in the copy sheet stays highlighted so the
          live preview visibly tracks every keystroke. */}
      {isMobile && selectedSection && (
        <style>{`
          .sndk-copy-editor [data-block-section="${cssAttrEscape(selectedSection)}"] {
            outline-color: rgba(240, 165, 0, .8);
          }
        `}</style>
      )}
      {isMobile && editing && (
        <style>{`
          .sndk-copy-editor [data-block-id="${cssAttrEscape(editing.blockId)}"][data-block-field="${cssAttrEscape(editing.path.join('.'))}"] {
            outline-color: rgba(240, 165, 0, .95);
            background-color: rgba(240, 165, 0, .12);
          }
        `}</style>
      )}

      {/* Browser chrome bar — frames the preview as the seller's real page */}
      <div className="overflow-hidden rounded-[1.5rem] border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-1.5 border-b border-gray-100 bg-gray-50 px-4 py-2.5">
          <span className="h-2 w-2 rounded-full bg-gray-300" />
          <span className="h-2 w-2 rounded-full bg-gray-300" />
          <span className="h-2 w-2 rounded-full bg-gray-300" />
          <span className="ml-3 flex h-5 flex-1 items-center rounded-full bg-white px-3 ring-1 ring-gray-200">
            <span className="truncate font-mono text-[10px] text-gray-400">
              {shop.shop_slug ? `/site/${shop.shop_slug}` : 'your generated site'}
            </span>
          </span>
          <span className="ml-3 hidden items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-gray-400 md:flex">
            <MousePointerClick size={12} /> Click any copy to rewrite it
          </span>
          <span className="ml-3 flex shrink-0 items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-gray-400 md:hidden">
            <MousePointerClick size={12} /> Tap text to edit
          </span>
        </div>

        {/* Scaled, scrollable live preview — overscroll-contained so reaching
            its edge on a phone never chains into pull-to-refresh. */}
        <div
          ref={frameRef}
          onClickCapture={handlePreviewClickCapture}
          className="relative h-[540px] w-full overflow-y-auto overflow-x-hidden overscroll-contain bg-white md:h-[620px]"
        >
          <div ref={spacerRef} className="relative" style={{ height: Math.max(1, contentHeight * scale) }}>
            <div
              ref={contentRef}
              className="absolute left-0 top-0 origin-top-left"
              style={{ width: DESIGN_WIDTH, transform: `scale(${scale})` }}
            >
              <Template shop={shop} products={products} config={previewConfig} heroMedia={heroMedia} />
            </div>

            {/* Overlay editor — unscaled coordinate space, scrolls with the
                page. DESKTOP ONLY: on mobile the copy sheet below replaces
                it (an absolutely-positioned input over a scaled preview and a
                virtual keyboard cannot coexist). */}
            {editing && !isMobile && (
              <div
                ref={overlayRef}
                className="absolute z-40"
                style={{ left: editing.left, top: editing.top, width: editing.width }}
              >
                {editing.meta.multiline ? (
                  <textarea
                    ref={(el) => { inputRef.current = el; }}
                    value={editingValue}
                    maxLength={editing.meta.max}
                    rows={Math.min(6, Math.max(2, Math.ceil(editing.meta.max / 110)))}
                    onChange={(e) => applyFieldValue(editing.blockId, editing.path, e.target.value.slice(0, editing.meta.max))}
                    onKeyDown={handleOverlayKeyDown}
                    onBlur={commitEdit}
                    className="w-full resize-none rounded-xl border-0 bg-white px-3.5 py-3 font-sans text-sm leading-relaxed text-gray-900 shadow-2xl ring-2 ring-[#f0a500] outline-none"
                  />
                ) : (
                  <input
                    ref={(el) => { inputRef.current = el; }}
                    type="text"
                    value={editingValue}
                    maxLength={editing.meta.max}
                    onChange={(e) => applyFieldValue(editing.blockId, editing.path, e.target.value.slice(0, editing.meta.max))}
                    onKeyDown={handleOverlayKeyDown}
                    onBlur={commitEdit}
                    className="w-full rounded-xl border-0 bg-white px-3.5 py-3 font-sans text-sm text-gray-900 shadow-2xl ring-2 ring-[#f0a500] outline-none"
                  />
                )}
                <div className="mt-1.5 flex items-center justify-between gap-3 rounded-full bg-neutral-900/95 px-3.5 py-1.5 shadow-lg">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-white/70">{editing.meta.label}</span>
                  <span className={`font-mono text-[10px] font-bold ${atBudget ? 'text-amber-400' : 'text-white/70'}`}>
                    {editingValue.length}/{editing.meta.max}
                  </span>
                  <span className="hidden text-[9px] uppercase tracking-widest text-white/40 sm:block">
                    Enter to apply · Esc to cancel
                  </span>
                </div>
              </div>
            )}

            {/* Floating block-settings chip — unscaled coordinate space, same
                as the overlay editor, so it scrolls with the section it
                configures. DESKTOP ONLY: mobile renders the settings sheet. */}
            {chip && chipBlock && !isMobile && (
              <div ref={chipRef} className="absolute z-40" style={{ left: chip.left, top: chip.top }}>
                <div className="flex items-center gap-2 rounded-full bg-neutral-900/95 py-1.5 pl-4 pr-1.5 shadow-xl backdrop-blur">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-white/60">
                    {CHIP_LABELS[chipBlock.type]}
                  </span>
                  {chipBlock.type === 'product_grid' && (
                    <div className="flex items-center overflow-hidden rounded-full ring-1 ring-white/25">
                      <button
                        type="button"
                        onClick={() => setGridDisplayMode(chipBlock.id, 'grid')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest transition ${
                          (chipBlock.displayMode ?? 'grid') === 'grid'
                            ? 'bg-white text-neutral-900'
                            : 'text-white/70 hover:text-white'
                        }`}
                      >
                        <LayoutGrid size={11} /> Grid
                      </button>
                      <button
                        type="button"
                        onClick={() => setGridDisplayMode(chipBlock.id, 'carousel')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest transition ${
                          chipBlock.displayMode === 'carousel'
                            ? 'bg-white text-neutral-900'
                            : 'text-white/70 hover:text-white'
                        }`}
                      >
                        <GalleryHorizontal size={11} /> Carousel
                      </button>
                    </div>
                  )}
                  {chipBlock.type === 'video_hero' && (
                    <button
                      type="button"
                      onClick={() => setPicker({ mode: 'replace', blockId: chipBlock.id })}
                      className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest text-white/80 ring-1 ring-white/25 transition hover:bg-white/10 hover:text-white"
                    >
                      <Film size={11} /> Change film
                    </button>
                  )}
                  {SELLER_ADDED_TYPES.has(chipBlock.type) && (
                    <button
                      type="button"
                      onClick={() => removeBlock(chipBlock.id)}
                      className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-widest text-red-300 ring-1 ring-red-400/40 transition hover:bg-red-500/20 hover:text-red-200"
                    >
                      <Trash2 size={11} /> Remove
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label="Close section settings"
                    onClick={() => setChip(null)}
                    className="rounded-full p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add-section bar — the ONLY entry point for the two seller-added
          block types (Phase 4 contract: the classic five stay fixed). */}
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[1.5rem] border border-gray-200 bg-white px-5 py-4 shadow-sm">
        <div className="mr-auto">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Add a section</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {atBlockCapacity
              ? 'Your page is at its 12-section limit — remove a section to add another.'
              : 'New sections drop straight into the preview — click a section for its settings, then save to publish.'}
          </p>
        </div>
        {isMobile ? (
          <button
            type="button"
            onClick={() => setAddSheet(true)}
            disabled={atBlockCapacity || saving}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-700 transition active:bg-gray-100 disabled:opacity-40"
          >
            <Plus size={14} /> Add a section
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setPicker({ mode: 'add' })}
              disabled={atBlockCapacity || saving}
              className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-700 transition hover:border-gray-900 hover:bg-white disabled:opacity-40"
            >
              <Clapperboard size={13} /> Brand film
            </button>
            <button
              type="button"
              onClick={addProductTabsBlock}
              disabled={atBlockCapacity || saving}
              className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-700 transition hover:border-gray-900 hover:bg-white disabled:opacity-40"
            >
              <Rows3 size={13} /> Product tabs
            </button>
          </>
        )}
      </div>

      {/* Ad Studio film picker — add flow inserts a new video_hero block,
          replace flow swaps the asset on an existing one. AnimatePresence
          lets the mobile sheet play its exit slide; the desktop modal (no
          motion children) unmounts instantly, exactly as before. */}
      <AnimatePresence>
        {picker && (
          <VideoHeroPicker
            key="film-picker"
            shopId={shop.id}
            heading={picker.mode === 'add' ? 'Add a brand film' : 'Change the film'}
            onClose={() => setPicker(null)}
            onSelect={(selection) => {
              if (picker.mode === 'add') addVideoHeroBlock(selection);
              else replaceVideoHeroAsset(picker.blockId, selection);
              setPicker(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Mobile bottom sheets (Gambia Standard Step 3) ──────────────────
          The touch counterparts of the floating chip, the add-section
          buttons, and the overlay copy editor. Mutually exclusive by the
          same state machine desktop uses; mounted only under 768px. */}
      {isMobile && (
        <AnimatePresence>
          {chip && chipBlock && (
            <BottomSheet
              key={`settings-${chip.blockId}`}
              label={CHIP_LABELS[chipBlock.type] ?? 'Section settings'}
              onDismiss={() => setChip(null)}
            >
              <div className="space-y-1 px-3 pb-2">
                {chipBlock.type === 'product_grid' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setGridDisplayMode(chipBlock.id, 'grid')}
                      className={`flex min-h-[48px] w-full items-center gap-3 rounded-2xl px-4 text-left text-sm font-semibold transition ${
                        (chipBlock.displayMode ?? 'grid') === 'grid'
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-700 active:bg-gray-100'
                      }`}
                    >
                      <LayoutGrid size={16} className="shrink-0" />
                      <span className="flex-1">Grid</span>
                      {(chipBlock.displayMode ?? 'grid') === 'grid' && <Check size={16} className="shrink-0" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setGridDisplayMode(chipBlock.id, 'carousel')}
                      className={`flex min-h-[48px] w-full items-center gap-3 rounded-2xl px-4 text-left text-sm font-semibold transition ${
                        chipBlock.displayMode === 'carousel'
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-700 active:bg-gray-100'
                      }`}
                    >
                      <GalleryHorizontal size={16} className="shrink-0" />
                      <span className="flex-1">Carousel</span>
                      {chipBlock.displayMode === 'carousel' && <Check size={16} className="shrink-0" />}
                    </button>
                  </>
                )}
                {chipBlock.type === 'video_hero' && (
                  <button
                    type="button"
                    onClick={() => {
                      // One sheet at a time on a phone: the settings sheet
                      // hands off to the film-picker sheet.
                      setChip(null);
                      setPicker({ mode: 'replace', blockId: chipBlock.id });
                    }}
                    className="flex min-h-[48px] w-full items-center gap-3 rounded-2xl px-4 text-left text-sm font-semibold text-gray-700 transition active:bg-gray-100"
                  >
                    <Film size={16} className="shrink-0" />
                    <span className="flex-1">Change film</span>
                    <ChevronRight size={16} className="shrink-0 text-gray-300" />
                  </button>
                )}
                {SELLER_ADDED_TYPES.has(chipBlock.type) && (
                  <button
                    type="button"
                    onClick={() => removeBlock(chipBlock.id)}
                    className="flex min-h-[48px] w-full items-center gap-3 rounded-2xl px-4 text-left text-sm font-semibold text-red-600 transition active:bg-red-50"
                  >
                    <Trash2 size={16} className="shrink-0" />
                    <span className="flex-1">Remove section</span>
                  </button>
                )}
              </div>
            </BottomSheet>
          )}

          {editing && (
            <BottomSheet
              key="copy-sheet"
              label={editing.meta.label}
              // Same contract as the desktop overlay: dismissive gestures
              // (backdrop, drag, ✕) COMMIT — the seller watched the preview
              // update live while typing; Escape and Cancel restore the
              // edit-start snapshot.
              onDismiss={commitEdit}
              onEscape={cancelEdit}
              footer={
                <div className="flex gap-3 px-5 pt-3">
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-full bg-gray-100 text-[11px] font-bold uppercase tracking-widest text-gray-600 transition active:bg-gray-200"
                  >
                    <X size={13} /> Cancel
                  </button>
                  <button
                    type="button"
                    onClick={commitEdit}
                    className="flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#1a2e1a] to-gray-900 text-[11px] font-bold uppercase tracking-widest text-white shadow-md transition active:scale-95"
                  >
                    <Check size={13} /> Save
                  </button>
                </div>
              }
            >
              <div className="px-5 pb-1 pt-1">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-gray-500">Updates live in the preview above</span>
                  <span className={`font-mono text-[11px] font-bold ${atBudget ? 'text-amber-600' : 'text-gray-400'}`}>
                    {editingValue.length}/{editing.meta.max}
                  </span>
                </div>
                {/* text-base (16px) keeps iOS from auto-zooming the sheet on
                    focus; budgets and Enter/Escape semantics match desktop. */}
                {editing.meta.multiline ? (
                  <textarea
                    ref={(el) => { inputRef.current = el; }}
                    autoFocus
                    value={editingValue}
                    maxLength={editing.meta.max}
                    rows={Math.min(8, Math.max(3, Math.ceil(editing.meta.max / 80)))}
                    onChange={(e) => applyFieldValue(editing.blockId, editing.path, e.target.value.slice(0, editing.meta.max))}
                    onKeyDown={handleOverlayKeyDown}
                    className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50/60 px-4 py-3.5 font-sans text-base leading-relaxed text-gray-900 outline-none transition focus:border-[#f0a500] focus:bg-white focus:ring-1 focus:ring-[#f0a500]"
                  />
                ) : (
                  <input
                    ref={(el) => { inputRef.current = el; }}
                    autoFocus
                    type="text"
                    value={editingValue}
                    maxLength={editing.meta.max}
                    onChange={(e) => applyFieldValue(editing.blockId, editing.path, e.target.value.slice(0, editing.meta.max))}
                    onKeyDown={handleOverlayKeyDown}
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50/60 px-4 py-3.5 font-sans text-base text-gray-900 outline-none transition focus:border-[#f0a500] focus:bg-white focus:ring-1 focus:ring-[#f0a500]"
                  />
                )}
              </div>
            </BottomSheet>
          )}

          {addSheet && (
            <BottomSheet key="add-sheet" label="Add a section" onDismiss={() => setAddSheet(false)}>
              <div className="space-y-1 px-3 pb-2">
                <button
                  type="button"
                  disabled={atBlockCapacity}
                  onClick={() => {
                    setAddSheet(false);
                    setPicker({ mode: 'add' });
                  }}
                  className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl px-4 text-left transition active:bg-gray-100 disabled:opacity-40"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-900 text-white">
                    <Clapperboard size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-gray-900">Brand film</span>
                    <span className="block truncate text-xs text-gray-500">A cinematic Ad Studio commercial on your page</span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-gray-300" />
                </button>
                <button
                  type="button"
                  disabled={atBlockCapacity}
                  onClick={() => {
                    addProductTabsBlock();
                    setAddSheet(false);
                  }}
                  className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl px-4 text-left transition active:bg-gray-100 disabled:opacity-40"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-700">
                    <Rows3 size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-gray-900">Product tabs</span>
                    <span className="block truncate text-xs text-gray-500">Details, delivery and returns in tidy tabs</span>
                  </span>
                </button>
              </div>
            </BottomSheet>
          )}
        </AnimatePresence>
      )}

      {/* Sticky save bar — unsaved changes, sync status, and toasts.
          bottom offset carries the safe-area inset so the bar clears the
          home-indicator region on notched phones (env() is 0 on desktop —
          identical to the historical bottom-4). */}
      {(dirty || toast || queued) && (
        <div className="sticky bottom-[calc(1rem_+_env(safe-area-inset-bottom))] z-30 mt-4">
          <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3 rounded-full border border-gray-200 bg-white/95 px-5 py-3 shadow-xl backdrop-blur">
            {toast ? (
              <p className={`flex items-center gap-2 text-sm font-medium ${toast.kind === 'success' ? 'text-emerald-700' : 'text-red-700'}`}>
                {toast.kind === 'success' ? <CheckCircle2 size={15} /> : <X size={15} />}
                {toast.message}
              </p>
            ) : dirty ? (
              <p className="text-sm font-medium text-gray-700">
                Unsaved copy changes — save to update your live site.
              </p>
            ) : (
              <p className="flex items-center gap-2 text-sm font-medium text-amber-800">
                <CloudOff size={15} className="shrink-0 text-amber-600" />
                Saved on this phone — syncing when you&apos;re back online.
              </p>
            )}
            <div className="flex items-center gap-2">
              {toast?.kind === 'error' && (
                <button
                  onClick={() => setToast(null)}
                  className="rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 transition hover:text-gray-600"
                >
                  Dismiss
                </button>
              )}
              {queued && !dirty && (
                <button
                  onClick={attemptFlush}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-full bg-gray-50 px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-600 transition hover:bg-gray-100 disabled:opacity-50"
                >
                  <RefreshCw size={12} /> Sync now
                </button>
              )}
              {dirty && (
                <>
                  <button
                    onClick={handleDiscard}
                    disabled={saving}
                    className="flex items-center gap-1.5 rounded-full bg-gray-50 px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-600 transition hover:bg-gray-100 disabled:opacity-50"
                  >
                    <Undo2 size={12} /> Discard
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#1a2e1a] to-gray-900 px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-md transition hover:opacity-90 active:scale-95 disabled:opacity-60"
                  >
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
