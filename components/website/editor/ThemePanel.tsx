'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Check, Layers, Paintbrush, PanelTop, Type } from 'lucide-react';
import {
  ACCENT_LABEL_MIN,
  ACCENT_SURFACE_MIN,
  SITE_FONT_LIST,
  SITE_FONTS,
  TEMPLATE_THEMES,
  judgeAccent,
  judgeThemeTokens,
  parseHex,
} from '@/lib/siteTheme';
import type { SiteFontKey, SiteTheme, TemplateKey } from '@/lib/siteTemplates';

// ─────────────────────────────────────────────────────────────────────────────
// ThemePanel — the Customize cockpit's accent + display-font controls.
// Renders inside the SectionRail (desktop sidebar AND the mobile Controls
// tab); all state lives in SiteCopyEditor, so a swatch or font tap re-renders
// the live preview instantly and rides the one dirty-bar/outbox save path.
//
// SELECTION SEMANTICS (byte-identical law): choosing the template default
// DELETES the key — an untouched-then-restored theme settles clean in the
// dirty check, and the stored config never grows a redundant theme object.
//
// CONTRAST GUARD (custom picker only — curated swatches are pre-cleared):
//   • vs paper AND ink surfaces below 3:1 (WCAG 1.4.11 non-text) → visible
//     warning, Apply still allowed (large accents may fade, seller's call).
//   • label-on-accent below 4.5:1 (WCAG 1.4.3 — the CTA case) → Apply is
//     BLOCKED with an honest message. The draft never touches the preview
//     until Apply, so a blocked color can never ride a save.
// ─────────────────────────────────────────────────────────────────────────────

type ThemePanelProps = {
  templateKey: TemplateKey;
  theme: SiteTheme | undefined;
  onChange: (theme: SiteTheme | undefined) => void;
};

/** Absent-key canonical form: {} collapses to undefined so the dirty check
 *  settles clean against a legacy row that never stored a theme. Extended for
 *  the Pillar-4 tokens — every key follows the same delete-when-default law
 *  (sticky_nav: absent/true are the same behavior, so true is never stored). */
function normalizeTheme(theme: SiteTheme): SiteTheme | undefined {
  const next: SiteTheme = {};
  if (theme.accent) next.accent = theme.accent;
  if (theme.display_font) next.display_font = theme.display_font;
  if (theme.primary) next.primary = theme.primary;
  if (theme.background) next.background = theme.background;
  if (theme.text) next.text = theme.text;
  if (theme.button_radius) next.button_radius = theme.button_radius;
  if (theme.sticky_nav === false) next.sticky_nav = false;
  return Object.keys(next).length > 0 ? next : undefined;
}

const RADIUS_OPTIONS: ReadonlyArray<{ value: NonNullable<SiteTheme['button_radius']> | 'default'; label: string }> = [
  { value: 'default', label: 'Default' },
  { value: 'sharp', label: 'Sharp' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'pill', label: 'Pill' },
];

