'use client';

import { useRef, type ReactNode } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clapperboard,
  Film,
  GalleryHorizontal,
  GripVertical,
  LayoutGrid,
  Plus,
  Rows3,
  Trash2,
} from 'lucide-react';
import type { SiteBlock } from '@/lib/siteTemplates';
import {
  SECTION_LABELS,
  SELLER_ADDED_TYPES,
  blockExcerpt,
  fieldsForBlock,
  readBlockField,
  type EditorField,
} from './editorModel';

// ─────────────────────────────────────────────────────────────────────────────
// SectionRail — the Shopify-style section tree + inspector.
//
// Desktop (≥768px): the ~350px left sidebar. framer-motion Reorder gives
// drag-to-reorder on a dedicated grip (dragListener=false + dragControls, so
// row clicks stay focus clicks); the inspector for the focused section
// renders beneath the tree with inline copy inputs (live budgets), the
// Grid|Carousel toggle, tab editing, film/removal controls, and the asset
// slots on the hero section.
//
// Mobile (<768px, the Controls tab): the same tree as a scrollable list —
// ≥44px rows, arrow-button reorder (drag inside a scrolling list fights the
// scroll gesture on touch), and the focused section's inspector expands
// inline as an accordion whose field rows open the keyboard-safe bottom-sheet
// editor (sheet state owned by SiteCopyEditor — same commit semantics as the
// preview-tap path).
//
// All state lives in SiteCopyEditor: every control writes the SAME blocks/
// assets state the live preview renders from, so each keystroke/toggle is
// instantly visible and rides the one dirty-bar + outbox save path.
// ─────────────────────────────────────────────────────────────────────────────

export type SectionRailProps = {
  blocks: SiteBlock[];
  focusedId: string | null;
  isMobile: boolean;
  saving: boolean;
  atCapacity: boolean;
  onFocus: (blockId: string) => void;
  onReorderIds: (ids: string[]) => void;
  onMove: (blockId: string, direction: -1 | 1) => void;
  onRemove: (blockId: string) => void;
  onAddTabsSection: () => void;
  onAddFilmSection: () => void;
  onChangeFilm: (blockId: string) => void;
  onSetGridMode: (blockId: string, mode: 'grid' | 'carousel') => void;
  onAddTab: (blockId: string) => void;
  onRemoveTab: (blockId: string, index: number) => void;
  /** Desktop inline input events — the parent owns snapshot/commit. */
  onFieldChange: (blockId: string, path: string[], value: string) => void;
  onFieldFocus: (blockId: string, path: string[]) => void;
  onFieldBlur: (blockId: string, path: string[], optional: boolean) => void;
  /** Mobile: open the bottom-sheet editor for a field. */
  onEditFieldSheet: (blockId: string, path: string[]) => void;
  /** Hero-section asset slots, rendered by the parent (owns upload/generate). */
  assetSlots: ReactNode;
};

const inspectorInputKey = (blockId: string, path: string[]) => `${blockId}:${path.join('.')}`;

// ── Desktop inline field ─────────────────────────────────────────────────────

function InspectorField({
  block,
  field,
  onChange,
  onFocus,
  onBlur,
}: {
  block: SiteBlock;
  field: EditorField;
  onChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
}) {
  const value = readBlockField(block, field.path) ?? '';
  const atBudget = value.length >= field.meta.max;
  const shared =
    'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 font-sans text-sm text-gray-900 outline-none transition focus:border-[#f0a500] focus:ring-1 focus:ring-[#f0a500]';
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
          {field.meta.label}
          {field.optional && <span className="ml-1 font-medium normal-case tracking-normal text-gray-300">optional</span>}
        </span>
        <span className={`font-mono text-[10px] font-bold ${atBudget ? 'text-amber-600' : 'text-gray-300'}`}>
          {value.length}/{field.meta.max}
        </span>
      </span>
      {field.meta.multiline ? (
        <textarea
          value={value}
          maxLength={field.meta.max}
          rows={Math.min(6, Math.max(2, Math.ceil(field.meta.max / 110)))}
          data-inspector-input={inspectorInputKey(block.id, field.path)}
          onChange={(e) => onChange(e.target.value.slice(0, field.meta.max))}
          onFocus={onFocus}
          onBlur={onBlur}
          className={`${shared} mt-1.5 resize-none leading-relaxed`}
        />
      ) : (
        <input
          type="text"
          value={value}
          maxLength={field.meta.max}
          data-inspector-input={inspectorInputKey(block.id, field.path)}
          onChange={(e) => onChange(e.target.value.slice(0, field.meta.max))}
          onFocus={onFocus}
          onBlur={onBlur}
          className={`${shared} mt-1.5`}
        />
      )}
    </label>
  );
}

