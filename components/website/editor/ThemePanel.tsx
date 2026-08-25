'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Check, Paintbrush, Type } from 'lucide-react';
import {
  ACCENT_LABEL_MIN,
  ACCENT_SURFACE_MIN,
  SITE_FONT_LIST,
  SITE_FONTS,
  TEMPLATE_THEMES,
  judgeAccent,
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
 *  settles clean against a legacy row that never stored a theme. */
function normalizeTheme(theme: SiteTheme): SiteTheme | undefined {
  const next: SiteTheme = {};
  if (theme.accent) next.accent = theme.accent;
  if (theme.display_font) next.display_font = theme.display_font;
  return next.accent || next.display_font ? next : undefined;
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
