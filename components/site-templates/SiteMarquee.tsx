import { Fragment, type CSSProperties } from 'react';
import { findBlock, resolveBlocks, type WebsiteConfig } from '@/lib/siteTemplates';

// ─────────────────────────────────────────────────────────────────────────────
// SiteMarquee — the kinetic brand ribbon between hero and product content.
// SERVER component, zero client JS: the motion is a pure-CSS @keyframes loop
// (globals.css, .sndk-marquee-track — translateX(-50%) linear infinite over a
// duplicated track). prefers-reduced-motion swaps in a dedicated static line
// via the same stylesheet.
//
// SEMANTIC CONTENT (Final UX Polish, Fix 2): the ribbon IS the value-props
// surface now — the static value-props body sections were removed from all
// three templates. Tokens are the tagline (anchor) followed by the
// value-prop TITLES. Titles only, never "title — body": bodies budget 200
// chars each and a scrolling ribbon of full sentences reads as noise and
// stretches the loop period past patience; the ≤60-char titles are exactly
// banner-length. Derived per render through resolveBlocks — the content API
// recomputes the mirror on every save, and the Site Editor's previewConfig
// rebuilds blocks per keystroke, so a value-prop edit in the SectionRail
// inspector updates the ribbon live.
//
// Editor safety: the ribbon carries NO data-block-section/-id/-field
// attributes — an animated, duplicated track is a hostile edit target, so
// value props stay editable ONLY through the SectionRail inspector (the rail
// documents this with a one-line hint).
//
// Accessibility: the moving ribbon is aria-hidden (a screen reader must not
// hear the same tokens looping), so the full value props (title + body) are
// preserved for assistive tech in the sr-only block below — the props no
// longer exist anywhere else on the page.
//
// Reduced motion: with 2–4 props a centered single line can overflow, so the
// static fallback renders ONLY the tagline + first prop (each span truncates
// gracefully under min-w-0) — documented degradation, never a clipped soup.
// ─────────────────────────────────────────────────────────────────────────────

export type MarqueeTone = 'ritual' | 'editorial' | 'vitality';

// Per-template dialect: glyph separator + type treatment. Token/glyph accents
// ride the --site-accent variable layer (Fix 6): vitality's gold token was
// already themed; the ritual/editorial glyphs now follow — their var()
// fallbacks are the exact historical literals (stone-300 #d6d3d1,
// neutral-400 #a3a3a3), so a theme-less site renders byte-identically while a
// themed site gets tastefully branded separators.
const TONES: Record<MarqueeTone, { glyph: string; section: string; token: string; glyphClass: string }> = {
  ritual: {
    glyph: '—', // —
    section: 'border-b border-stone-200 bg-[#FBFAF7] py-4 md:py-5',
    token: 'font-serif text-sm italic tracking-wide text-stone-500',
    glyphClass: 'mx-5 font-serif text-sm text-[var(--site-accent,#d6d3d1)] md:mx-8',
  },
  editorial: {
    glyph: '✦', // ✦
    section: 'border-b border-neutral-900 bg-[#F7F5F0] py-3.5 md:py-4',
    token: 'text-[10px] font-bold uppercase tracking-[0.35em] text-neutral-900',
    glyphClass: 'mx-5 text-[10px] text-[var(--site-accent,#a3a3a3)] md:mx-8',
  },
  vitality: {
    glyph: '◆', // ◆
    section: 'border-b border-white/10 bg-[#0C0C0C] py-4',
    token: 'text-xs font-black uppercase tracking-tight text-[var(--site-accent,#f0a500)]',
    glyphClass: 'mx-5 text-xs text-white/25 md:mx-8',
  },
};

// Dense enough that one group outruns any viewport width even for terse
// copy (tokens repeat until ≥ 8 entries).
const MIN_SEQUENCE_TOKENS = 8;
const SECONDS_PER_TOKEN = 5;

type SiteMarqueeProps = {
  config: WebsiteConfig;
  tone: MarqueeTone;
};

export default function SiteMarquee({ config, tone }: SiteMarqueeProps) {
  const blocks = resolveBlocks(config);
  const valueProps = findBlock(blocks, 'value_props')?.items ?? [];
  const tagline = (findBlock(blocks, 'hero_banner')?.tagline ?? config.site.tagline)?.trim();

  // Tagline anchors the sequence; prop titles follow. Case-insensitive dedupe
  // keeps the loop elegant when a title repeats the tagline.
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const raw of [tagline, ...valueProps.map((v) => v.title)]) {
    const token = raw?.trim();
    if (!token) continue;
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tokens.push(token);
  }
  if (tokens.length === 0) return null;

  const sequence: string[] = [];
  while (sequence.length < MIN_SEQUENCE_TOKENS) sequence.push(...tokens);

  // Static reduced-motion line: tagline + first prop only (see header note).
  const staticTokens = tokens.slice(0, 2);

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
    <>
      {/* Screen-reader value props — the ribbon is their only visual surface
          now, and it is aria-hidden by design. Zero visual footprint. */}
      {valueProps.length > 0 && (
        <div className="sr-only">
          {valueProps.map((v, i) => (
            <p key={i}>
              {v.title}. {v.body}
            </p>
          ))}
        </div>
      )}
      <div aria-hidden className={`sndk-marquee ${t.section}`}>
        <div className="sndk-marquee-track" style={style}>
          {renderGroup(false)}
          {renderGroup(true)}
        </div>
        {/* Reduced-motion fallback (display toggled in globals.css). */}
        <div className="sndk-marquee-static min-w-0 items-center justify-center px-5">
          {staticTokens.map((token, i) => (
            <Fragment key={i}>
              {i > 0 && <span className={`shrink-0 ${t.glyphClass}`}>{t.glyph}</span>}
              <span className={`min-w-0 truncate ${t.token}`}>{token}</span>
            </Fragment>
          ))}
        </div>
      </div>
    </>
  );
}