// ── Shared inspector body (fields + section controls) ───────────────────────

function InspectorBody(props: SectionRailProps & { block: SiteBlock }) {
  const { block, isMobile } = props;
  const fields = fieldsForBlock(block);

  return (
    <div className="space-y-3">
      {/* Copy fields */}
      {fields.map((field) => {
        const key = inspectorInputKey(block.id, field.path);
        if (isMobile) {
          const value = readBlockField(block, field.path) ?? '';
          return (
            <button
              key={key}
              type="button"
              onClick={() => props.onEditFieldSheet(block.id, field.path)}
              className="flex min-h-[48px] w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-left transition active:bg-gray-50"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  {field.meta.label}
                </span>
                <span className={`block truncate text-sm ${value ? 'text-gray-900' : 'text-gray-300'}`}>
                  {value || 'Tap to write'}
                </span>
              </span>
              <ChevronRight size={15} className="shrink-0 text-gray-300" />
            </button>
          );
        }
        return (
          <InspectorField
            key={key}
            block={block}
            field={field}
            onChange={(value) => props.onFieldChange(block.id, field.path, value)}
            onFocus={() => props.onFieldFocus(block.id, field.path)}
            onBlur={() => props.onFieldBlur(block.id, field.path, field.optional)}
          />
        );
      })}

      {/* product_grid: Grid | Carousel presentation toggle */}
      {block.type === 'product_grid' && (
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">Layout</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => props.onSetGridMode(block.id, 'grid')}
              className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition ${
                (block.displayMode ?? 'grid') === 'grid'
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
              }`}
            >
              <LayoutGrid size={13} /> Grid
            </button>
            <button
              type="button"
              onClick={() => props.onSetGridMode(block.id, 'carousel')}
              className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition ${
                block.displayMode === 'carousel'
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
              }`}
            >
              <GalleryHorizontal size={13} /> Carousel
            </button>
          </div>
        </div>
      )}

      {/* product_tabs: add/remove tabs inside the 2–4 schema window */}
      {block.type === 'product_tabs' && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={block.tabs.length >= 4}
            onClick={() => props.onAddTab(block.id)}
            className="flex min-h-[44px] items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 text-[10px] font-bold uppercase tracking-widest text-gray-700 transition hover:border-gray-900 disabled:opacity-40"
          >
            <Plus size={12} /> Add tab
          </button>
          {block.tabs.length > 2 &&
            block.tabs.map((tab, i) => (
              <button
                key={`remove-${i}`}
                type="button"
                onClick={() => props.onRemoveTab(block.id, i)}
                className="flex min-h-[44px] items-center gap-1.5 rounded-full border border-red-200 bg-white px-4 text-[10px] font-bold uppercase tracking-widest text-red-600 transition hover:bg-red-50"
              >
                <Trash2 size={11} /> {tab.title.slice(0, 14) || `Tab ${i + 1}`}
              </button>
            ))}
        </div>
      )}

      {/* video_hero: swap the film asset */}
      {block.type === 'video_hero' && (
        <button
          type="button"
          onClick={() => props.onChangeFilm(block.id)}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white text-[10px] font-bold uppercase tracking-widest text-gray-700 transition hover:border-gray-900"
        >
          <Film size={13} /> Change film
        </button>
      )}

      {/* hero_banner: the asset slots (hero image + logo) */}
      {block.type === 'hero_banner' && props.assetSlots}

      {/* Seller-added sections can be removed; the classic five are anatomy */}
      {SELLER_ADDED_TYPES.has(block.type) && (
        <button
          type="button"
          onClick={() => props.onRemove(block.id)}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white text-[10px] font-bold uppercase tracking-widest text-red-600 transition hover:bg-red-50"
        >
          <Trash2 size={13} /> Remove section
        </button>
      )}
    </div>
  );
}

// ── Desktop tree item (drag grip + focus row) ────────────────────────────────

function DesktopTreeItem({
  block,
  index,
  focused,
  onFocus,
}: {
  block: SiteBlock;
  index: number;
  focused: boolean;
  onFocus: () => void;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={block.id}
      dragListener={false}
      dragControls={controls}
      className="list-none"
      data-rail-item={block.id}
    >
      <div
        className={`flex items-center gap-1.5 rounded-xl border transition ${
          focused ? 'border-[#f0a500] bg-amber-50/60' : 'border-transparent hover:bg-gray-50'
        }`}
      >
        <button
          type="button"
          aria-label={`Reorder ${SECTION_LABELS[block.type]}`}
          onPointerDown={(e) => {
            e.preventDefault();
            controls.start(e);
          }}
          className="flex h-11 w-8 shrink-0 cursor-grab touch-none items-center justify-center text-gray-300 transition hover:text-gray-500 active:cursor-grabbing"
        >
          <GripVertical size={14} />
        </button>
        <button
          type="button"
          onClick={onFocus}
          className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2.5 py-1.5 pr-2.5 text-left"
        >
          <span className="w-4 shrink-0 font-mono text-[10px] text-gray-300">{index + 1}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-bold uppercase tracking-widest text-gray-500">
              {SECTION_LABELS[block.type]}
            </span>
            <span className="block truncate text-xs text-gray-400">{blockExcerpt(block)}</span>
          </span>
          <ChevronRight size={14} className={`shrink-0 ${focused ? 'text-[#f0a500]' : 'text-gray-200'}`} />
        </button>
      </div>
    </Reorder.Item>
  );
}

