'use client';

import type { CSSProperties, Ref } from 'react';
import { formatDalasi } from '@/components/marketplace/format';
import {
  AD_FORMATS,
  NICHE_PRESETS,
  formatTenantDomain,
  type AdAspectRatio,
  type EditorialCopy,
  type NicheKey,
} from '@/lib/adStudio/nichePresets';

// ─────────────────────────────────────────────────────────────────────────────
// AdStudioCanvas — the editorial compositor for the premium Ad Studio.
//
// Three layers, bottom to top:
//   BASE        the still from /api/ad-studio (the seller's untouched product
//               cutout on its Photoroom scene) rendered object-contain, so
//               not one product pixel is cropped or resampled beyond the
//               uniform scale of the frame. A token-painted studio plate sits
//               behind it so a mock (raw product photo) still reads as staged.
//   PROTECTION  forest scrims — top for the kicker/headline, bottom for the
//               price stamp, plus a faint vignette — so bone type holds
//               contrast over a porcelain beauty plate and a velvet jewelry
//               plate alike. Strength comes from the niche preset.
//   TYPOGRAPHY  gold whisper-caps kicker · editorial serif headline · quiet
//               subline · price + tenant-domain stamp at the base.
//
// Every dimension is in container-query width units (cqw) off the frame, so
// the SAME markup is pixel-proportional at a 320px dashboard preview and at
// the 1080px export (html-to-image is already a dependency). Colours are
// exclusively the mall tokens (--mall-gold / --mall-bone / --mall-forest) via
// their Tailwind utilities or color-mix() on the CSS variables — no literals.
//
// All three layers are absolutely positioned: the frame's size comes ONLY
// from its width + aspect-ratio. In-flow nowrap text (the title whisper, the
// domain stamp) would otherwise inflate the figure's min-content width and
// overflow a 360px phone column — verified by headless screenshot.
//
// 9:16 honours WhatsApp Status chrome: the top and bottom safe zones are left
// clear so the status progress bar and reply field never cover the copy.
//
// Presentational and hook-free; `ref` (React 19 ref-as-prop) exposes the
// frame for export. Sibling directory components/adstudio/ holds the render
// notifier — this folder is the compositor per the Ad Studio spec.
// ─────────────────────────────────────────────────────────────────────────────

export type AdStudioCanvasProps = {
  /** Base layer — AdStudioRenderResult.imageUrl (composite, or the source image in mock mode). */
  imageUrl: string;
  aspectRatio: AdAspectRatio;
  copy: EditorialCopy;
  /** Dalasi amount; null/undefined hides the price line. */
  price: number | string | null | undefined;
  /** Boutique domain — any form (`https://shop.domain.gm/`) is normalised to a bare host. */
  tenantDomain: string | null | undefined;
  /** Whisper line above the price in the stamp. */
  productTitle?: string;
  /** Drives scrim strength; defaults to the boutique preset. */
  niche?: NicheKey;
  /** Alt text for the base still — defaults to the product title. */
  imageAlt?: string;
  className?: string;
  id?: string;
  /** The frame element, for export (html-to-image) or measurement. */
  ref?: Ref<HTMLElement>;
};

type ScrimSpec = { top: number; bottom: number; vignette: number };

/** Forest opacity (percent) at the frame edge for each protection layer. */
const SCRIMS: Record<'light' | 'balanced' | 'deep', ScrimSpec> = {
  light: { top: 52, bottom: 74, vignette: 18 },
  balanced: { top: 64, bottom: 86, vignette: 24 },
  deep: { top: 78, bottom: 94, vignette: 30 },
};

const forest = (percent: number) => `color-mix(in srgb, var(--mall-forest) ${percent}%, transparent)`;

/** Under a raw product photo (mock mode / letterboxed ratios) the frame is
 *  still a studio: a soft bone-lit forest sweep, tokens only. */
const STUDIO_PLATE: CSSProperties = {
  background:
    'radial-gradient(ellipse at 50% 38%, color-mix(in srgb, var(--mall-bone) 16%, var(--mall-forest)) 0%, var(--mall-forest) 72%)',
};

type Layout = {
  inset: string;
  kicker: string;
  headline: string;
  subline: string;
  title: string;
  price: string;
  stamp: string;
  topScrimHeight: string;
  bottomScrimHeight: string;
};

const LAYOUTS: Record<AdAspectRatio, Layout> = {
  '1:1': {
    inset: 'px-[6cqw] pt-[6cqw] pb-[6cqw]',
    kicker: 'text-[2.5cqw]',
    headline: 'mt-[1.6cqw] max-w-[84%] text-[8cqw]',
    subline: 'mt-[2.2cqw] max-w-[60%] text-[2.9cqw]',
    title: 'text-[2.3cqw]',
    price: 'text-[6.4cqw]',
    stamp: 'px-[2.6cqw] py-[1.4cqw] text-[2.4cqw]',
    topScrimHeight: 'h-[52%]',
    bottomScrimHeight: 'h-[56%]',
  },
  '9:16': {
    // Status safe zones: ~17cqw (≈9%) top, ~19cqw (≈11%) bottom at 9:16.
    inset: 'px-[7cqw] pt-[17cqw] pb-[19cqw]',
    kicker: 'text-[2.8cqw]',
    headline: 'mt-[2cqw] max-w-[88%] text-[9.6cqw]',
    subline: 'mb-[5cqw] max-w-[70%] text-[3.2cqw]',
    title: 'text-[2.6cqw]',
    price: 'text-[7.2cqw]',
    stamp: 'px-[3cqw] py-[1.6cqw] text-[2.6cqw]',
    topScrimHeight: 'h-[46%]',
    bottomScrimHeight: 'h-[50%]',
  },
};

