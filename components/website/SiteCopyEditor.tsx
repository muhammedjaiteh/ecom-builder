'use client';

import { createBrowserClient } from '@supabase/ssr';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { CheckCircle2, Loader2, MousePointerClick, Save, Undo2, X } from 'lucide-react';
import EditorialTemplate from '@/components/site-templates/EditorialTemplate';
import RitualTemplate from '@/components/site-templates/RitualTemplate';
import {
  SITE_COPY_LIMITS,
  blocksToLegacySite,
  resolveBlocks,
  resolveHeroMedia,
  type ShopWebsiteRow,
  type SiteBlock,
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
// /api/websites/content, Discard restores. v1 scope is COPY editing only —
// no block add/remove/reorder.
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
};

function normalizeFieldPath(field: string): string {
  return field.replace(/\.\d+\./g, '.*.');
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

type ToastState = { kind: 'success' | 'error'; message: string };

type SiteCopyEditorProps = {
  website: ShopWebsiteRow;
  shop: SiteShop;
  /** Receives the fresh row after a successful save (single source of truth
   *  lives in the page — the studio's copy preview updates with it). */
  onSaved: (row: ShopWebsiteRow) => void;
};

export default function SiteCopyEditor({ website, shop, onSaved }: SiteCopyEditorProps) {
  const [blocks, setBlocks] = useState<SiteBlock[]>(() => structuredClone(resolveBlocks(website.config)));
  const [savedBlocks, setSavedBlocks] = useState<SiteBlock[]>(() => structuredClone(resolveBlocks(website.config)));
  const [products, setProducts] = useState<SiteProduct[]>([]);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [scale, setScale] = useState(0.4);
  const [contentHeight, setContentHeight] = useState(2400);

  const frameRef = useRef<HTMLDivElement | null>(null);
  const spacerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
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
  // opens the editor. Clicks inside the overlay input pass through untouched.
  const handlePreviewClickCapture = (e: ReactMouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (overlayRef.current?.contains(target)) return;
    e.preventDefault();
    e.stopPropagation();
    const node = target.closest<HTMLElement>('[data-block-id][data-block-field]');
    if (node) beginEdit(node);
  };

  const handleDiscard = () => {
    setEditing(null);
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
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch('/api/websites/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks: payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({ kind: 'error', message: data.error || 'Failed to save your changes.' });
        return;
      }
      setSavedBlocks(structuredClone(payload));
      setToast({ kind: 'success', message: 'Copy saved — your site is updated.' });
      onSaved(data as ShopWebsiteRow);
    } catch {
      setToast({ kind: 'error', message: 'Network error saving your changes. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const atBudget = editing ? editingValue.length >= editing.meta.max : false;

  return (
    <div className="sndk-copy-editor">
      {/* Hover affordance for every editable copy node — scoped to the editor
          frame only; the public site never loads this component. */}
      <style>{`
        .sndk-copy-editor [data-block-id][data-block-field] {
          cursor: pointer;
          outline: 2px dashed transparent;
          outline-offset: 6px;
          transition: outline-color .15s ease, background-color .15s ease;
        }
        .sndk-copy-editor [data-block-id][data-block-field]:hover {
          outline-color: rgba(240, 165, 0, .85);
          background-color: rgba(240, 165, 0, .08);
        }
      `}</style>

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
        </div>

        {/* Scaled, scrollable live preview */}
        <div
          ref={frameRef}
          onClickCapture={handlePreviewClickCapture}
          className="relative h-[540px] w-full overflow-y-auto overflow-x-hidden bg-white md:h-[620px]"
        >
          <div ref={spacerRef} className="relative" style={{ height: Math.max(1, contentHeight * scale) }}>
            <div
              ref={contentRef}
              className="absolute left-0 top-0 origin-top-left"
              style={{ width: DESIGN_WIDTH, transform: `scale(${scale})` }}
            >
              <Template shop={shop} products={products} config={previewConfig} heroMedia={heroMedia} />
            </div>

            {/* Overlay editor — unscaled coordinate space, scrolls with the page */}
            {editing && (
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
          </div>
        </div>
      </div>

      {/* Sticky save bar — appears only with unsaved changes */}
      {(dirty || toast) && (
        <div className="sticky bottom-4 z-30 mt-4">
          <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3 rounded-full border border-gray-200 bg-white/95 px-5 py-3 shadow-xl backdrop-blur">
            {toast ? (
              <p className={`flex items-center gap-2 text-sm font-medium ${toast.kind === 'success' ? 'text-emerald-700' : 'text-red-700'}`}>
                {toast.kind === 'success' ? <CheckCircle2 size={15} /> : <X size={15} />}
                {toast.message}
              </p>
            ) : (
              <p className="text-sm font-medium text-gray-700">
                Unsaved copy changes — save to update your live site.
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
