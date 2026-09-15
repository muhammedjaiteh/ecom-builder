import Link from 'next/link';
import { ArrowRight, Clapperboard } from 'lucide-react';
import SmartImage from '@/components/SmartImage';
import CinematicVideo from './CinematicVideo';
import { formatDalasi } from './format';

// ─────────────────────────────────────────────────────────────────────────────
// CinematicTile — the marketplace's living curation surface. A server-safe
// shell (fixed-size container + SmartImage poster + whisper overlay) that
// composes the CinematicVideo client island when the product owns an Ad
// Studio film. No film → the STILL-LIFE EDITION: identical typography over
// the poster alone.
//
// Three variants:
//   'hero'      — the edge-to-edge featured banner that opens the mall. FIXED
//     heights per breakpoint (188 → 340px) so it never pushes the product
//     rails below the fold and never shifts layout: on a 360×780 handset the
//     first rail's cards start ≈440px down, fully above the fold. Forest
//     gradient plates (bottom on every size, a left wash from md+) carry the
//     gold kicker, serif headline, price, and ONE understated CTA. A stretched
//     link makes the whole banner navigate to the product (the visible CTA is
//     a styled span inside the pointer-inert overlay, so exactly ONE anchor
//     exists; the 2G '▶ Watch' button z-stacks above it).
//   'interlude' — full-bleed editorial banner between shelf sections
//     (16:9 mobile / 21:9 desktop, both FIXED aspect → zero CLS). Same
//     one-anchor overlay contract as the hero.
//   'feature'   — a double-width carousel tile sharing the rail cards' anatomy
//     (media box, then name/price/boutique). Its 5:3 media box is exactly as
//     tall as two neighbouring 4:5 cards' width-doubled box (2w + gap wide ×
//     1.25w tall ≈ 5:3), so the row reads as one continuous shelf.
// ─────────────────────────────────────────────────────────────────────────────

export type CinematicTileData = {
  /** Product id — the tile links to /product/[id] and keys the playback election. */
  id: string;
  name: string;
  price: number | null;
  shopName: string;
  /** ad_hero_image_url first, then the product photo — the seller's real pixels. */
  posterUrl: string | null;
  /** Ad Studio film; null renders the still-life edition. */
  videoUrl: string | null;
};

