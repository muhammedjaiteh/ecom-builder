import type { CSSProperties } from 'react';
import type { SiteFontKey, SiteTheme, TemplateKey, WebsiteConfig } from './siteTemplates';

// ─────────────────────────────────────────────────────────────────────────────
// Site theme layer — the SINGLE module behind the Customize cockpit's color
// wheel and font picker, and behind the render-time CSS variable seam.
//
// THE SEAM: every /site render path funnels through exactly one root wrapper
// per template family — RitualChrome / EditorialChrome / NeutralChrome (home,
// collections, PDP) and the VitalityTemplate root for its legacy home. Those
// four roots call siteThemeStyle(config) to set --site-accent / --site-serif.
// Because the Site Editor preview and MiniSitePreview render the same
// components, the theme layer reaches every surface with zero extra wiring.
//
// THE FALLBACK LAW: templates consume the variables ONLY as
// var(--site-accent, <template default>) at their accent spots — with no
// theme stored, siteThemeStyle returns undefined (no style attribute at all)
// and every var() resolves to its inline default: byte-identical rendering.
//
// --site-accent CONSUMPTION POINTS (keep current — Fix 6 audit):
//   RitualTemplate      hero "Shop The Collection" label · story accent rule ·
//                       CTA-banner button label
//   RitualChrome        nav/footer monogram fills · "Shop Now" pill
//   EditorialTemplate   "No. 01" kicker · hero link hover · features
//                       "View The Piece" outline/label/hover-fill (#171717
//                       fallback = neutral-900, byte-identical untthemed)
//   EditorialChrome     masthead link hover · sign-off CTA label (#171717)
//   VitalityTemplate    nav pill · hero play pill · tagline chip · hero CTA +
//                       shadow · stats numerals · row price/hover/View pill ·
//                       mission kicker · closing CTA + shadow
//   NeutralChrome       card hover ring/badge/price · nav CTA pill
//   SiteMarquee         vitality token color · ritual glyphs (#d6d3d1 =
//                       stone-300) · editorial glyphs (#a3a3a3 = neutral-400)
//   StoryClamp          "Read the full story" button, all three dialects
// ─────────────────────────────────────────────────────────────────────────────

// ── Curated display faces ────────────────────────────────────────────────────
// All five load in app/layout.tsx via next/font/google (latin subset,
// display:swap; the four non-default faces skip preload so public pages only
// download the face a site actually uses). cssValue is what --site-serif is
// set to — the next/font variable plus honest platform fallbacks.

export type SiteFontMeta = {
  key: SiteFontKey;
  name: string;
  /** The value written into --site-serif (next/font CSS variable). */
  cssValue: string;
  /** One-line register note shown in the picker. */
  blurb: string;
};

export const SITE_FONTS: Record<SiteFontKey, SiteFontMeta> = {
  playfair: {
    key: 'playfair',
    name: 'Playfair Display',
    cssValue: 'var(--font-display-serif)',
    blurb: 'The house default — high-contrast and masthead-proof.',
  },
  cormorant: {
    key: 'cormorant',
    name: 'Cormorant Garamond',
    cssValue: 'var(--font-serif-cormorant)',
    blurb: 'Feather-light garamond — couture beauty and fragrance.',
  },
  fraunces: {
    key: 'fraunces',
    name: 'Fraunces',
    cssValue: 'var(--font-serif-fraunces)',
    blurb: 'Soft old-style warmth — artisanal and handcrafted brands.',
  },
  lora: {
    key: 'lora',
    name: 'Lora',
    cssValue: 'var(--font-serif-lora)',
    blurb: 'Contemporary and readable — story-led long-copy sites.',
  },
  bodoni: {
    key: 'bodoni',
    name: 'Bodoni Moda',
    cssValue: 'var(--font-serif-bodoni)',
    blurb: 'Razor-sharp didone — high-fashion editorial register.',
  },
};

export const SITE_FONT_LIST: SiteFontMeta[] = Object.values(SITE_FONTS);

// ── Per-template theme surfaces ─────────────────────────────────────────────
// paper/ink are the surfaces the contrast guard measures against; onAccent is
// the label color each template renders ON an accent fill (the CTA case).
// Every default swatch below clears the guard by construction.

export type TemplateThemeMeta = {
  /** Template default accent — identical to the hardcoded var() fallbacks. */
  accent: string;
  paper: string;
  ink: string;
  /** Label color rendered on accent fills (CTA pills, badges). */
  onAccent: string;
  swatches: { name: string; hex: string }[];
};