/** One page-token color row: swatch preview + native picker + reset. */
function TokenColorRow({ label, value, fallback, onPick, onReset }: {
  label: string;
  value: string | undefined;
  /** The template's historical literal this token falls back to. */
  fallback: string;
  onPick: (hex: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <label
        className="relative flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full ring-1 ring-gray-200 ring-offset-2 transition hover:ring-gray-400"
        style={{ backgroundColor: value ?? fallback }}
        title={`Pick ${label.toLowerCase()}`}
      >
        <input
          type="color"
          aria-label={`Pick ${label.toLowerCase()}`}
          value={value ?? fallback}
          onChange={(e) => onPick(e.target.value.toLowerCase())}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        <Paintbrush size={12} className="pointer-events-none text-white mix-blend-difference" />
      </label>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold text-gray-700">{label}</p>
        <p className="font-mono text-[10px] text-gray-400">{value ?? 'Template default'}</p>
      </div>
      {value && (
        <button
          type="button"
          onClick={onReset}
          className="flex min-h-[44px] items-center rounded-full border border-gray-200 px-3 text-[9px] font-bold uppercase tracking-widest text-gray-500 transition hover:border-gray-400 hover:text-gray-900"
        >
          Reset
        </button>
      )}
    </div>
  );
}

export default function ThemePanel({ templateKey, theme, onChange }: ThemePanelProps) {
  const meta = TEMPLATE_THEMES[templateKey];
  const activeAccent = (theme?.accent ?? meta.accent).toLowerCase();
  const activeFont: SiteFontKey = theme?.display_font ?? 'playfair';

  // Custom-picker draft — preview-inert until Apply (see guard note above).
  const [draft, setDraft] = useState(activeAccent);
  const verdict = useMemo(() => judgeAccent(templateKey, draft), [templateKey, draft]);
  const draftIsActive = draft.toLowerCase() === activeAccent;
  const draftValid = parseHex(draft) !== null;

  // ── Page-token drafts (Pillar 4): primary / background / text ────────────
  // Preview-inert until Apply, exactly like the custom accent: the extended
  // guard hard-blocks text-on-bg pairs below 4.5:1 BEFORE they can be
  // applied, and warns on primary surfaces below 3:1. '' = template default.
  const [pageDraft, setPageDraft] = useState<{ primary: string; background: string; text: string }>({
    primary: theme?.primary ?? '',
    background: theme?.background ?? '',
    text: theme?.text ?? '',
  });
  const tokenVerdict = useMemo(
    () =>
      judgeThemeTokens(templateKey, {
        primary: pageDraft.primary || undefined,
        background: pageDraft.background || undefined,
        text: pageDraft.text || undefined,
      }),
    [templateKey, pageDraft]
  );
  const pageDirty =
    pageDraft.primary !== (theme?.primary ?? '') ||
    pageDraft.background !== (theme?.background ?? '') ||
    pageDraft.text !== (theme?.text ?? '');

  const applyPageTokens = () => {
    if (tokenVerdict?.textBlocked) return;
    const next: SiteTheme = { ...(theme ?? {}) };
    if (pageDraft.primary) next.primary = pageDraft.primary; else delete next.primary;
    if (pageDraft.background) next.background = pageDraft.background; else delete next.background;
    if (pageDraft.text) next.text = pageDraft.text; else delete next.text;
    onChange(normalizeTheme(next));
  };

  const activeRadius: NonNullable<SiteTheme['button_radius']> | 'default' =
    theme?.button_radius ?? 'default';
  const setRadius = (value: NonNullable<SiteTheme['button_radius']> | 'default') => {
    const next: SiteTheme = { ...(theme ?? {}) };
    if (value === 'default') delete next.button_radius;
    else next.button_radius = value;
    onChange(normalizeTheme(next));
  };

  // sticky_nav: absent/true = the dialect's historical behavior. Only an
  // explicit false is ever stored (normalizeTheme deletes true).
  const stickyOn = theme?.sticky_nav !== false;
  const setSticky = (on: boolean) => {
    const next: SiteTheme = { ...(theme ?? {}) };
    if (on) delete next.sticky_nav;
    else next.sticky_nav = false;
    onChange(normalizeTheme(next));
  };

  const setAccent = (hex: string | null) => {
    const next: SiteTheme = { ...(theme ?? {}) };
    if (hex === null || hex.toLowerCase() === meta.accent.toLowerCase()) delete next.accent;
    else next.accent = hex.toLowerCase();
    onChange(normalizeTheme(next));
  };

  const setFont = (key: SiteFontKey) => {
    const next: SiteTheme = { ...(theme ?? {}) };
    if (key === 'playfair') delete next.display_font;
    else next.display_font = key;
    onChange(normalizeTheme(next));
  };

  return (
    <div data-theme-panel className="space-y-5">
      {/* ── Accent color ────────────────────────────────────────────────── */}
      <div>
        <p className="flex items-center gap-1.5 px-1 pb-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
          <Paintbrush size={11} /> Accent color
        </p>
        <div className="flex flex-wrap gap-2 px-1">
          {meta.swatches.map((swatch, i) => {
            const selected = activeAccent === swatch.hex.toLowerCase();
            const isDefault = i === 0;
            return (
              <button
                key={swatch.hex}
                type="button"
                title={isDefault ? `${swatch.name} (template default)` : swatch.name}
                aria-label={`Accent ${swatch.name}${isDefault ? ' (template default)' : ''}`}
                aria-pressed={selected}
                onClick={() => {
                  setAccent(isDefault ? null : swatch.hex);
                  setDraft(swatch.hex.toLowerCase());
                }}
                className={`flex h-11 w-11 items-center justify-center rounded-full ring-offset-2 transition active:scale-95 ${
                  selected ? 'ring-2 ring-gray-900' : 'ring-1 ring-gray-200 hover:ring-gray-400'
                }`}
                style={{ backgroundColor: swatch.hex }}
              >
                {selected && <Check size={14} className="text-white mix-blend-difference" />}
              </button>
            );
          })}

          {/* Custom picker — native input wrapped as a premium swatch. The
              input covers the whole ≥44px circle, so the tap target is the
              control itself. */}
          <label
            title="Custom color"
            className="relative flex h-11 w-11 cursor-pointer items-center justify-center overflow-hidden rounded-full ring-1 ring-gray-200 ring-offset-2 transition hover:ring-gray-400"
            style={{
              background: draftValid
                ? draft
                : 'conic-gradient(#f43f5e, #f59e0b, #84cc16, #06b6d4, #8b5cf6, #f43f5e)',
            }}
          >
            <input
              type="color"
              aria-label="Pick a custom accent color"
              value={draftValid ? draft : meta.accent}
              onChange={(e) => setDraft(e.target.value.toLowerCase())}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
            <Paintbrush size={13} className="pointer-events-none text-white mix-blend-difference" />
          </label>
        </div>

        {/* Custom draft readout + guard */}
        {!draftIsActive && verdict && (
          <div className="mt-3 space-y-2 rounded-xl border border-gray-200 bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 font-mono text-[11px] font-bold text-gray-600">
                <span className="inline-block h-4 w-4 rounded-full ring-1 ring-gray-200" style={{ backgroundColor: draft }} />
                {draft}
              </span>
              <span className="font-mono text-[10px] text-gray-400">
                paper {verdict.vsPaper.toFixed(1)}:1 · ink {verdict.vsInk.toFixed(1)}:1
              </span>
            </div>

            {verdict.blocked && (
              <p className="flex items-start gap-1.5 text-xs leading-snug text-red-700">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                Button text on this color reads at {verdict.vsLabel.toFixed(1)}:1 — below the {ACCENT_LABEL_MIN}:1
                buyers need. Pick a {meta.onAccent === '#000000' ? 'brighter' : 'deeper'} shade to apply it.
              </p>
            )}
            {!verdict.blocked && verdict.lowSurfaceContrast && (
              <p className="flex items-start gap-1.5 text-xs leading-snug text-amber-700">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                Under {ACCENT_SURFACE_MIN}:1 against this template&apos;s surfaces — large accents may fade into
                the page.
              </p>
            )}

            <button
              type="button"
              onClick={() => setAccent(draft)}
              disabled={verdict.blocked}
              className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl bg-gray-900 text-[10px] font-bold uppercase tracking-widest text-white transition hover:bg-black active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Check size={12} /> Apply this color
            </button>
          </div>
        )}
      </div>

      {/* ── Page colors (Pillar 4 tokens) ───────────────────────────────── */}
      <div>
        <p className="flex items-center gap-1.5 px-1 pb-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
          <Layers size={11} /> Page colors
        </p>
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-3">
          <TokenColorRow
            label="Background"
            value={pageDraft.background || undefined}
            fallback={meta.paper}
            onPick={(hex) => setPageDraft((d) => ({ ...d, background: hex }))}
            onReset={() => setPageDraft((d) => ({ ...d, background: '' }))}
          />
          <TokenColorRow
            label="Text"
            value={pageDraft.text || undefined}
            fallback={meta.ink}
            onPick={(hex) => setPageDraft((d) => ({ ...d, text: hex }))}
            onReset={() => setPageDraft((d) => ({ ...d, text: '' }))}
          />
          <TokenColorRow
            label="Primary panels"
            value={pageDraft.primary || undefined}
            fallback={meta.ink}
            onPick={(hex) => setPageDraft((d) => ({ ...d, primary: hex }))}
            onReset={() => setPageDraft((d) => ({ ...d, primary: '' }))}
          />

          {pageDirty && tokenVerdict && (
            <>
              <p className="font-mono text-[10px] text-gray-400">
                text on page {tokenVerdict.textOnBg.toFixed(1)}:1 · panels on page {tokenVerdict.primaryOnBg.toFixed(1)}:1
              </p>
              {tokenVerdict.textBlocked && (
                <p className="flex items-start gap-1.5 text-xs leading-snug text-red-700">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  This text/background pair reads at {tokenVerdict.textOnBg.toFixed(1)}:1 — below the {ACCENT_LABEL_MIN}:1
                  buyers need. Adjust one of them to apply.
                </p>
              )}
              {!tokenVerdict.textBlocked && tokenVerdict.primaryLow && (
                <p className="flex items-start gap-1.5 text-xs leading-snug text-amber-700">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  Under {ACCENT_SURFACE_MIN}:1 — the dark panels may melt into the page.
                </p>
              )}
              <button
                type="button"
                onClick={applyPageTokens}
                disabled={tokenVerdict.textBlocked}
                className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl bg-gray-900 text-[10px] font-bold uppercase tracking-widest text-white transition hover:bg-black active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Check size={12} /> Apply page colors
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Button corners (Pillar 4 radius token) ──────────────────────── */}
      <div>
        <p className="flex items-center gap-1.5 px-1 pb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
          <Paintbrush size={11} /> Button corners
        </p>
        <div className="grid grid-cols-4 gap-2">
          {RADIUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={activeRadius === opt.value}
              onClick={() => setRadius(opt.value)}
              className={`flex min-h-[44px] items-center justify-center rounded-xl border text-[9px] font-bold uppercase tracking-widest transition ${
                activeRadius === opt.value
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Navigation (Pillar 4 sticky_nav) ────────────────────────────── */}
      <div>
        <p className="flex items-center gap-1.5 px-1 pb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
          <PanelTop size={11} /> Navigation
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={stickyOn}
          onClick={() => setSticky(!stickyOn)}
          className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3.5 text-left transition hover:border-gray-400"
        >
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-gray-900">Sticky navigation</span>
            <span className="block text-[11px] text-gray-400">
              {templateKey === 'editorial'
                ? 'The Editorial masthead is print anatomy — it never sticks.'
                : 'Keep the nav pinned while customers scroll.'}
            </span>
          </span>
          <span
            aria-hidden
            className={`relative h-6 w-11 shrink-0 rounded-full transition ${stickyOn ? 'bg-gray-900' : 'bg-gray-200'}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${stickyOn ? 'left-[22px]' : 'left-0.5'}`}
            />
          </span>
        </button>
      </div>

      {/* ── Display face ────────────────────────────────────────────────── */}
      <div>
        <p className="flex items-center gap-1.5 px-1 pb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
          <Type size={11} /> Display face
        </p>
        <div className="space-y-1">
          {SITE_FONT_LIST.map((font) => {
            const selected = activeFont === font.key;
            return (
              <button
                key={font.key}
                type="button"
                aria-pressed={selected}
                onClick={() => setFont(font.key)}
                className={`flex min-h-[48px] w-full items-center gap-3 rounded-xl border px-3.5 text-left transition active:scale-[0.99] ${
                  selected ? 'border-[#f0a500] bg-amber-50/60' : 'border-gray-200 bg-white hover:border-gray-400'
                }`}
              >
                <span className="min-w-0 flex-1">
                  {/* Each name set in its own face — the picker IS the specimen. */}
                  <span className="block truncate text-lg leading-tight text-gray-900" style={{ fontFamily: SITE_FONTS[font.key].cssValue }}>
                    {font.name}
                  </span>
                  <span className="block truncate text-[11px] text-gray-400">{font.blurb}</span>
                </span>
                {selected && <Check size={15} className="shrink-0 text-[#f0a500]" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