function PosterLayer({
  data,
  sizes,
  priority = false,
}: {
  data: CinematicTileData;
  sizes: string;
  priority?: boolean;
}) {
  if (data.posterUrl) {
    return (
      <SmartImage
        src={data.posterUrl}
        alt={data.name}
        fill
        priority={priority}
        sizes={sizes}
        blurTone="dark"
        className="object-cover"
      />
    );
  }
  // Neutral editorial plate — never a broken frame (Law 4).
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-mall-forest via-[#12281f] to-[#0b1a14]">
      <span className="font-serif text-6xl italic text-mall-bone/10">
        {(data.name || 'S').charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

type CinematicTileProps = {
  data: CinematicTileData;
  variant: 'hero' | 'interlude' | 'feature';
  /** Optional kicker line above the headline (defaults to the boutique name). */
  kicker?: string;
  /** LCP hint — true only for the tile that opens the page (the hero) or leads
   *  the topmost populated shelf. Forwarded to Next/Image on the poster. */
  priority?: boolean;
};

/** Hero heights — fixed per breakpoint (zero CLS, rails stay above the fold). */
const HERO_HEIGHT = 'h-[188px] sm:h-[232px] md:h-[300px] lg:h-[340px]';

export default function CinematicTile({ data, variant, kicker, priority = false }: CinematicTileProps) {
  const price = formatDalasi(data.price);
  const href = `/product/${data.id}`;

  if (variant === 'hero') {
    return (
      <section className={`relative w-full overflow-hidden bg-mall-forest ${HERO_HEIGHT}`}>
        <PosterLayer data={data} sizes="100vw" priority={priority} />
        {data.videoUrl && (
          <CinematicVideo id={data.id} src={data.videoUrl} poster={data.posterUrl} alt={data.name} />
        )}
        {/* Forest plates: a bottom wash everywhere, a left wash from md+ so the
            copy column sits on ink while the product stays clear on the right. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-mall-forest/95 via-mall-forest/55 via-40% to-mall-forest/0" />
        <div aria-hidden className="pointer-events-none absolute inset-0 z-[1] hidden bg-gradient-to-r from-mall-forest/80 via-mall-forest/25 to-transparent md:block" />

        {/* The ONE anchor: the whole banner navigates to the product. */}
        <Link href={href} aria-label={`${data.name} — ${data.shopName}`} className="absolute inset-0 z-[2]" />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] px-4 pb-4 md:px-10 md:pb-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-mall-gold">
            {kicker ?? 'Featured drop'}
            <span className="text-mall-bone/50"> · {data.shopName}</span>
          </p>
          <p className="mt-1.5 line-clamp-2 max-w-xl font-serif text-[22px] font-semibold leading-[1.1] text-mall-bone sm:text-2xl md:mt-2 md:text-4xl">
            {data.name}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 md:mt-3">
            {price && <p className="text-sm font-semibold tabular-nums text-mall-bone md:text-base">{price}</p>}
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-mall-gold px-3.5 text-[10px] font-bold uppercase tracking-[0.22em] text-mall-forest md:h-9 md:px-4">
              Shop now <ArrowRight size={12} aria-hidden />
            </span>
          </div>
        </div>
      </section>
    );
  }

  if (variant === 'interlude') {
    return (
      <section className="relative aspect-video w-full overflow-hidden bg-mall-forest md:aspect-[21/9]">
        <PosterLayer data={data} sizes="100vw" priority={priority} />
        {data.videoUrl && (
          <CinematicVideo id={data.id} src={data.videoUrl} poster={data.posterUrl} alt={data.name} />
        )}
        <div aria-hidden className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-mall-forest/85 via-mall-forest/20 to-mall-forest/5" />

        {/* The ONE anchor: the whole banner navigates to the product. */}
        <Link href={href} aria-label={`${data.name} — ${data.shopName}`} className="absolute inset-0 z-[2]" />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] p-5 md:p-10">
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-mall-gold">
            {kicker ?? data.shopName}
          </p>
          <p className="mt-2 max-w-2xl font-serif text-2xl font-semibold leading-tight text-mall-bone md:text-4xl">
            {data.name}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            {price && <p className="text-sm font-semibold tabular-nums text-mall-bone/90">{price}</p>}
            <span className="inline-flex items-center gap-2 border-b border-mall-gold/70 pb-0.5 text-[10px] font-bold uppercase tracking-[0.3em] text-mall-bone">
              Discover the piece <ArrowRight size={12} aria-hidden />
            </span>
          </div>
        </div>
      </section>
    );
  }

  // 'feature' — neighbour-card anatomy, doubled.
  return (
    <div className="group flex flex-col">
      <div className="relative aspect-[5/3] overflow-hidden rounded-lg bg-mall-forest shadow-[0_1px_2px_rgba(27,58,45,0.08),0_14px_30px_-18px_rgba(27,58,45,0.45)]">
        <PosterLayer
          data={data}
          sizes="(max-width: 640px) 312px, (max-width: 768px) 348px, (max-width: 1024px) 384px, 416px"
          priority={priority}
        />
        {data.videoUrl && (
          <CinematicVideo id={data.id} src={data.videoUrl} poster={data.posterUrl} alt={data.name} />
        )}
        {data.videoUrl && (
          <div className="pointer-events-none absolute left-1.5 top-1.5 z-[3] flex items-center gap-1 rounded-full bg-mall-forest/70 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-mall-bone backdrop-blur">
            <Clapperboard size={10} aria-hidden /> Film
          </div>
        )}
        <Link href={href} aria-label={data.name} className="absolute inset-0 z-[2]" />
      </div>
      <Link href={href} className="mt-2 block min-w-0 px-0.5">
        {price && (
          <p className="text-[14px] font-semibold leading-none tracking-tight tabular-nums text-mall-forest md:text-[15px]">
            {price}
          </p>
        )}
        <p className="mt-1 line-clamp-2 text-[13px] font-medium leading-[18px] text-mall-forest/90 group-hover:underline md:text-[14px] md:leading-5">
          {data.name}
        </p>
        <p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-mall-forest/50">
          {data.shopName}
        </p>
      </Link>
    </div>
  );
}