export default function AdStudioCanvas({
  imageUrl,
  aspectRatio,
  copy,
  price,
  tenantDomain,
  productTitle,
  niche = 'DEFAULT_BOUTIQUE',
  imageAlt,
  className = '',
  id,
  ref,
}: AdStudioCanvasProps) {
  const format = AD_FORMATS[aspectRatio];
  const layout = LAYOUTS[aspectRatio];
  const scrim = SCRIMS[NICHE_PRESETS[niche]?.canvas.scrim ?? 'balanced'];

  const priceLabel = formatDalasi(price);
  const domain = formatTenantDomain(tenantDomain);
  const title = productTitle?.trim() || '';

  const topScrim: CSSProperties = {
    background: `linear-gradient(to bottom, ${forest(scrim.top)} 0%, ${forest(Math.round(scrim.top * 0.45))} 40%, transparent 100%)`,
  };
  const bottomScrim: CSSProperties = {
    background: `linear-gradient(to top, ${forest(scrim.bottom)} 0%, ${forest(Math.round(scrim.bottom * 0.5))} 42%, transparent 100%)`,
  };
  const vignette: CSSProperties = {
    background: `radial-gradient(ellipse at center, transparent 58%, ${forest(scrim.vignette)} 100%)`,
  };

  const ariaLabel = [copy.kicker, copy.headline, title, priceLabel, domain].filter(Boolean).join('. ');

  const subline = (
    <p className={`font-medium leading-snug tracking-[0.02em] text-mall-bone/85 ${layout.subline}`}>
      {copy.subline}
    </p>
  );

  return (
    <figure
      ref={ref}
      id={id}
      data-ad-ratio={aspectRatio}
      data-ad-niche={niche}
      aria-label={ariaLabel}
      className={`@container relative isolate w-full select-none overflow-hidden bg-mall-forest text-mall-bone ${className}`}
      style={{ aspectRatio: format.cssAspectRatio }}
    >
      {/* ── BASE: studio plate + the untouched still ─────────────────────── */}
      <div aria-hidden className="absolute inset-0" style={STUDIO_PLATE} />
      {/* eslint-disable-next-line @next/next/no-img-element -- exact-pixel ad
          surface: the still must never pass through the optimizer (resampling
          the product), must accept data: URLs from inline delivery, and must
          stay a plain <img> for html-to-image export. */}
      <img
        src={imageUrl}
        alt={imageAlt ?? title}
        className="absolute inset-0 h-full w-full object-contain object-center"
        draggable={false}
        decoding="async"
        loading="eager"
      />

      {/* ── PROTECTION: scrims (never intercept pointer events) ─────────── */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-[1]" style={vignette} />
      <div aria-hidden className={`pointer-events-none absolute inset-x-0 top-0 z-[1] ${layout.topScrimHeight}`} style={topScrim} />
      <div aria-hidden className={`pointer-events-none absolute inset-x-0 bottom-0 z-[1] ${layout.bottomScrimHeight}`} style={bottomScrim} />

      {/* ── TYPOGRAPHY ──────────────────────────────────────────────────── */}
      <figcaption className={`absolute inset-0 z-[2] flex flex-col justify-between ${layout.inset}`}>
        <div className="min-w-0">
          <p className={`font-bold uppercase tracking-[0.36em] text-mall-gold ${layout.kicker}`}>{copy.kicker}</p>
          <p
            className={`font-serif font-medium leading-[1.02] tracking-[-0.012em] text-balance text-mall-bone ${layout.headline}`}
          >
            {copy.headline}
          </p>
          {aspectRatio === '1:1' && subline}
        </div>

        <div className="min-w-0">
          {aspectRatio === '9:16' && subline}
          {/* Stamp: gold hairline · title whisper on its own full-width row ·
              price left, domain right. */}
          <div className="border-t border-mall-gold/45 pt-[2.6cqw]">
            {title && (
              <p className={`truncate font-semibold uppercase tracking-[0.2em] text-mall-bone/70 ${layout.title}`}>
                {title}
              </p>
            )}
            <div className="mt-[1cqw] flex items-end gap-[4cqw]">
              {priceLabel && (
                <p className={`min-w-0 font-serif leading-none tabular-nums text-mall-bone ${layout.price}`}>
                  {priceLabel}
                </p>
              )}
              {domain && (
                <p
                  className={`ml-auto max-w-[62%] shrink-0 truncate border border-mall-gold/70 font-bold uppercase tracking-[0.3em] text-mall-gold ${layout.stamp}`}
                >
                  {domain}
                </p>
              )}
            </div>
          </div>
        </div>
      </figcaption>
    </figure>
  );
}
