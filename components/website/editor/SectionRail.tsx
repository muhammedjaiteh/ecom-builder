'use client';

import { Fragment, useRef, type ReactNode } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import {
  AlignLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clapperboard,
  Eye,
  EyeOff,
  Film,
  GalleryHorizontal,
  GripVertical,
  LayoutGrid,
  Megaphone,
  PanelTop,
  Plus,
  Rows3,
  Sparkles,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { BLOCK_SETTINGS, type SiteBlock, type SiteBlockType } from '@/lib/siteTemplates';
import {
  REMOVE_GUARD_HINT,
  SECTION_CATALOG,
  SECTION_LABELS,
  blockExcerpt,
  canRemoveBlock,
  descriptorFields,
  groupItemCount,
  readBlockField,
  type EditorField,
} from './editorModel';

// ─────────────────────────────────────────────────────────────────────────────
// SectionRail — the Shopify-style section tree + REGISTRY-DRIVEN inspector.
//
// The inspector is ONE generic renderer over BLOCK_SETTINGS
// (lib/siteTemplates.ts): copy fields with live budgets, segmented selects
// (Grid|Carousel), bounded repeatable groups (tabs/value props 2–4), and the
// asset/film delegation slots all render from descriptors — zero per-type
// inspector code survives. A new block type costs a registry entry, never a
// rail change.
//
// Desktop (≥768px): the ~350px left sidebar. framer-motion Reorder gives
// drag-to-reorder on a dedicated grip (dragListener=false + dragControls, so
// row clicks stay focus clicks); the inspector for the focused section
// renders beneath the tree; every row carries the visibility eye (Item 2).
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
  /** Full-catalog add (Item 2) — every block type; video_hero routes through
   *  the Ad Studio film picker (the parent owns that flow). */
  onAddSection: (type: SiteBlockType) => void;
  /** Visibility eye toggle (Item 2) — dims the section, never deletes it. */
  onToggleHidden: (blockId: string) => void;
  onChangeFilm: (blockId: string) => void;
  /** Generic select commit (registry kind 'select') — passing the
   *  descriptor's clearValue DELETES the key (canonical absent form). */
  onSelectSetting: (blockId: string, path: string[], value: string, clearValue?: string) => void;
  /** Generic bounded group rows (registry kind 'repeatable-group') —
   *  tabs 2–4 and value props 2–4 ride the same pair. */
  onAddGroupItem: (blockId: string, groupPath: string) => void;
  onRemoveGroupItem: (blockId: string, groupPath: string, index: number) => void;
  /** Desktop inline input events — the parent owns snapshot/commit. */
  onFieldChange: (blockId: string, path: string[], value: string) => void;
  onFieldFocus: (blockId: string, path: string[]) => void;
  onFieldBlur: (blockId: string, path: string[], optional: boolean) => void;
  /** Mobile: open the bottom-sheet editor for a field. */
  onEditFieldSheet: (blockId: string, path: string[]) => void;
  /** Hero-section asset slots, rendered by the parent (owns upload/generate). */
  assetSlots: ReactNode;
  /** Optional theme controls (Customize cockpit) — accent swatches + font
   *  picker, rendered above the section tree. Absent → rail is unchanged. */
  themePanel?: ReactNode;
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
  // text-base (16px): the rail renders on ≥768px viewports, which includes
  // touch iPads — anything smaller triggers iOS auto-zoom on focus.
  const shared =
    'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 font-sans text-base text-gray-900 outline-none transition focus:border-[#f0a500] focus:ring-1 focus:ring-[#f0a500]';
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

// ── Generic setting renderers (Shopify-engine Item 1) ────────────────────────
// The inspector is ONE renderer over BLOCK_SETTINGS: per descriptor kind, one
// SettingField branch. The bespoke per-type inspector code is gone — a new
// block type renders here with zero inspector changes (registry entry only).

/** Per-option icons for segmented selects, keyed on option value. Purely
 *  presentational sugar — an option without an icon renders label-only. */
export const SELECT_OPTION_ICONS: Record<string, LucideIcon> = {
  grid: LayoutGrid,
  carousel: GalleryHorizontal,
};

/** Add-catalog icons per block type — shared with the mobile add sheet. */
export const BLOCK_TYPE_ICONS: Record<SiteBlockType, LucideIcon> = {
  hero_banner: PanelTop,
  value_props: Sparkles,
  product_grid: LayoutGrid,
  story_text: AlignLeft,
  cta_banner: Megaphone,
  product_tabs: Rows3,
  video_hero: Clapperboard,
};

// ── Shared inspector body (registry-driven fields + section controls) ───────

function InspectorBody(props: SectionRailProps & { block: SiteBlock }) {
  const { block, isMobile } = props;

  // One copy-field renderer for BOTH surfaces: desktop inline input with
  // budgets, mobile sheet-opening row (≥48px).
  const renderField = (field: EditorField) => {
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
  };

  return (
    <div className="space-y-3">
      {BLOCK_SETTINGS[block.type].map((setting) => {
        const settingKey = `${block.id}:${setting.kind}:${setting.path}`;
        switch (setting.kind) {
          // Copy fields — text and textarea share the field renderer.
          case 'text':
          case 'textarea':
            return (
              <Fragment key={settingKey}>{descriptorFields(block, setting).map(renderField)}</Fragment>
            );

          // Enumerated switch. SEGMENTED when options ≤ 3: a 2–3-way mode
          // switch reads at a glance and every state stays one tap away
          // (Grid|Carousel byte-for-byte); at 4+ the chips cramp below the
          // 44px law inside the ~350px rail, so it degrades to a native
          // select — same commit path, honest ergonomics.
          case 'select': {
            const path = setting.path.split('.');
            const current = readBlockField(block, path) ?? setting.clearValue ?? setting.options[0]?.value ?? '';
            if (setting.options.length <= 3) {
              return (
                <div key={settingKey}>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">{setting.label}</p>
                  <div
                    className="grid gap-2"
                    style={{ gridTemplateColumns: `repeat(${setting.options.length}, minmax(0, 1fr))` }}
                  >
                    {setting.options.map((opt) => {
                      const Icon = SELECT_OPTION_ICONS[opt.value];
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => props.onSelectSetting(block.id, path, opt.value, setting.clearValue)}
                          className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition ${
                            current === opt.value
                              ? 'border-gray-900 bg-gray-900 text-white'
                              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
                          }`}
                        >
                          {Icon && <Icon size={13} />} {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            }
            return (
              <label key={settingKey} className="block">
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  {setting.label}
                </span>
                <select
                  value={current}
                  onChange={(e) => props.onSelectSetting(block.id, path, e.target.value, setting.clearValue)}
                  className="min-h-[44px] w-full rounded-xl border border-gray-200 bg-white px-3.5 font-sans text-base text-gray-900 outline-none transition focus:border-[#f0a500] focus:ring-1 focus:ring-[#f0a500]"
                >
                  {setting.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
            );
          }

          // Bounded repeatable group: item fields → optional hint →
          // add/remove chips within the registry's min/max window.
          case 'repeatable-group': {
            const count = groupItemCount(block, setting.path);
            const noun = setting.itemNoun.split(' ').pop() ?? 'item';
            const fallbackLabel = noun.charAt(0).toUpperCase() + noun.slice(1);
            const firstFieldPath = setting.fields[0]?.path;
            return (
              <Fragment key={settingKey}>
                {descriptorFields(block, setting).map(renderField)}
                {setting.hint && (
                  <p className="rounded-xl bg-gray-100 px-3.5 py-2.5 text-[11px] leading-relaxed text-gray-500">
                    {setting.hint}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={count >= setting.max}
                    onClick={() => props.onAddGroupItem(block.id, setting.path)}
                    className="flex min-h-[44px] items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 text-[10px] font-bold uppercase tracking-widest text-gray-700 transition hover:border-gray-900 disabled:opacity-40"
                  >
                    <Plus size={12} /> Add {setting.itemNoun}
                  </button>
                  {count > setting.min &&
                    Array.from({ length: count }, (_, i) => {
                      const title = firstFieldPath
                        ? readBlockField(block, [setting.path, String(i), firstFieldPath]) ?? ''
                        : '';
                      return (
                        <button
                          key={`remove-${setting.path}-${i}`}
                          type="button"
                          onClick={() => props.onRemoveGroupItem(block.id, setting.path, i)}
                          className="flex min-h-[44px] items-center gap-1.5 rounded-full border border-red-200 bg-white px-4 text-[10px] font-bold uppercase tracking-widest text-red-600 transition hover:bg-red-50"
                        >
                          <Trash2 size={11} /> {title.slice(0, 14) || `${fallbackLabel} ${i + 1}`}
                        </button>
                      );
                    })}
                </div>
              </Fragment>
            );
          }

          // Asset delegation: the hero section's brand slots (hero image +
          // logo) — upload / Ad-Studio / Generate / Clear stay owned by the
          // editor's one optimistic asset state machine.
          case 'image':
            return <Fragment key={settingKey}>{props.assetSlots}</Fragment>;

          // Film delegation: swap the video_hero asset via the Ad Studio
          // picker (copy stays untouched — the parent owns the swap).
          case 'video':
            return (
              <button
                key={settingKey}
                type="button"
                onClick={() => props.onChangeFilm(block.id)}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white text-[10px] font-bold uppercase tracking-widest text-gray-700 transition hover:border-gray-900"
              >
                <Film size={13} /> Change film
              </button>
            );
        }
      })}

      {/* Remove — ANY section except the last product_grid (a store without
          its collection is broken). Disabled with the honest hint, which also
          renders as text because title tooltips never surface on touch. */}
      {(() => {
        const removable = canRemoveBlock(props.blocks, block.id);
        return (
          <>
            <button
              type="button"
              disabled={!removable}
              title={removable ? undefined : REMOVE_GUARD_HINT}
              onClick={() => props.onRemove(block.id)}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white text-[10px] font-bold uppercase tracking-widest text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
            >
              <Trash2 size={13} /> Remove section
            </button>
            {!removable && (
              <p className="px-1 text-[11px] leading-relaxed text-gray-400">{REMOVE_GUARD_HINT}</p>
            )}
          </>
        );
      })()}
    </div>
  );
}

// ── Desktop tree item (drag grip + focus row) ────────────────────────────────

function DesktopTreeItem({
  block,
  index,
  focused,
  onFocus,
  onToggleHidden,
}: {
  block: SiteBlock;
  index: number;
  focused: boolean;
  onFocus: () => void;
  onToggleHidden: () => void;
}) {
  const controls = useDragControls();
  const hidden = block.hidden === true;
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
          className={`flex min-h-[44px] min-w-0 flex-1 items-center gap-2.5 py-1.5 text-left ${hidden ? 'opacity-50' : ''}`}
        >
          <span className="w-4 shrink-0 font-mono text-[10px] text-gray-300">{index + 1}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-bold uppercase tracking-widest text-gray-500">
              {SECTION_LABELS[block.type]}
              {hidden && <span className="ml-1.5 text-gray-300">· Hidden</span>}
            </span>
            <span className="block truncate text-xs text-gray-400">{blockExcerpt(block)}</span>
          </span>
          <ChevronRight size={14} className={`shrink-0 ${focused ? 'text-[#f0a500]' : 'text-gray-200'}`} />
        </button>
        {/* Visibility eye (Item 2) — ≥44px, never part of the focus click. */}
        <button
          type="button"
          aria-label={hidden ? `Show ${SECTION_LABELS[block.type]}` : `Hide ${SECTION_LABELS[block.type]}`}
          aria-pressed={hidden}
          onClick={onToggleHidden}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition hover:bg-gray-100 ${
            hidden ? 'text-amber-600' : 'text-gray-300 hover:text-gray-500'
          }`}
        >
          {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
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

  // Full catalog (Item 2): every block type is addable, with an honest
  // one-line description per type. video_hero routes through the film picker.
  const addButtons = (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
        {atCapacity ? 'At the 12-section limit — remove one to add another.' : 'Add a section'}
      </p>
      <div className="flex flex-col gap-1.5">
        {SECTION_CATALOG.map(({ type, description }) => {
          const Icon = BLOCK_TYPE_ICONS[type];
          return (
            <button
              key={type}
              type="button"
              onClick={() => props.onAddSection(type)}
              disabled={atCapacity || saving}
              className="flex min-h-[48px] w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 text-left transition hover:border-gray-900 disabled:opacity-40"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
                <Icon size={14} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold uppercase tracking-widest text-gray-700">
                  {SECTION_LABELS[type]}
                </span>
                <span className="block truncate text-[11px] text-gray-400">{description}</span>
              </span>
              <Plus size={13} className="shrink-0 text-gray-300" />
            </button>
          );
        })}
      </div>
    </div>
  );

  // ── Mobile Controls tab: list + arrow reorder + accordion inspector ──────
  if (isMobile) {
    return (
      <div ref={railRef} className="space-y-2">
        {props.themePanel && (
          <div className="rounded-2xl border border-gray-200 bg-white p-3.5">{props.themePanel}</div>
        )}
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
                  className={`flex min-h-[52px] min-w-0 flex-1 items-center gap-2.5 px-3.5 text-left ${
                    block.hidden ? 'opacity-50' : ''
                  }`}
                >
                  <span className="w-4 shrink-0 font-mono text-[10px] text-gray-300">{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-bold uppercase tracking-widest text-gray-500">
                      {SECTION_LABELS[block.type]}
                      {block.hidden && <span className="ml-1.5 text-gray-300">· Hidden</span>}
                    </span>
                    <span className="block truncate text-xs text-gray-400">{blockExcerpt(block)}</span>
                  </span>
                </button>
                <div className="flex shrink-0 items-center pr-1.5">
                  <button
                    type="button"
                    aria-label={block.hidden ? 'Show section' : 'Hide section'}
                    aria-pressed={block.hidden === true}
                    onClick={() => props.onToggleHidden(block.id)}
                    className={`flex h-11 w-11 items-center justify-center rounded-full transition active:bg-gray-100 ${
                      block.hidden ? 'text-amber-600' : 'text-gray-400'
                    }`}
                  >
                    {block.hidden ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
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
        {props.themePanel && (
          <div className="mb-4 border-b border-gray-100 pb-4">{props.themePanel}</div>
        )}
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
              onToggleHidden={() => props.onToggleHidden(block.id)}
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
