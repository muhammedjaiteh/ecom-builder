import Link from 'next/link';
import { ArrowRight, Clapperboard } from 'lucide-react';
import SmartImage from '@/components/SmartImage';
import CinematicVideo from './CinematicVideo';

// ─────────────────────────────────────────────────────────────────────────────
// CinematicTile — the marketplace's living curation surface. A server-safe
// shell (fixed-aspect container + SmartImage poster + whisper overlay) that
// composes the CinematicVideo client island when the product owns an Ad
// Studio film. No film → the STILL-LIFE EDITION: identical typography over
// the poster alone.
//
// Two variants:
//   'interlude' — full-bleed editorial banner between shelf sections
//     (16:9 mobile / 21:9 desktop, both FIXED aspect → zero CLS). No
//     controls, no progress chrome; whisper overlay carries shop name,
//     product name, D-price, and one understated CTA. A stretched link makes
//     the whole banner navigate to the product (the visible CTA is a styled
//     span inside the pointer-inert overlay, so exactly ONE anchor exists;
//     the 2G '▶ Watch' button z-stacks above it).
//   'feature' — a double-width carousel tile with the SAME card anatomy as
//     its neighbor product cards (media box, then name/price/boutique) —
//     just larger and living. Media box carries its own stretched link;
//     the text block is a second, ordinary link.
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

function dalasi(price: number | null): string | null {
  return price == null ? null : `D${Number(price).toLocaleString()}`;
}

function PosterLayer({ data, sizes }: { data: CinematicTileData; sizes: string }) {
  if (data.posterUrl) {
    return (
      <SmartImage
        src={data.posterUrl}
        alt={data.name}
        fill
        sizes={sizes}
        blurTone="dark"
        className="object-cover"
      />
    );
  }
  // Neutral editorial plate — never a broken frame (Law 4).
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-800 via-neutral-900 to-neutral-950">
      <span className="font-serif text-6xl italic text-white/10">
        {(data.name || 'S').charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

type CinematicTileProps = {
  data: CinematicTileData;
  variant: 'interlude' | 'feature';
  /** Optional kicker line above the interlude headline (defaults to the
   *  boutique name) — the empty-shelf fills label themselves honestly. */
  kicker?: string;
};

export default function CinematicTile({ data, variant, kicker }: CinematicTileProps) {
  const price = dalasi(data.price);
  const href = `/product/${data.id}`;

  if (variant === 'interlude') {
    return (
      <section className="relative aspect-video w-full overflow-hidden bg-neutral-950 md:aspect-[21/9]">
        <PosterLayer data={data} sizes="100vw" />
        {data.videoUrl && (
          <CinematicVideo id={data.id} src={data.videoUrl} poster={data.posterUrl} alt={data.name} />
        )}
        <div aria-hidden className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/75 via-black/20 to-black/5" />

        {/* The ONE anchor: the whole banner navigates to the product. */}
        <Link href={href} aria-label={`${data.name} — ${data.shopName}`} className="absolute inset-0 z-[2]" />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] p-5 md:p-10">
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-white/60">
            {kicker ?? data.shopName}
          </p>
          <p className="mt-2 max-w-2xl font-serif text-2xl font-bold leading-tight text-white md:text-4xl">
            {data.name}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            {price && <p className="text-sm font-semibold text-white/90">{price}</p>}
            <span className="inline-flex items-center gap-2 border-b border-white/50 pb-0.5 text-[10px] font-bold uppercase tracking-[0.3em] text-white">
              Discover the piece <ArrowRight size={12} aria-hidden />
            </span>
          </div>
        </div>
      </section>
    );
  }

  // 'feature' — neighbor-card anatomy, doubled.
  return (
    <div className="group flex flex-col">
      <div className="relative aspect-square overflow-hidden rounded-xl border border-black/5 bg-neutral-950">
        <PosterLayer data={data} sizes="(max-width: 640px) 332px, (max-width: 1024px) 396px, 468px" />
        {data.videoUrl && (
          <CinematicVideo id={data.id} src={data.videoUrl} poster={data.posterUrl} alt={data.name} />
        )}
        {data.videoUrl && (
          <div className="pointer-events-none absolute left-2 top-2 z-[3] flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
            <Clapperboard size={10} aria-hidden /> Film
          </div>
        )}
        <Link href={href} aria-label={data.name} className="absolute inset-0 z-[2]" />
      </div>
      <Link href={href} className="mt-2.5 block space-y-0.5">
        <h4 className="line-clamp-2 text-[15px] font-medium leading-6 text-gray-900 group-hover:underline">
          {data.name}
        </h4>
        {price && <p className="text-[15px] font-semibold text-gray-900">{price}</p>}
        <p className="truncate text-xs text-gray-500">{data.shopName}</p>
      </Link>
    </div>
  );
}
