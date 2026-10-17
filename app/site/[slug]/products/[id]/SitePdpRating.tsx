'use client';

import { Star } from 'lucide-react';
import { useProductRating } from '@/lib/useProductRating';

// ─────────────────────────────────────────────────────────────────────────────
// SitePdpRating — the boutique PDP's title rating line (Pass 3).
//
// Renders ONLY when the product has at least one review: "★★★★★ 4.8 (12)",
// anchoring to #reviews. Zero reviews render NOTHING — no gray stars, no
// "No reviews yet" (the marketplace badge keeps that behaviour for its own
// PDP; a luxury storefront never advertises its own empty state). While the
// aggregate loads nothing renders either, so the price never jumps.
//
// Same anon read + cross-island refresh as components/ProductRatingBadge
// (lib/useProductRating), so a review posted on this device appears here.
// ─────────────────────────────────────────────────────────────────────────────

export default function SitePdpRating({
  productId,
  targetId = 'reviews',
  className = '',
  starClassName,
  starEmptyClassName,
  textClassName,
}: {
  productId: string;
  targetId?: string;
  className?: string;
  starClassName: string;
  starEmptyClassName: string;
  textClassName: string;
}) {
  const rating = useProductRating(productId);
  if (!rating || rating.count === 0) return null;

  const filled = Math.round(rating.average);
  const scrollToReviews = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById(targetId);
    if (!target) return; // fall through to the plain hash navigation
    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <a
      href={`#${targetId}`}
      onClick={scrollToReviews}
      aria-label={`Rated ${rating.average.toFixed(1)} out of 5 from ${rating.count} review${rating.count === 1 ? '' : 's'}. Jump to reviews.`}
      className={`group inline-flex min-h-6 items-center gap-2 ${className}`}
    >
      <span className="flex items-center gap-0.5" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} size={14} strokeWidth={1.75} className={i < filled ? starClassName : starEmptyClassName} />
        ))}
      </span>
      <span className={`${textClassName} underline-offset-4 group-hover:underline`}>
        {rating.average.toFixed(1)} ({rating.count})
      </span>
    </a>
  );
}
