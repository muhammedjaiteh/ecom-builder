'use client';

import { createBrowserClient } from '@supabase/ssr';
import {
  Fragment,
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
  CloudOff,
  Eye,
  EyeOff,
  Film,
  Loader2,
  MousePointerClick,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  SlidersHorizontal,
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
import { GatedVideoPreviewScope } from '@/components/site-templates/GatedVideo';
import { RevealPreviewScope } from '@/components/site-templates/Reveal';
import { StoryClampPreviewScope } from '@/components/site-templates/StoryClamp';
import RitualTemplate from '@/components/site-templates/RitualTemplate';
import VitalityTemplate from '@/components/site-templates/VitalityTemplate';
import BottomSheet from '@/components/website/BottomSheet';
import VideoHeroPicker, { type VideoHeroSelection } from '@/components/website/VideoHeroPicker';
import AssetSlots, { type AssetBusyState, type AssetSlotKind } from '@/components/website/editor/AssetSlots';
import HeroImagePicker from '@/components/website/editor/HeroImagePicker';
import SectionRail, { BLOCK_TYPE_ICONS, SELECT_OPTION_ICONS } from '@/components/website/editor/SectionRail';
import ThemePanel from '@/components/website/editor/ThemePanel';
import {
  BLOCK_ID_PREFIXES,
  MAX_BLOCKS,
  REMOVE_GUARD_HINT,
  SECTION_LABELS,
  addGroupItem,
  addableSectionCatalog,
  blocksAreValid,
  buildVideoHeroBlock,
  canRemoveBlock,
  commitValue,
  cssAttrEscape,
  fieldMetaFor,
  insertAfterType,
  insertNewBlock,
  isOptionalField,
  mintBlockId,
  moveBlock,
  readBlockField,
  removeGroupItem,
  reorderBlocksByIds,
  toggleBlockHidden,
  writeBlockField,
  type FieldMeta,
} from '@/components/website/editor/editorModel';
import { useIsMobileViewport } from '@/lib/useIsMobileViewport';
import {
  BLOCK_SETTINGS,
  blocksToLegacySite,
  resolveBlocks,
  resolveHeroMedia,
  type ShopWebsiteRow,
  type SiteAssets,
  type SiteBlock,
  type SiteBlockType,
  type SiteProduct,
  type SiteShop,
  type SiteTemplateProps,
  type SiteTheme,
  type TemplateKey,
  type WebsiteConfig,
} from '@/lib/siteTemplates';

// ─────────────────────────────────────────────────────────────────────────────
// SiteCopyEditor — the Shopify-style SPLIT-SCREEN Site Editor.
//
// DESKTOP/TABLET (≥768px): a two-zone workspace —
//   LEFT (~350px rail): the section tree (framer-motion Reorder drag on a
//   dedicated grip writes block order straight to state) + the inspector for
//   the focused section: inline copy inputs with live SITE_COPY_LIMITS
//   budgets, the Grid|Carousel toggle, product-tab editing, film controls,
//   and the hero section's asset slots (hero image upload / Ad Studio picker
//   / Generate-with-AI, plus the logo slot).
//   RIGHT: the live preview — the seller's REAL template component rendered
//   scaled inside a scroll frame.
//
//   WHY THE PREVIEW IS A SCALED REAL-COMPONENT RENDER, NOT AN IFRAME:
//   1. The rail and the canvas share ONE React state (`blocks` + `assets`) —
//      every keystroke in an inspector input re-renders the actual template
//      live with zero postMessage bridge, zero serialization, zero drift
//      between "editor model" and "preview model".
//   2. An iframe would need its own document served from a route; offline
//      (Gambia Standard) that second navigation can fail while THIS bundle —
//      already cached by the PWA shell — keeps rendering the preview from
//      SWR-cached data.
//   3. Same-tree rendering keeps the click-capture targeting
//      (data-block-id/-field/-section) and the CSS outline affordances in the
//      page's own coordinate space — post-transform rects, no cross-document
//      hit-testing.
//
//   Bidirectional selection: clicking a section (or any copy node) on the
//   canvas focuses it in the rail (scroll + outline) and focuses the matching
//   inspector input; clicking a tree row outlines the section on the canvas
//   and scrolls the preview to it.
//
// MOBILE (<768px): two-tab chrome (Preview | Controls, ≥44px tabs).
//   Preview keeps the proven tap-to-select + bottom-sheet editing exactly as
//   before (copy sheet with commit/cancel semantics, settings sheet, add
//   sheet). Controls renders the section tree + inspector as a scrollable
//   list — arrow-button reorder, sheet-based field editing — over the SAME
//   state and the SAME save path.
//
// SAVE PATH (unchanged contract, now carrying assets): a sticky dirty bar
// appears when blocks/assets differ from the last-saved state; Save PUTs
// { blocks, assets } to /api/websites/content (optimistic, with the offline
// outbox queueing connectivity failures exactly as before). Asset generation
// ("Generate with AI") persists server-side immediately via POST
// /api/websites/assets and reconciles both local and SWR state.
// ─────────────────────────────────────────────────────────────────────────────

// Every GENERATED base is an editable surface (Hotfix 2): the archetype pass
// made vitality a first-class generated template (high-contrast-street), so
// its exclusion here falsely told freshly minted vitality sites they
// "predate the cockpit". Ritual and Editorial render body blocks in array
// order; Vitality is a FIXED-SLOT dialect — its sections are block-anchored
// with the same data-block markers, and its fixed-slot editing rules
// (add catalog, no reorder surface) live in editorModel
// (addableSectionCatalog / isFixedSlotTemplate). The map stays Partial so a
// future template key can stage before its cockpit admission — the parent
// gates on it, so no dead editor ever renders.
export const EDITABLE_TEMPLATE_COMPONENTS: Partial<Record<TemplateKey, ComponentType<SiteTemplateProps>>> = {
  ritual: RitualTemplate,
  editorial: EditorialTemplate,
  vitality: VitalityTemplate,
};

// Desktop width the preview is laid out at before scaling (matches
// MiniSitePreview so both surfaces present identical typography).
const DESIGN_WIDTH = 1366;

// Item 4 — Mobile preview design width (iPhone 12/13/14 class). The SAME
// ResizeObserver scaling machinery drives both widths; mobile caps its scale
// at 1 so the frame renders at natural phone size, centered with a
// device-frame hint. HONESTY NOTE: this is a width preview, not a media-query
// emulation — `md:` variants match the WINDOW viewport, so base (mobile-first)
// classes plus real wrapping/cropping at 390px render, while an iframe-free
// preview cannot re-evaluate breakpoints (see the no-iframe rationale above).
// The true device check stays the seller's own phone, where the toggle is
// hidden and the seller IS the mobile preview.
const MOBILE_DESIGN_WIDTH = 390;

// Existing bucket the themes-page brand uploads use — the asset slots reuse
// it (owner-authenticated browser upload, public read).
const BRAND_BUCKET = 'brand';

// Hotfix 4: must outlive the assets route's FULL envelope (maxDuration 300s
// + 10s margin) so the client never aborts a healthy gpt-image-2 render —
// every real failure inside that window arrives as an honest classified
// 'server' error (429/422/504/500) from the route itself; a client-side
// 'timeout' now only means the gateway itself hung past the platform kill.
// The transport default of 12s is for ordinary API calls, not diffusion
// pipelines.
const ASSET_GENERATION_TIMEOUT_MS = 310_000;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

// Mobile settings-sheet labels. Item 2: EVERY section now opens the sheet
// (it hosts the visibility eye + remove for all types); the three historical
// labels stay, everything else falls back to its SECTION_LABELS name.
const CHIP_LABELS: Partial<Record<SiteBlockType, string>> = {
  product_grid: 'Collection layout',
  product_tabs: 'Product tabs',
  video_hero: 'Brand film',
};

type EditingState = {
  blockId: string;
  path: string[];
  meta: FieldMeta;
  /** Value when the edit began — Cancel/Escape restores it. */
  snapshot: string;
  /** Node's post-transform offset inside the preview spacer — the preview
   *  scroll target while the sheet covers the lower viewport. */
  top: number;
};

type PickerState = { mode: 'add' } | { mode: 'replace'; blockId: string };

type ToastState = { kind: 'success' | 'error'; message: string };

// ─────────────────────────────────────────────────────────────────────────────
// Undo/redo history (Shopify-engine Item 3) — session-local by design, never
// persisted. Entries are full {blocks, assets, theme} snapshots; every
// COMMITTED mutation (field commit, add/remove/reorder/hide, theme change,
// asset set/clear) pushes one. Keystrokes never push — only their commit
// does. LIFECYCLE RULES:
//   • push: mutation marks a kind; the effect below snapshots AFTER React
//     settles (functional updates stay safe), dedupes no-op commits, and
//     truncates the redo tail — redo clears on any new edit.
//   • reorder coalescing: framer's Reorder emits one event per row swap, so
//     consecutive 'reorder' commits within 1.2s collapse into one entry.
//   • save: NO stack change — dirty is computed against savedBlocks, so
//     undoing past a save re-dirties honestly and the stack survives.
//   • asset-generation server patch: CLEARS the stack (the server rewrote
//     config.assets outside the editor's mutation stream — an undo across
//     that boundary could resurrect a pre-generation asset state that never
//     existed on the server).
//   • regenerate: the editor remounts (keyed on generated_at) — fresh stack
//     by construction.
// ─────────────────────────────────────────────────────────────────────────────

type HistoryEntry = {
  blocks: SiteBlock[];
  assets: SiteAssets | undefined;
  theme: SiteTheme | undefined;
  kind: string;
  at: number;
};

const HISTORY_LIMIT = 50;
const REORDER_COALESCE_MS = 1200;

export type EditorHistoryHandle = {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
};

type SiteCopyEditorProps = {
  /** Auth user id — namespaces the offline outbox (shared phones: one
   *  account's queued edit must never flush under another's session). */
  userId: string;
  website: ShopWebsiteRow;
  shop: SiteShop;
  /** Receives the fresh row after a successful save (single source of truth
   *  lives in the page's SWR cache). */
  onSaved: (row: ShopWebsiteRow) => void;
  /** Optional dirty-state mirror for the cockpit top bar's save chip. */
  onDirtyChange?: (dirty: boolean) => void;
  /** Optional undo/redo mirror for the cockpit top bar (Item 3) — null on
   *  unmount so the bar never fires a dead handle. */
  onHistoryChange?: (handle: EditorHistoryHandle | null) => void;
  /** Preview device width (Item 4, cockpit toggle): 'desktop' lays the
   *  preview out at 1366, 'mobile' at 390 with a device-frame hint. Ignored
   *  on actual mobile viewports — the seller IS the mobile preview there. */
  previewDevice?: 'desktop' | 'mobile';
};

/** Canonical theme form: {} (and undefined) collapse to undefined so the
 *  dirty check settles clean against rows that never stored a theme. */
function effectiveTheme(theme: SiteTheme | undefined): SiteTheme | undefined {
  if (!theme) return undefined;
  return theme.accent || theme.display_font ? theme : undefined;
}

export default function SiteCopyEditor({
  userId,
  website,
  shop,
  onSaved,
  onDirtyChange,
  onHistoryChange,
  previewDevice = 'desktop',
}: SiteCopyEditorProps) {
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
  const [assets, setAssets] = useState<SiteAssets | undefined>(() =>
    structuredClone(outboxSeed?.assets !== undefined ? outboxSeed.assets : website.config.assets)
  );
  const [savedAssets, setSavedAssets] = useState<SiteAssets | undefined>(() =>
    structuredClone(outboxSeed?.assets !== undefined ? outboxSeed.assets : website.config.assets)
  );
  // Theme layer (Customize cockpit) — same lifecycle as assets: seeded from a
  // queued offline save when one exists, otherwise the stored config.
  const [theme, setTheme] = useState<SiteTheme | undefined>(() =>
    structuredClone(effectiveTheme(outboxSeed?.theme !== undefined ? outboxSeed.theme : website.config.theme))
  );
  const [savedTheme, setSavedTheme] = useState<SiteTheme | undefined>(() =>
    structuredClone(effectiveTheme(outboxSeed?.theme !== undefined ? outboxSeed.theme : website.config.theme))
  );
  // 'queued' = the last save is stored on this device awaiting connectivity.
  const [syncState, setSyncState] = useState<'idle' | 'queued'>(outboxSeed ? 'queued' : 'idle');
  const [products, setProducts] = useState<SiteProduct[]>([]);
  // Mobile copy sheet state (Preview tab taps AND Controls tab field rows).
  const [editing, setEditing] = useState<EditingState | null>(null);
  // Mobile settings sheet (tap-to-select on the preview tab — untouched).
  const [chip, setChip] = useState<{ blockId: string } | null>(null);
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [stillPicker, setStillPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [scale, setScale] = useState(0.4);
  const [contentHeight, setContentHeight] = useState(2400);
  const isMobile = useIsMobileViewport();
  // The focused section — outlined on the canvas, expanded in the rail.
  const [focusedId, setFocusedId] = useState<string | null>(null);
  // Mobile "Add a section" bottom sheet.
  const [addSheet, setAddSheet] = useState(false);
  // Mobile two-tab chrome.
  const [mobileTab, setMobileTab] = useState<'preview' | 'controls'>('preview');
  // Per-slot asset progress messages.
  const [assetBusy, setAssetBusy] = useState<AssetBusyState>({});

  const frameRef = useRef<HTMLDivElement | null>(null);
  const spacerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const railWrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  // Inspector focus snapshots — commit-on-blur mirrors the sheet semantics.
  const inspectorSnapshots = useRef(new Map<string, string>());
  const savedAssetsRef = useRef<SiteAssets | undefined>(savedAssets);
  savedAssetsRef.current = savedAssets;

  // ── Undo/redo stack (Item 3 — see the lifecycle rules above) ──────────────
  const historyRef = useRef<{ entries: HistoryEntry[]; index: number } | null>(null);
  if (historyRef.current === null) {
    historyRef.current = {
      entries: [{
        blocks: structuredClone(blocks),
        assets: structuredClone(assets),
        theme: structuredClone(theme),
        kind: 'init',
        at: Date.now(),
      }],
      index: 0,
    };
  }
  // Pending mutation kind — set by commit-class mutations, consumed by the
  // push effect below after React settles the functional updates.
  const historyMarkRef = useRef<string | null>(null);
  // Set by the asset-generation reconciliation: rebuild the stack around the
  // post-patch state instead of pushing.
  const historyResetRef = useRef(false);
  const [historyUi, setHistoryUi] = useState({ canUndo: false, canRedo: false });

  const markHistory = useCallback((kind: string) => {
    historyMarkRef.current = kind;
  }, []);

  const syncHistoryUi = useCallback(() => {
    const h = historyRef.current!;
    const next = { canUndo: h.index > 0, canRedo: h.index < h.entries.length - 1 };
    setHistoryUi((prev) =>
      prev.canUndo === next.canUndo && prev.canRedo === next.canRedo ? prev : next
    );
  }, []);

  // Push/reset effect — runs after every blocks/assets/theme settle. React
  // flushes passive effects before the next discrete event, so an undo click
  // that follows a commit-blur always sees the pushed entry.
  useEffect(() => {
    const h = historyRef.current!;
    const snapshot = (kind: string): HistoryEntry => ({
      blocks: structuredClone(blocks),
      assets: structuredClone(assets),
      theme: structuredClone(theme),
      kind,
      at: Date.now(),
    });
    if (historyResetRef.current) {
      historyResetRef.current = false;
      historyMarkRef.current = null;
      h.entries = [snapshot('reset')];
      h.index = 0;
      syncHistoryUi();
      return;
    }
    const kind = historyMarkRef.current;
    if (!kind) return;
    historyMarkRef.current = null;
    const current = h.entries[h.index];
    const next = snapshot(kind);
    const unchanged =
      JSON.stringify(next.blocks) === JSON.stringify(current.blocks) &&
      JSON.stringify(next.assets ?? null) === JSON.stringify(current.assets ?? null) &&
      JSON.stringify(next.theme ?? null) === JSON.stringify(current.theme ?? null);
    if (unchanged) return; // no-op commit (blur without change, bounds no-op)
    // Redo clears on new edits: truncate the tail beyond the cursor.
    h.entries = h.entries.slice(0, h.index + 1);
    if (kind === 'reorder' && current.kind === 'reorder' && h.index > 0 && next.at - current.at < REORDER_COALESCE_MS) {
      // Coalesce a drag's per-swap events into one entry.
      h.entries[h.index] = next;
    } else {
      h.entries.push(next);
      h.index += 1;
      if (h.entries.length > HISTORY_LIMIT) {
        h.entries.shift();
        h.index -= 1;
      }
    }
    syncHistoryUi();
  }, [blocks, assets, theme, syncHistoryUi]);

  const applyHistory = useCallback((direction: -1 | 1) => {
    const h = historyRef.current!;
    // Belt and suspenders: a pending unpushed mark must never land ON TOP of
    // the restored snapshot (effects flush before this handler by contract).
    historyMarkRef.current = null;
    const target = h.index + direction;
    if (target < 0 || target >= h.entries.length) return;
    h.index = target;
    const entry = h.entries[target];
    // Dismiss in-flight edit surfaces WITHOUT committing — the restored
    // snapshot is the truth now.
    inspectorSnapshots.current.clear();
    setEditing(null);
    setChip(null);
    // Same setState paths as every mutation → dirty tracking just works.
    setBlocks(structuredClone(entry.blocks));
    setAssets(structuredClone(entry.assets));
    setTheme(structuredClone(entry.theme));
    syncHistoryUi();
  }, [syncHistoryUi]);

  // Cockpit top-bar mirror — handle refreshed on can-state changes, nulled on
  // unmount so the bar never fires into a dead editor.
  useEffect(() => {
    onHistoryChange?.({
      canUndo: historyUi.canUndo,
      canRedo: historyUi.canRedo,
      undo: () => applyHistory(-1),
      redo: () => applyHistory(1),
    });
  }, [historyUi, onHistoryChange, applyHistory]);

  useEffect(() => () => onHistoryChange?.(null), [onHistoryChange]);

  // Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y (⌘ on Mac) — desktop only, and never
  // while a text field is focused (the browser's native text undo owns it).
  useEffect(() => {
    if (isMobile) return;
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key !== 'z' && key !== 'y') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      e.preventDefault();
      if (key === 'y' || (key === 'z' && e.shiftKey)) applyHistory(1);
      else applyHistory(-1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isMobile, applyHistory]);

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
  // now" affordance. flushWebsiteOutbox dedupes in-flight runs, re-checks the
  // row's generated_at before PUTting, and reports how the entry resolved so
  // the banner and the page cache reconcile truthfully.
  const attemptFlush = useCallback(() => {
    const entry = readWebsiteOutbox(userId);
    if (!entry) {
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

  // Item 4: the effective preview device. On actual mobile viewports the
  // toggle is hidden upstream and the historical desktop-width layout stays —
  // the seller IS the mobile preview there.
  const device: 'desktop' | 'mobile' = isMobile ? 'desktop' : previewDevice;
  const designWidth = device === 'mobile' ? MOBILE_DESIGN_WIDTH : DESIGN_WIDTH;

  // Scale to the frame width; track the unscaled content height so the
  // scroll spacer matches the VISUAL height (transforms don't affect layout).
  // Re-bound on viewport/tab/device flips: the frame REMOUNTS when the mobile
  // Controls tab hides it, so the observer must attach to the fresh nodes.
  // Mobile device width caps at scale 1 (natural phone size, centered) —
  // desktop keeps the historical fill-the-frame scale.
  useLayoutEffect(() => {
    const frame = frameRef.current;
    const content = contentRef.current;
    if (!frame || !content) return;
    const update = () => {
      if (frame.clientWidth > 0) {
        const raw = frame.clientWidth / designWidth;
        setScale(device === 'mobile' ? Math.min(1, raw) : raw);
      }
      if (content.offsetHeight > 0) setContentHeight(content.offsetHeight);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    observer.observe(content);
    return () => observer.disconnect();
  }, [isMobile, mobileTab, device, designWidth]);

  // Success toasts auto-dismiss; errors stay until dismissed or superseded.
  useEffect(() => {
    if (toast?.kind !== 'success') return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Focus + select the sheet input the moment an edit begins. `editing` only
  // changes identity on open/close/retarget — never on keystrokes.
  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  // Mobile copy sheet (preview tab): keep the node being edited visible while
  // the sheet covers the lower viewport — scroll INSIDE the preview frame.
  useEffect(() => {
    if (!isMobile || !editing || mobileTab !== 'preview') return;
    frameRef.current?.scrollTo({ top: Math.max(0, editing.top - 96), behavior: 'smooth' });
  }, [isMobile, editing, mobileTab]);

  // HIDDEN-IN-EDITOR CONTRACT (Item 2): the live templates SKIP hidden blocks
  // (resolveVisibleBlocks), but the editor must show them DIMMED, not gone —
  // so the preview strips the hidden flag from body blocks (they render, and
  // the CSS below dims their sections). value_props keeps its flag: its only
  // visual surface is the marquee ribbon — an aria-hidden animated track that
  // cannot dim honestly — so the preview shows exactly what the public site
  // will (tokens drop out), while the rail row carries the dimmed/eye state.
  const previewBlocks = useMemo<SiteBlock[]>(
    () =>
      blocks.map((b) => {
        if (!b.hidden || b.type === 'value_props') return b;
        const next = { ...b };
        delete next.hidden;
        return next;
      }),
    [blocks]
  );

  // Body sections to dim on the canvas (hidden, with a rendered section).
  const hiddenSectionIds = useMemo(
    () => blocks.filter((b) => b.hidden && b.type !== 'value_props').map((b) => b.id),
    [blocks]
  );

  const previewConfig = useMemo<WebsiteConfig>(
    () => ({
      ...website.config,
      // Mirror from ALL blocks (hidden included — content preservation);
      // the render array is the stripped projection above.
      site: blocksToLegacySite(blocks, website.config.site),
      blocks: previewBlocks,
      ...(assets !== undefined ? { assets } : {}),
      // Theme rides the LOCAL state (not the stored config), so a swatch or
      // font tap recolors the live preview instantly; a cleared theme must
      // also OVERRIDE a stored one, hence the explicit undefined spread.
      theme,
    }),
    [blocks, previewBlocks, assets, theme, website.config]
  );

  // Hero fallback chain with the LOCAL asset state — an uploaded/generated
  // hero appears in the preview instantly, before any save. (Pillar 4b: the
  // resolver no longer reads products — raw product media never auto-fills
  // the masthead.)
  const heroMedia = useMemo(
    () => resolveHeroMedia(shop, { assets }),
    [shop, assets]
  );

  const dirty = useMemo(
    () =>
      JSON.stringify(blocks) !== JSON.stringify(savedBlocks) ||
      JSON.stringify(assets ?? null) !== JSON.stringify(savedAssets ?? null) ||
      JSON.stringify(theme ?? null) !== JSON.stringify(savedTheme ?? null),
    [blocks, savedBlocks, assets, savedAssets, theme, savedTheme]
  );

  // Cockpit top-bar mirror — fires only on actual transitions.
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const payloadValid = useMemo(() => blocksAreValid(blocks), [blocks]);

  // Honest add catalog (Hotfix 2): fixed-slot dialects (vitality) offer only
  // block types with a still-empty render slot — an add whose section never
  // appears on the canvas would be a silent failure. Array-order templates
  // keep the full catalog. See editorModel addableSectionCatalog.
  const addCatalog = useMemo(
    () => addableSectionCatalog(website.template_key, blocks),
    [website.template_key, blocks]
  );

  const Template = EDITABLE_TEMPLATE_COMPONENTS[website.template_key];

  const applyFieldValue = useCallback((blockId: string, path: string[], value: string) => {
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? writeBlockField(b, path, value) : b)));
  }, []);

  const editingValue = (() => {
    if (!editing) return '';
    const block = blocks.find((b) => b.id === editing.blockId);
    return block ? readBlockField(block, editing.path) ?? '' : '';
  })();

  // ── Bidirectional selection ────────────────────────────────────────────────

  const scrollPreviewToBlock = useCallback((blockId: string) => {
    const content = contentRef.current;
    const spacer = spacerRef.current;
    const frame = frameRef.current;
    if (!content || !spacer || !frame) return;
    const esc = cssAttrEscape(blockId);
    const el =
      content.querySelector(`[data-block-section="${esc}"]`) ??
      content.querySelector(`[data-block-id="${esc}"]`);
    if (!el) return;
    const top = el.getBoundingClientRect().top - spacer.getBoundingClientRect().top;
    frame.scrollTo({ top: Math.max(0, top - 24), behavior: 'smooth' });
  }, []);

  const scrollRailToBlock = useCallback((blockId: string) => {
    requestAnimationFrame(() => {
      railWrapRef.current
        ?.querySelector(`[data-rail-item="${cssAttrEscape(blockId)}"]`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }, []);

  /** Rail → canvas: outline + scroll the preview to the section. */
  const focusFromRail = useCallback((blockId: string) => {
    setChip(null);
    setEditing(null);
    setFocusedId(blockId);
    scrollPreviewToBlock(blockId);
  }, [scrollPreviewToBlock]);

  /** Canvas → rail: outline + scroll the tree/inspector to the section. */
  const focusFromCanvas = useCallback((blockId: string) => {
    setFocusedId(blockId);
    scrollRailToBlock(blockId);
  }, [scrollRailToBlock]);

  /** Canvas copy-node click (desktop): focus the section AND the exact
   *  inspector input for that field. */
  const focusInspectorField = useCallback((blockId: string, path: string[]) => {
    focusFromCanvas(blockId);
    // Two frames: the inspector for a newly focused section must mount first.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = railWrapRef.current?.querySelector<HTMLElement>(
          `[data-inspector-input="${cssAttrEscape(`${blockId}:${path.join('.')}`)}"]`
        );
        if (!el) return;
        el.focus({ preventScroll: true });
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
    });
  }, [focusFromCanvas]);

  // ── Mobile copy sheet (identical commit semantics to the historical editor) ─

  const beginEditSheet = useCallback((blockId: string, path: string[], top: number) => {
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;
    const meta = fieldMetaFor(block.type, path);
    if (!meta) return;
    setChip(null);
    // Preview-tab contract: exactly one highlight at a time (the copy sheet's
    // node highlight takes over from any section selection). The Controls tab
    // KEEPS its accordion focus — the sheet was opened from inside it.
    if (mobileTab === 'preview') setFocusedId(null);
    setEditing({
      blockId,
      path,
      meta,
      snapshot: readBlockField(block, path) ?? '',
      top,
    });
  }, [blocks, mobileTab]);

  const commitEdit = () => {
    if (!editing) return;
    // Empty copy can never save (required fields are zod min(1)) — an emptied
    // node reverts to its value at edit start; optional fields (empty
    // snapshot) delete their key instead.
    markHistory('field');
    setBlocks((prev) => commitValue(prev, editing.blockId, editing.path, editing.snapshot));
    setEditing(null);
  };

  const cancelEdit = () => {
    if (!editing) return;
    applyFieldValue(editing.blockId, editing.path, editing.snapshot);
    setEditing(null);
  };

  const handleSheetKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commitEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  };

  // ── Inspector field commit-on-blur (desktop rail) ─────────────────────────

  const handleInspectorFocus = useCallback((blockId: string, path: string[]) => {
    const key = `${blockId}:${path.join('.')}`;
    if (inspectorSnapshots.current.has(key)) return;
    const block = blocks.find((b) => b.id === blockId);
    inspectorSnapshots.current.set(key, block ? readBlockField(block, path) ?? '' : '');
  }, [blocks]);

  const handleInspectorBlur = useCallback((blockId: string, path: string[], optional: boolean) => {
    const key = `${blockId}:${path.join('.')}`;
    const snap = inspectorSnapshots.current.get(key);
    inspectorSnapshots.current.delete(key);
    markHistory('field');
    setBlocks((prev) => {
      let fallback = snap ?? '';
      if (!optional && !fallback) {
        // Snapshot lost or was empty for a required field — restore the
        // last-saved copy instead of committing an invalid empty value.
        const saved = savedBlocks.find((b) => b.id === blockId);
        fallback = saved ? readBlockField(saved, path) ?? '' : '';
      }
      return commitValue(prev, blockId, path, optional ? '' : fallback);
    });
  }, [savedBlocks, markHistory]);

  // ── Section operations ─────────────────────────────────────────────────────

  /** Generic select commit (registry kind 'select'). Choosing the
   *  descriptor's clearValue REMOVES the key (absent is the canonical stored
   *  form — Grid|Carousel byte-identically preserved), so toggling away and
   *  back leaves the block untouched and the dirty check settles clean.
   *  writeBlockField's empty-string delete IS the key removal. */
  const setSelectField = (blockId: string, path: string[], value: string, clearValue?: string) => {
    markHistory('select');
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId
          ? writeBlockField(b, path, clearValue !== undefined && value === clearValue ? '' : value)
          : b
      )
    );
  };

  /** Removal (Item 2): ANY block except the last product_grid — the guard is
   *  re-checked here so a hand-crafted call can never orphan the collection. */
  const removeBlock = (blockId: string) => {
    setChip(null);
    setEditing(null);
    setFocusedId((cur) => (cur === blockId ? null : cur));
    markHistory('remove');
    setBlocks((prev) => (canRemoveBlock(prev, blockId) ? prev.filter((b) => b.id !== blockId) : prev));
  };

  /** Visibility eye (Item 2) — dims/skips the section, never deletes it. */
  const toggleHidden = (blockId: string) => {
    markHistory('hide');
    setBlocks((prev) => toggleBlockHidden(prev, blockId));
  };

  /** Full-catalog add (Item 2). video_hero REQUIRES an Ad Studio selection
   *  (Law 4 — never an invented URL), so it routes through the film picker;
   *  every other type inserts its starter block per INSERT_RULES. */
  const addSection = (type: SiteBlockType) => {
    setChip(null);
    setEditing(null);
    setAddSheet(false);
    if (type === 'video_hero') {
      setPicker({ mode: 'add' });
      return;
    }
    if (blocks.length >= MAX_BLOCKS) return;
    const id = mintBlockId(BLOCK_ID_PREFIXES[type], blocks);
    markHistory('add');
    setBlocks((prev) =>
      prev.length >= MAX_BLOCKS ? prev : insertNewBlock(prev, type, mintBlockId(BLOCK_ID_PREFIXES[type], prev))
    );
    setFocusedId(id);
  };

  const addVideoHeroBlock = (selection: VideoHeroSelection) => {
    setChip(null);
    setEditing(null);
    if (blocks.length >= MAX_BLOCKS) return;
    const id = mintBlockId('film', blocks);
    markHistory('add');
    setBlocks((prev) =>
      prev.length >= MAX_BLOCKS
        ? prev
        : insertAfterType(prev, buildVideoHeroBlock(mintBlockId('film', prev), selection), 'hero_banner', 'start')
    );
    setFocusedId(id);
  };

  /** "Change film" on an existing video_hero: swaps the asset, replaces the
   *  poster with the new ad's hero still (or drops the stale one on a manual
   *  URL), and leaves the seller's headline/subheadline copy untouched. */
  const replaceVideoHeroAsset = (blockId: string, selection: VideoHeroSelection) => {
    markHistory('film');
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

  // ── Asset slot operations ──────────────────────────────────────────────────

  const setAssetSlot = useCallback((slot: AssetSlotKind, url: string | null) => {
    // Asset set/clear is a committed mutation (upload landing, Ad-Studio
    // pick, Clear) — one history entry each.
    markHistory('asset');
    setAssets((prev) => {
      const next: SiteAssets = { ...(prev ?? {}) };
      const key = slot === 'hero' ? 'hero_image_url' : 'logo_url';
      if (url) next[key] = url;
      else delete next[key];
      return next;
    });
  }, [markHistory]);

  const setSlotBusy = (slot: AssetSlotKind, message: string | null) => {
    setAssetBusy((prev) => {
      const next = { ...prev };
      if (message) next[slot] = message;
      else delete next[slot];
      return next;
    });
  };

  /** Upload from the device — the exact themes-page 'brand' bucket idiom;
   *  the URL patches local state optimistically and rides the normal save. */
  const handleAssetUpload = async (slot: AssetSlotKind, file: File) => {
    if (!file.type.startsWith('image/')) {
      setToast({ kind: 'error', message: 'Please choose an image file.' });
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setToast({ kind: 'error', message: 'That image is over 8MB — please choose a smaller file.' });
      return;
    }
    setSlotBusy(slot, 'Uploading…');
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${shop.id}/site-${slot}_${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(BRAND_BUCKET).upload(path, file);
      if (error) throw new Error(error.message || 'Upload failed.');
      const { data: { publicUrl } } = supabase.storage.from(BRAND_BUCKET).getPublicUrl(path);
      setAssetSlot(slot, publicUrl);
      setToast({ kind: 'success', message: slot === 'hero' ? 'Hero image ready — save to publish it.' : 'Logo ready — save to publish it.' });
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : 'Upload failed. Please try again.';
      setToast({ kind: 'error', message });
    } finally {
      setSlotBusy(slot, null);
    }
  };

  /** "Generate with AI" — the server engine persists the asset immediately
   *  (service-role patch of config.assets); local + SWR state reconcile,
   *  keeping any UNSAVED local edit to the other slot intact. */
  const handleAssetGenerate = async (slot: AssetSlotKind) => {
    setSlotBusy(slot, slot === 'hero' ? 'Composing your hero shot…' : 'Drafting your logo…');
    try {
      const row = await fetchJSON<ShopWebsiteRow>(
        '/api/websites/assets',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: slot }),
        },
        { timeoutMs: ASSET_GENERATION_TIMEOUT_MS }
      );
      const serverAssets: SiteAssets = row.config.assets ?? {};
      setAssets((prev) => {
        const next: SiteAssets = { ...serverAssets };
        // Preserve an unsaved local edit to the OTHER slot.
        const otherKey = slot === 'hero' ? ('logo_url' as const) : ('hero_image_url' as const);
        const localOther = prev?.[otherKey];
        const savedOther = savedAssetsRef.current?.[otherKey];
        if (localOther !== savedOther) {
          if (localOther) next[otherKey] = localOther;
          else delete next[otherKey];
        }
        return next;
      });
      setSavedAssets(structuredClone(serverAssets));
      // Item 3 lifecycle: the server just rewrote config.assets OUTSIDE the
      // editor's mutation stream — clear the stack around the reconciled
      // state so undo can never resurrect a pre-generation asset state that
      // never existed on the server.
      historyResetRef.current = true;
      onSaved(row);
      setToast({
        kind: 'success',
        message: slot === 'hero' ? 'Hero shot composed and live on your site.' : 'Logo drafted and live on your site.',
      });
    } catch (err) {
      const message = isTransportError(err)
        ? err.kind === 'offline'
          ? 'You appear to be offline — asset generation needs a connection.'
          : err.message
        : 'Failed to generate the asset. Please try again.';
      setToast({ kind: 'error', message });
    } finally {
      setSlotBusy(slot, null);
    }
  };

  // ── Preview click-capture ──────────────────────────────────────────────────
  // The preview renders REAL <a>/<Link> markup — preventDefault +
  // stopPropagation keeps every click on-page. Two island routes stay LIVE:
  // plain [role=tab] clicks switch tabs and [data-carousel-nav] clicks page
  // the carousel. Desktop routes copy/section clicks into the rail
  // (bidirectional selection); mobile keeps the historical tap-to-select +
  // bottom-sheet model untouched.
  const handlePreviewClickCapture = (e: ReactMouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    const copyNode = target.closest<HTMLElement>('[data-block-id][data-block-field]');
    if (!copyNode && (target.closest('[role="tab"]') || target.closest('[data-carousel-nav]'))) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    if (copyNode) {
      const blockId = copyNode.getAttribute('data-block-id');
      const field = copyNode.getAttribute('data-block-field');
      if (!blockId || !field) return;
      const path = field.split('.');
      if (isMobile) {
        const spacer = spacerRef.current;
        const top = spacer
          ? Math.max(0, copyNode.getBoundingClientRect().top - spacer.getBoundingClientRect().top)
          : 0;
        beginEditSheet(blockId, path, top);
      } else {
        focusInspectorField(blockId, path);
      }
      return;
    }

    const sectionNode = target.closest<HTMLElement>('[data-block-section]');
    const sectionId = sectionNode?.getAttribute('data-block-section') ?? null;
    if (sectionId) {
      if (isMobile) {
        // Preview-tab contract (Item 2 extension): EVERY section now opens
        // its settings sheet — the sheet is the canvas-chip surface that
        // hosts the visibility eye and the guarded remove for all types.
        const block = blocks.find((b) => b.id === sectionId);
        if (block) {
          setEditing(null);
          setFocusedId(sectionId);
          setChip({ blockId: sectionId });
        } else {
          setChip(null);
          setFocusedId(null);
        }
      } else {
        focusFromCanvas(sectionId);
      }
      return;
    }

    setChip(null);
    setFocusedId(null);
  };

  // ── Save path ──────────────────────────────────────────────────────────────

  const handleDiscard = () => {
    setEditing(null);
    setChip(null);
    setPicker(null);
    setStillPicker(false);
    inspectorSnapshots.current.clear();
    // Discard is itself an undoable committed mutation — one entry, so an
    // accidental discard is recoverable through the same stack.
    markHistory('discard');
    setBlocks(structuredClone(savedBlocks));
    setAssets(structuredClone(savedAssets));
    setTheme(structuredClone(savedTheme));
    setToast(null);
  };

  const handleSave = async () => {
    // RACE CLOSURE (A1, editor end): while a slot is generating/uploading, a
    // Save's PUT and the asset route's write-back could interleave — the
    // route now merges into a fresh read, and THIS guard (plus the disabled
    // Save button below) removes the overlap entirely. Belt and suspenders:
    // the button is already disabled whenever assetBusy has entries.
    if (Object.keys(assetBusy).length > 0) return;
    // Sanitize every in-flight edit into the payload SYNCHRONOUSLY: the
    // mobile sheet (if open) and any focused inspector fields. Blur handlers
    // fire before this click, but this closure may still see pre-commit
    // state — recomputing the same commitValue here is idempotent with the
    // blur path, so both orderings produce the identical payload.
    let payload = blocks;
    if (editing) {
      payload = commitValue(payload, editing.blockId, editing.path, editing.snapshot);
      setEditing(null);
    }
    for (const [key, snap] of inspectorSnapshots.current.entries()) {
      const sep = key.indexOf(':');
      const blockId = key.slice(0, sep);
      const path = key.slice(sep + 1).split('.');
      const block = payload.find((b) => b.id === blockId);
      const optional = block ? isOptionalField(block.type, path) : false;
      payload = commitValue(payload, blockId, path, optional ? '' : snap);
    }
    inspectorSnapshots.current.clear();
    markHistory('field');
    setBlocks(payload);

    // Belt-and-suspenders: never send a payload the PUT will bounce.
    if (!blocksAreValid(payload)) {
      setToast({ kind: 'error', message: 'A required field is empty — finish it before saving.' });
      return;
    }

    const assetsPayload = assets;
    // Theme wire form: omitted while no theme state exists on either side
    // (stored rows stay byte-identical); once any theme is in play the FULL
    // state ships — a cleared theme sends the explicit {} so the PUT's
    // wholesale replace actually clears the stored object.
    const themeInPlay = theme !== undefined || savedTheme !== undefined;
    const themePayload: SiteTheme | undefined = themeInPlay ? theme ?? {} : undefined;
    // Optimistic: the UI settles clean immediately; the failure paths below
    // decide between queue (connectivity) and rollback (server verdict).
    const rollbackBlocks = savedBlocks;
    const rollbackAssets = savedAssets;
    const rollbackTheme = savedTheme;
    setSavedBlocks(structuredClone(payload));
    setSavedAssets(structuredClone(assetsPayload));
    setSavedTheme(structuredClone(theme));
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
        body: JSON.stringify({
          blocks: payload,
          ...(assetsPayload !== undefined ? { assets: assetsPayload } : {}),
          ...(themePayload !== undefined ? { theme: themePayload } : {}),
        }),
      });
      setSyncState('idle');
      setToast({ kind: 'success', message: 'Saved — your site is updated.' });
      onSaved(row);
    } catch (err) {
      if (isTransportError(err) && (err.kind === 'offline' || err.kind === 'timeout')) {
        // Connectivity failure: queue on-device (user-namespaced, pinned to
        // this build's generated_at) and tell the truth in the save bar.
        const queued = queueWebsiteSave(userId, {
          blocks: payload,
          ...(assetsPayload !== undefined ? { assets: assetsPayload } : {}),
          ...(themePayload !== undefined ? { theme: themePayload } : {}),
          baseGeneratedAt: website.generated_at,
        });
        if (queued) {
          setSyncState('queued');
        } else {
          setSavedBlocks(rollbackBlocks);
          setSavedAssets(rollbackAssets);
          setSavedTheme(rollbackTheme);
          setToast({
            kind: 'error',
            message: 'You appear to be offline and this change could not be stored for later — please try again once connected.',
          });
        }
      } else if (isTransportError(err) && err.kind === 'server') {
        // The API rejected the payload — NEVER queue a payload that cannot
        // succeed. Roll back the saved marker so the dirty bar returns, but
        // KEEP the seller's edits in the editor.
        setSavedBlocks(rollbackBlocks);
        setSavedAssets(rollbackAssets);
        setSavedTheme(rollbackTheme);
        setToast({ kind: 'error', message: err.message || 'Failed to save your changes.' });
      } else if (isTransportError(err) && err.kind === 'abort') {
        setSavedBlocks(rollbackBlocks);
        setSavedAssets(rollbackAssets);
        setSavedTheme(rollbackTheme);
      } else {
        setSavedBlocks(rollbackBlocks);
        setSavedAssets(rollbackAssets);
        setSavedTheme(rollbackTheme);
        setToast({ kind: 'error', message: 'Network error saving your changes. Please try again.' });
      }
    } finally {
      setSaving(false);
    }
  };

  if (!Template) return null;

  const atBudget = editing ? editingValue.length >= editing.meta.max : false;
  // Chip block resolved live from state: removal or discard unmounts the
  // sheet automatically, and the toggle reads the current displayMode.
  const chipBlock = chip ? blocks.find((b) => b.id === chip.blockId) : undefined;
  const atBlockCapacity = blocks.length >= MAX_BLOCKS;
  const queued = syncState === 'queued';
  const showPreview = !isMobile || mobileTab === 'preview';
  // A1: Save waits for asset slots — honest hint in the dirty bar while the
  // hero/logo pipeline (or an upload) is still writing its slot.
  const busySlots = Object.keys(assetBusy) as AssetSlotKind[];
  const assetBusyHint =
    busySlots.length === 0
      ? null
      : busySlots.includes('hero')
        ? 'Finishing your hero…'
        : 'Finishing your logo…';

  const assetSlotsNode = (
    <AssetSlots
      assets={assets}
      heroFallback={resolveHeroMedia(shop)}
      shopLogoUrl={shop.logo_url}
      busy={assetBusy}
      onUpload={(slot, file) => void handleAssetUpload(slot, file)}
      onGenerate={(slot) => void handleAssetGenerate(slot)}
      onPickAdStill={() => setStillPicker(true)}
      onClear={(slot) => setAssetSlot(slot, null)}
    />
  );

  // Theme controls (accent swatches + font picker) — writes the same local
  // theme state the live preview renders through the chrome's variable seam.
  const themePanelNode = (
    <ThemePanel
      templateKey={website.template_key}
      theme={theme}
      onChange={(next) => {
        // Theme changes are committed mutations (swatch/font taps commit
        // instantly) — one history entry each.
        markHistory('theme');
        setTheme(next);
      }}
    />
  );

  const sectionRail = (
    <SectionRail
      blocks={blocks}
      templateKey={website.template_key}
      focusedId={focusedId}
      isMobile={isMobile}
      saving={saving}
      atCapacity={atBlockCapacity}
      onFocus={(id) => (isMobile ? setFocusedId((cur) => (cur === id ? null : id)) : focusFromRail(id))}
      onReorderIds={(ids) => {
        markHistory('reorder');
        setBlocks((prev) => reorderBlocksByIds(prev, ids));
      }}
      onMove={(id, dir) => {
        markHistory('reorder');
        setBlocks((prev) => moveBlock(prev, id, dir));
      }}
      onRemove={removeBlock}
      onAddSection={addSection}
      onToggleHidden={toggleHidden}
      onChangeFilm={(id) => setPicker({ mode: 'replace', blockId: id })}
      onSelectSetting={setSelectField}
      onAddGroupItem={(id, groupPath) => {
        markHistory('group');
        setBlocks((prev) => prev.map((b) => (b.id === id ? addGroupItem(b, groupPath) : b)));
      }}
      onRemoveGroupItem={(id, groupPath, i) => {
        markHistory('group');
        setBlocks((prev) => prev.map((b) => (b.id === id ? removeGroupItem(b, groupPath, i) : b)));
      }}
      onFieldChange={applyFieldValue}
      onFieldFocus={handleInspectorFocus}
      onFieldBlur={handleInspectorBlur}
      onEditFieldSheet={(blockId, path) => beginEditSheet(blockId, path, 0)}
      assetSlots={assetSlotsNode}
      themePanel={themePanelNode}
    />
  );

  return (
    <div className="sndk-copy-editor">
      {/* Editing affordances — scoped to the editor frame only; the public
          site never loads this component. Hover reveals are DESKTOP-ONLY:
          on touch the tap-to-select model owns selection. */}
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

      {/* Hidden sections render DIMMED on the canvas (Item 2) — still
          clickable/focusable, so the rail eye toggle stays one tap away. */}
      {hiddenSectionIds.length > 0 && (
        <style>{hiddenSectionIds
          .map(
            (id) =>
              `.sndk-copy-editor [data-block-section="${cssAttrEscape(id)}"] { opacity: .4; filter: grayscale(.65); }`
          )
          .join('\n')}</style>
      )}

      {/* Focused-section outline — canvas side of the bidirectional selection
          (desktop rail focus AND mobile tap-to-select share it). */}
      {focusedId && (
        <style>{`
          .sndk-copy-editor [data-block-section="${cssAttrEscape(focusedId)}"] {
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

      {/* Mobile two-tab chrome — Preview | Controls (≥44px tabs). */}
      {isMobile && (
        <div className="mb-3 grid grid-cols-2 gap-1 rounded-full border border-gray-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setMobileTab('preview')}
            className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition ${
              mobileTab === 'preview' ? 'bg-gray-900 text-white' : 'text-gray-500 active:bg-gray-50'
            }`}
          >
            <Eye size={13} /> Preview
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('controls')}
            className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition ${
              mobileTab === 'controls' ? 'bg-gray-900 text-white' : 'text-gray-500 active:bg-gray-50'
            }`}
          >
            <SlidersHorizontal size={13} /> Controls
          </button>
        </div>
      )}

      {/* ── The split workspace ─────────────────────────────────────────── */}
      <div className="md:grid md:grid-cols-[350px_minmax(0,1fr)] md:items-start md:gap-4">
        {/* LEFT — desktop rail (section tree + inspector). */}
        {!isMobile && (
          <div
            ref={railWrapRef}
            className="hidden overflow-hidden rounded-[1.5rem] border border-gray-200 bg-white p-4 shadow-sm md:block md:h-[665px]"
          >
            {sectionRail}
          </div>
        )}

        {/* RIGHT — the live preview (see the header for the no-iframe note). */}
        {showPreview && (
          <div>
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
                  <MousePointerClick size={12} /> Click any section or copy to edit it
                </span>
                <span className="ml-3 flex shrink-0 items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-gray-400 md:hidden">
                  <MousePointerClick size={12} /> Tap text to edit
                </span>
              </div>

              {/* Scaled, scrollable live preview — overscroll-contained so
                  reaching its edge on a phone never chains into
                  pull-to-refresh. */}
              <div
                ref={frameRef}
                onClickCapture={handlePreviewClickCapture}
                className="relative h-[540px] w-full overflow-y-auto overflow-x-hidden overscroll-contain bg-white md:h-[620px]"
              >
                {/* Item 4: in mobile device mode the spacer narrows to the
                    scaled 390px column, centers, and wears a subtle rounded
                    device-frame hint. Rect math is width-agnostic: section
                    and copy-node targeting measure post-transform rects
                    relative to THIS spacer at both widths. */}
                <div
                  ref={spacerRef}
                  className={`relative ${
                    device === 'mobile'
                      ? 'mx-auto my-4 overflow-hidden rounded-[1.75rem] shadow-xl ring-4 ring-gray-900'
                      : ''
                  }`}
                  style={{
                    height: Math.max(1, contentHeight * scale),
                    ...(device === 'mobile' ? { width: Math.max(1, designWidth * scale) } : {}),
                  }}
                >
                  <div
                    ref={contentRef}
                    className="absolute left-0 top-0 origin-top-left"
                    style={{ width: designWidth, transform: `scale(${scale})` }}
                  >
                    {/* GatedVideoPreviewScope: every hero/gallery video in the
                        scaled preview renders its static poster state — no
                        autoplay storm, no dead play button under the editor's
                        click-capture.
                        RevealPreviewScope: entrance animations render static —
                        the click-overlay and scroll targeting measure
                        post-transform DOM rects, and a mid-animation translateY
                        would corrupt every measurement.
                        StoryClampPreviewScope: the brand-story teaser renders
                        EXPANDED and static — the story copy node stays fully
                        clickable/measurable, and no reveal button sits under
                        the click-capture. */}
                    <GatedVideoPreviewScope>
                      <RevealPreviewScope>
                        <StoryClampPreviewScope>
                          <Template shop={shop} products={products} config={previewConfig} heroMedia={heroMedia} />
                        </StoryClampPreviewScope>
                      </RevealPreviewScope>
                    </GatedVideoPreviewScope>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile add-section bar (preview tab) — the historical entry
                point stays; Controls carries its own add buttons. */}
            {isMobile && (
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[1.5rem] border border-gray-200 bg-white px-5 py-4 shadow-sm">
                <div className="mr-auto">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Add a section</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {atBlockCapacity
                      ? 'Your page is at its 12-section limit — remove a section to add another.'
                      : addCatalog.length === 0
                        ? 'Every section this layout supports is already on your page.'
                        : 'New sections drop straight into the preview — tap a section for its settings, then save to publish.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAddSheet(true)}
                  disabled={atBlockCapacity || saving || addCatalog.length === 0}
                  className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-700 transition active:bg-gray-100 disabled:opacity-40"
                >
                  <Plus size={14} /> Add a section
                </button>
              </div>
            )}
          </div>
        )}

        {/* Mobile Controls tab — tree + inspector as a scrollable list. */}
        {isMobile && mobileTab === 'controls' && (
          <div ref={railWrapRef} className="rounded-[1.5rem] border border-gray-200 bg-white p-3.5 shadow-sm">
            {sectionRail}
          </div>
        )}
      </div>

      {/* Ad Studio film picker — add flow inserts a new video_hero block,
          replace flow swaps the asset on an existing one. */}
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
        {stillPicker && (
          <HeroImagePicker
            key="still-picker"
            shopId={shop.id}
            onClose={() => setStillPicker(false)}
            onSelect={(url) => {
              setAssetSlot('hero', url);
              setStillPicker(false);
              setToast({ kind: 'success', message: 'Hero image set — save to publish it.' });
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Mobile bottom sheets (Gambia Standard) — the touch counterparts
          of the settings chip, the add buttons, and the copy editor. */}
      {isMobile && (
        <AnimatePresence>
          {chip && chipBlock && (
            <BottomSheet
              key={`settings-${chip.blockId}`}
              label={CHIP_LABELS[chipBlock.type] ?? SECTION_LABELS[chipBlock.type]}
              onDismiss={() => setChip(null)}
            >
              <div className="space-y-1 px-3 pb-2">
                {/* Registry-driven select rows (kind 'select') — the sheet is
                    the canvas-chip surface of the SAME BLOCK_SETTINGS table
                    the rail renders, so a new select descriptor appears here
                    with zero sheet code (Grid|Carousel byte-for-byte). */}
                {BLOCK_SETTINGS[chipBlock.type].map((setting) => {
                  if (setting.kind !== 'select') return null;
                  const path = setting.path.split('.');
                  const current =
                    readBlockField(chipBlock, path) ?? setting.clearValue ?? setting.options[0]?.value ?? '';
                  return (
                    <Fragment key={`${chipBlock.id}:${setting.path}`}>
                      {setting.options.map((opt) => {
                        const Icon = SELECT_OPTION_ICONS[opt.value];
                        const active = current === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setSelectField(chipBlock.id, path, opt.value, setting.clearValue)}
                            className={`flex min-h-[48px] w-full items-center gap-3 rounded-2xl px-4 text-left text-sm font-semibold transition ${
                              active ? 'bg-gray-900 text-white' : 'text-gray-700 active:bg-gray-100'
                            }`}
                          >
                            {Icon && <Icon size={16} className="shrink-0" />}
                            <span className="flex-1">{opt.label}</span>
                            {active && <Check size={16} className="shrink-0" />}
                          </button>
                        );
                      })}
                    </Fragment>
                  );
                })}
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
                {/* Visibility eye (Item 2) — every section, ≥48px row. */}
                <button
                  type="button"
                  onClick={() => toggleHidden(chipBlock.id)}
                  className="flex min-h-[48px] w-full items-center gap-3 rounded-2xl px-4 text-left text-sm font-semibold text-gray-700 transition active:bg-gray-100"
                >
                  {chipBlock.hidden ? (
                    <Eye size={16} className="shrink-0" />
                  ) : (
                    <EyeOff size={16} className="shrink-0" />
                  )}
                  <span className="flex-1">{chipBlock.hidden ? 'Show section' : 'Hide section'}</span>
                </button>
                {/* Remove — any section except the last product_grid. */}
                {canRemoveBlock(blocks, chipBlock.id) ? (
                  <button
                    type="button"
                    onClick={() => removeBlock(chipBlock.id)}
                    className="flex min-h-[48px] w-full items-center gap-3 rounded-2xl px-4 text-left text-sm font-semibold text-red-600 transition active:bg-red-50"
                  >
                    <Trash2 size={16} className="shrink-0" />
                    <span className="flex-1">Remove section</span>
                  </button>
                ) : (
                  <p className="px-4 py-2 text-xs leading-relaxed text-gray-400">{REMOVE_GUARD_HINT}</p>
                )}
              </div>
            </BottomSheet>
          )}

          {editing && (
            <BottomSheet
              key="copy-sheet"
              label={editing.meta.label}
              // Same contract as ever: dismissive gestures (backdrop, drag,
              // ✕) COMMIT — the seller watched the preview update live while
              // typing; Escape and Cancel restore the edit-start snapshot.
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
                  <span className="text-xs font-medium text-gray-500">
                    {mobileTab === 'preview' ? 'Updates live in the preview above' : 'Updates live on your page'}
                  </span>
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
                    onKeyDown={handleSheetKeyDown}
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
                    onKeyDown={handleSheetKeyDown}
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50/60 px-4 py-3.5 font-sans text-base text-gray-900 outline-none transition focus:border-[#f0a500] focus:bg-white focus:ring-1 focus:ring-[#f0a500]"
                  />
                )}
              </div>
            </BottomSheet>
          )}

          {addSheet && (
            <BottomSheet key="add-sheet" label="Add a section" onDismiss={() => setAddSheet(false)}>
              {/* Honest catalog (Item 2 + Hotfix 2) — one ≥56px row per block
                  type the TEMPLATE can render (fixed-slot dialects offer only
                  still-empty slots), with an honest description; the film row
                  hands off to the Ad Studio picker (one sheet at a time on a
                  phone). */}
              <div className="space-y-1 px-3 pb-2">
                {addCatalog.map(({ type, description }) => {
                  const Icon = BLOCK_TYPE_ICONS[type];
                  const opensPicker = type === 'video_hero';
                  return (
                    <button
                      key={type}
                      type="button"
                      disabled={atBlockCapacity}
                      onClick={() => addSection(type)}
                      className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl px-4 text-left transition active:bg-gray-100 disabled:opacity-40"
                    >
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          opensPicker ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        <Icon size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-gray-900">{SECTION_LABELS[type]}</span>
                        <span className="block truncate text-xs text-gray-500">{description}</span>
                      </span>
                      {opensPicker && <ChevronRight size={16} className="shrink-0 text-gray-300" />}
                    </button>
                  );
                })}
              </div>
            </BottomSheet>
          )}
        </AnimatePresence>
      )}

      {/* Sticky save bar — unsaved changes, sync status, and toasts.
          bottom offset carries the safe-area inset so the bar clears the
          home-indicator region on notched phones. */}
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
                {assetBusyHint
                  ? `${assetBusyHint} Save unlocks the moment it lands.`
                  : payloadValid
                    ? 'Unsaved changes — save to update your live site.'
                    : 'A required field is empty — finish it to save.'}
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
                  className="min-h-[44px] rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 transition hover:text-gray-600"
                >
                  Dismiss
                </button>
              )}
              {queued && !dirty && (
                <button
                  onClick={attemptFlush}
                  disabled={saving}
                  className="flex min-h-[44px] items-center gap-1.5 rounded-full bg-gray-50 px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-600 transition hover:bg-gray-100 disabled:opacity-50"
                >
                  <RefreshCw size={12} /> Sync now
                </button>
              )}
              {dirty && (
                <>
                  {/* Item 3: the dirty bar's Undo — one committed mutation
                      back, same stack as the cockpit buttons and Ctrl+Z. */}
                  {historyUi.canUndo && (
                    <button
                      onClick={() => applyHistory(-1)}
                      disabled={saving}
                      className="flex min-h-[44px] items-center gap-1.5 rounded-full bg-gray-50 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-600 transition hover:bg-gray-100 disabled:opacity-50"
                    >
                      <Undo2 size={12} /> Undo
                    </button>
                  )}
                  <button
                    onClick={handleDiscard}
                    disabled={saving}
                    className="flex min-h-[44px] items-center gap-1.5 rounded-full bg-gray-50 px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-600 transition hover:bg-gray-100 disabled:opacity-50"
                  >
                    <RotateCcw size={12} /> Discard
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !payloadValid || busySlots.length > 0}
                    className="flex min-h-[44px] items-center gap-1.5 rounded-full bg-gradient-to-r from-[#1a2e1a] to-gray-900 px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-md transition hover:opacity-90 active:scale-95 disabled:opacity-60"
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