export const TEMPLATE_THEMES: Record<TemplateKey, TemplateThemeMeta> = {
  ritual: {
    accent: '#1c1917', // stone-900
    paper: '#FBFAF7',
    ink: '#1c1917',
    onAccent: '#ffffff',
    swatches: [
      { name: 'Stone', hex: '#1c1917' },
      { name: 'Emerald', hex: '#1a2e1a' },
      { name: 'Terracotta', hex: '#8a3412' },
      { name: 'Deep Ocean', hex: '#1e3a5f' },
      { name: 'Aubergine', hex: '#4a1d3f' },
    ],
  },
  editorial: {
    accent: '#1a2e1a', // deep green
    paper: '#F7F5F0',
    ink: '#171717', // neutral-900
    onAccent: '#F7F5F0',
    swatches: [
      { name: 'Deep Green', hex: '#1a2e1a' },
      { name: 'Oxblood', hex: '#5f1a1a' },
      { name: 'Prussian', hex: '#1a2a4a' },
      { name: 'Espresso', hex: '#3a2a1a' },
      { name: 'Charcoal', hex: '#262626' },
    ],
  },
  vitality: {
    accent: '#f0a500', // electric gold
    paper: '#0C0C0C', // the dark canvas IS this template's paper
    ink: '#ffffff',
    onAccent: '#000000',
    swatches: [
      { name: 'Gold', hex: '#f0a500' },
      { name: 'Volt', hex: '#c6f04a' },
      { name: 'Ice', hex: '#7dd3fc' },
      { name: 'Coral', hex: '#ff8a5c' },
      { name: 'Mint', hex: '#5ce8a4' },
    ],
  },
};

// ── The render seam ──────────────────────────────────────────────────────────
// Token cascade (Pillar 4): alongside --site-accent/--site-serif the seam now
// emits, when the theme carries them:
//   --site-primary : deep brand surface (dark CTA banners, sign-off spread,
//                    solid checkout buttons)
//   --site-bg      : page paper
//   --site-text    : page ink
//   --site-muted   : DERIVED (never stored) — text mixed 62% into the page
//                    paper (chosen background ?? the template's default
//                    paper). Consumed by the secondary-copy spots so a themed
//                    ink keeps a readable muted companion; themeless pages
//                    keep every historical muted literal untouched.
//   --site-radius  : sharp 0px · rounded 0.75rem · pill 9999px
// FALLBACK LAW unchanged: every consumption point is var(--x, <historical
// literal>) — an absent token renders byte-identically.

export const RADIUS_VALUES: Record<NonNullable<SiteTheme['button_radius']>, string> = {
  sharp: '0px',
  rounded: '0.75rem',
  pill: '9999px',
};

/** Deterministic per-channel hex mix: `ratio` of a over (1-ratio) of b. */
export function mixHex(a: string, b: string, ratio: number): string | null {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return null;
  const channel = (i: number) => Math.round(ca[i] * ratio + cb[i] * (1 - ratio));
  return `#${[0, 1, 2].map((i) => channel(i).toString(16).padStart(2, '0')).join('')}`;
}

/** The plain string→string variable map for a themed config, or null when the
 *  config carries no effective theme. Shared by siteThemeStyle (the wrapper
 *  style attribute) and SiteThemeCascade (the document-root island that lets
 *  root-layout portals — the Cart drawer — inherit the boutique theme). */
export function siteThemeVars(
  config: Pick<WebsiteConfig, 'theme' | 'template_key'>
): Record<string, string> | null {
  const theme = config.theme;
  if (!theme) return null;
  const vars: Record<string, string> = {};
  if (theme.accent) vars['--site-accent'] = theme.accent;
  if (theme.display_font && SITE_FONTS[theme.display_font]) {
    vars['--site-serif'] = SITE_FONTS[theme.display_font].cssValue;
  }
  if (theme.primary) vars['--site-primary'] = theme.primary;
  if (theme.background) vars['--site-bg'] = theme.background;
  if (theme.text) {
    vars['--site-text'] = theme.text;
    // Muted companion: text softened into the EFFECTIVE paper. TEMPLATE_THEMES
    // paper is the historical default when no background token is chosen.
    const paper = theme.background ?? TEMPLATE_THEMES[config.template_key]?.paper;
    const muted = paper ? mixHex(theme.text, paper, 0.62) : null;
    if (muted) vars['--site-muted'] = muted;
  }
  if (theme.button_radius) vars['--site-radius'] = RADIUS_VALUES[theme.button_radius];
  return Object.keys(vars).length > 0 ? vars : null;
}