// ── The rail ─────────────────────────────────────────────────────────────────

export default function SectionRail(props: SectionRailProps) {
  const { blocks, focusedId, isMobile, saving, atCapacity } = props;
  const railRef = useRef<HTMLDivElement | null>(null);
  const focusedBlock = focusedId ? blocks.find((b) => b.id === focusedId) ?? null : null;

  const addButtons = (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
        {atCapacity ? 'At the 12-section limit — remove one to add another.' : 'Add a section'}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={props.onAddFilmSection}
          disabled={atCapacity || saving}
          className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white text-[10px] font-bold uppercase tracking-widest text-gray-700 transition hover:border-gray-900 disabled:opacity-40"
        >
          <Clapperboard size={12} /> Brand film
        </button>
        <button
          type="button"
          onClick={props.onAddTabsSection}
          disabled={atCapacity || saving}
          className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white text-[10px] font-bold uppercase tracking-widest text-gray-700 transition hover:border-gray-900 disabled:opacity-40"
        >
          <Rows3 size={12} /> Product tabs
        </button>
      </div>
    </div>
  );

  // ── Mobile Controls tab: list + arrow reorder + accordion inspector ──────
  if (isMobile) {
    return (
      <div ref={railRef} className="space-y-2">
        {blocks.map((block, index) => {
          const focused = block.id === focusedId;
          return (
            <div
              key={block.id}
              data-rail-item={block.id}
              className={`overflow-hidden rounded-2xl border transition ${
                focused ? 'border-[#f0a500]' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center bg-white">
                <button
                  type="button"
                  onClick={() => props.onFocus(block.id)}
                  className="flex min-h-[52px] min-w-0 flex-1 items-center gap-2.5 px-3.5 text-left"
                >
                  <span className="w-4 shrink-0 font-mono text-[10px] text-gray-300">{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-bold uppercase tracking-widest text-gray-500">
                      {SECTION_LABELS[block.type]}
                    </span>
                    <span className="block truncate text-xs text-gray-400">{blockExcerpt(block)}</span>
                  </span>
                </button>
                <div className="flex shrink-0 items-center pr-1.5">
                  <button
                    type="button"
                    aria-label="Move section up"
                    disabled={index === 0}
                    onClick={() => props.onMove(block.id, -1)}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-gray-400 transition active:bg-gray-100 disabled:opacity-25"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label="Move section down"
                    disabled={index === blocks.length - 1}
                    onClick={() => props.onMove(block.id, 1)}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-gray-400 transition active:bg-gray-100 disabled:opacity-25"
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>
              </div>
              {focused && (
                <div className="border-t border-gray-100 bg-gray-50/60 p-3.5">
                  <InspectorBody {...props} block={block} />
                </div>
              )}
            </div>
          );
        })}
        <div className="pt-2">{addButtons}</div>
      </div>
    );
  }

  // ── Desktop sidebar: Reorder tree + inspector panel ──────────────────────
  return (
    <div ref={railRef} className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
        <p className="px-1 pb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">Sections</p>
        <Reorder.Group
          axis="y"
          values={blocks.map((b) => b.id)}
          onReorder={(ids: string[]) => props.onReorderIds(ids)}
          className="m-0 space-y-1 p-0"
        >
          {blocks.map((block, index) => (
            <DesktopTreeItem
              key={block.id}
              block={block}
              index={index}
              focused={block.id === focusedId}
              onFocus={() => props.onFocus(block.id)}
            />
          ))}
        </Reorder.Group>

        <div className="mt-4 border-t border-gray-100 pt-4">{addButtons}</div>

        {focusedBlock && (
          <div className="mt-4 border-t border-gray-100 pt-4" data-rail-inspector>
            <p className="px-1 pb-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              {SECTION_LABELS[focusedBlock.type]} — settings
            </p>
            <InspectorBody {...props} block={focusedBlock} />
          </div>
        )}
      </div>
    </div>
  );
}
