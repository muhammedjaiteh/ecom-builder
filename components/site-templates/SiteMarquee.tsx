import { Fragment, type CSSProperties } from 'react';
import type { SiteShop, WebsiteConfig } from '@/lib/siteTemplates';

// ─────────────────────────────────────────────────────────────────────────────
// SiteMarquee — the kinetic brand ribbon between hero and product content.
// SERVER component, zero client JS: the motion is a pure-CSS @keyframes loop
// (globals.css, .sndk-marquee-track — translateX(-50%) linear infinite over a
// duplicated track). prefers-reduced-motion renders a static centered single
// line via the same stylesheet.
//
// Content is DERIVED, never stored (no schema change): shop name + hero
// tagline + collection title, straight from the site.* mirror — the content
// API recomputes that mirror on every block save, and the Site Editor's
// previewConfig recomputes it per keystroke, so the ribbon always speaks the
// current copy on both surfaces.
//
// Editor safety: the wrapper carries NO data-block-section/-id/-field
// attributes — it is invisible to the Site Editor's click-capture and rect
// math, and it never rides a Reveal (it is already motion).
//
// aria-hidden on the whole ribbon: every token already exists elsewhere on
// the page (masthead, hero, grid header) — a screen reader should not hear
// the same three phrases looping eight times.
// ─────────────────────────────────────────────────────────────────────────────

export type MarqueeTone = 'ritual' | 'editorial' | 'vitality';

// Per-template dialect: glyph separator + type treatment. The vitality gold
// rides the --site-accent variable layer (template default inline) so a
// themed site recolors the ribbon with its CTAs.
const TONES: Record<MarqueeTone, { glyph: string; section: string; token: string; glyphClass: string }> = {
  ritual: {
    glyph: '—', // —
    section: 'border-b border-stone-200 bg-[#FBFAF7] py-4 md:py-5',
    token: 'font-serif text-sm italic tracking-wide text-stone-500',
    glyphClass: 'mx-5 font-serif text-sm text-stone-300 md:mx-8',
  },
  editorial: {
    glyph: '✦', // ✦
    section: 'border-b border-neutral-900 bg-[#F7F5F0] py-3.5 md:py-4',
    token: 'text-[10px] font-bold uppercase tracking-[0.35em] text-neutral-900',
    glyphClass: 'mx-5 text-[10px] text-neutral-400 md:mx-8',
  },
  vitality: {
    glyph: '◆', // ◆
    section: 'border-b border-white/10 bg-[#0C0C0C] py-4',
    token: 'text-xs font-black uppercase tracking-tight text-[var(--site-accent,#f0a500)]',
    glyphClass: 'mx-5 text-xs text-white/25 md:mx-8',
  },
};

// Dense enough that one group outruns any viewport width even for a terse
// brand ("Aya · Skin · Edit" repeats until ≥ 8 tokens).
const MIN_SEQUENCE_TOKENS = 8;
const SECONDS_PER_TOKEN = 5;

type SiteMarqueeProps = {
  shop: SiteShop;
  config: WebsiteConfig;
  tone: MarqueeTone;
};

export default function SiteMarquee({ shop, config, tone }: SiteMarqueeProps) {
  const tokens = [shop.shop_name, config.site.tagline, config.site.collection_title]
    .map((t) => t?.trim())
    .filter((t): t is string => Boolean(t));
  if (tokens.length === 0) return null;

  const sequence: string[] = [];
  while (sequence.length < MIN_SEQUENCE_TOKENS) sequence.push(...tokens);

  const t = TONES[tone];
  // Duration scales with token count so the linear speed stays constant
  // whether the group holds 8 short tokens or 9 long ones.
  const style = { '--sndk-marquee-duration': `${sequence.length * SECONDS_PER_TOKEN}s` } as CSSProperties;

  const renderGroup = (twin: boolean) => (
    <div
      {...(twin ? { 'data-marquee-twin': '' } : {})}
      className="flex w-max shrink-0 items-center whitespace-nowrap"
    >
      {sequence.map((token, i) => (
        <Fragment key={i}>
          <span className={t.token}>{token}</span>
          <span className={t.glyphClass}>{t.glyph}</span>
        </Fragment>
      ))}
    </div>
  );

  return (
    <div aria-hidden className={`sndk-marquee ${t.section}`}>
      <div className="sndk-marquee-track" style={style}>
        {renderGroup(false)}
        {renderGroup(true)}
      </div>
    </div>
  );
}