/** Style-variable payload for a site root wrapper. Returns undefined when the
 *  config carries no effective theme, so the wrapper renders WITHOUT a style
 *  attribute — byte-identical to the pre-theme output. */
export function siteThemeStyle(
  config: Pick<WebsiteConfig, 'theme' | 'template_key'>
): CSSProperties | undefined {
  const vars = siteThemeVars(config);
  return vars ? (vars as CSSProperties) : undefined;
}

// ── WCAG contrast math (the cockpit's guard) ─────────────────────────────────

export function parseHex(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function channelLuminance(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb;
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/** WCAG 2.x contrast ratio (1–21). Returns null on an unparsable hex. */
export function contrastRatio(a: string, b: string): number | null {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// Guard thresholds: 3:1 is WCAG 1.4.11 (non-text / large graphical accents on
// the template's surfaces — soft warning), 4.5:1 is WCAG 1.4.3 for the label
// rendered ON an accent fill (the CTA case — hard block).
export const ACCENT_SURFACE_MIN = 3;
export const ACCENT_LABEL_MIN = 4.5;

export type AccentVerdict = {
  /** Ratio vs the template paper surface. */
  vsPaper: number;
  /** Ratio vs the template ink surface. */
  vsInk: number;
  /** Ratio between the accent fill and the label rendered on it. */
  vsLabel: number;
  /** Soft warning: the accent nearly vanishes against paper or ink. */
  lowSurfaceContrast: boolean;
  /** Hard block: CTA labels on this accent would be unreadable. */
  blocked: boolean;
};

export function judgeAccent(templateKey: TemplateKey, accent: string): AccentVerdict | null {
  const meta = TEMPLATE_THEMES[templateKey];
  const vsPaper = contrastRatio(accent, meta.paper);
  const vsInk = contrastRatio(accent, meta.ink);
  const vsLabel = contrastRatio(accent, meta.onAccent);
  if (vsPaper === null || vsInk === null || vsLabel === null) return null;
  return {
    vsPaper,
    vsInk,
    vsLabel,
    lowSurfaceContrast: vsPaper < ACCENT_SURFACE_MIN && vsInk < ACCENT_SURFACE_MIN,
    blocked: vsLabel < ACCENT_LABEL_MIN,
  };
}

// ── Token-pair guard (Pillar 4 extension) ────────────────────────────────────
// The cockpit judges the EFFECTIVE page pair — chosen tokens falling back to
// the template's historical paper/ink — so a text pick is judged against the
// background it will actually sit on (and vice versa).
//   · text-on-bg   < 4.5:1 (WCAG 1.4.3, body copy)  → HARD BLOCK
//   · primary-on-bg < 3:1  (WCAG 1.4.11, surfaces)  → soft warning (a section
//     panel that melts into the page is a taste problem, not a readability
//     failure — the seller sees it live and decides).

export type ThemeTokenVerdict = {
  /** Effective ink vs effective paper. */
  textOnBg: number;
  /** Effective primary surface vs effective paper. */
  primaryOnBg: number;
  /** HARD BLOCK: body copy below 4.5:1. */
  textBlocked: boolean;
  /** Soft warning: the primary surface nearly vanishes against the paper. */
  primaryLow: boolean;
};

export function judgeThemeTokens(
  templateKey: TemplateKey,
  theme: Pick<SiteTheme, 'primary' | 'background' | 'text'> | undefined
): ThemeTokenVerdict | null {
  const meta = TEMPLATE_THEMES[templateKey];
  const bg = theme?.background ?? meta.paper;
  const text = theme?.text ?? meta.ink;
  // Historical primary surfaces per dialect (the literals the templates fall
  // back to): ritual stone-900 ≈ ink; editorial #141414; vitality panels.
  const primary = theme?.primary ?? meta.ink;
  const textOnBg = contrastRatio(text, bg);
  const primaryOnBg = contrastRatio(primary, bg);
  if (textOnBg === null || primaryOnBg === null) return null;
  return {
    textOnBg,
    primaryOnBg,
    textBlocked: textOnBg < ACCENT_LABEL_MIN,
    primaryLow: primaryOnBg < ACCENT_SURFACE_MIN,
  };
}
