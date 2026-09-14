'use client';

import { Star } from 'lucide-react';
import { useProductRating } from '@/lib/useProductRating';

// Top-of-PDP social proof: "★★★★★ 4.8 (12)" directly under the title. Click
// → smooth anchor scroll to the review section (#reviews by default). Zero
// reviews still renders (muted stars + "No reviews yet") so the anchor to
// the feedback section is always one tap away. Fixed height → no layout
// shift while the aggregate loads.

export default function ProductRatingBadge({
  productId,
  targetId = 'reviews',
  className = '',
  starClassName = 'fill-yellow-400 text-yellow-400',
  starEmptyClassName = 'text-neutral-300',
  textClassName,
}: {
  productId: string;
  targetId?: string;
  className?: string;
  /** Filled star (fill + stroke). Vivid gold to match ReviewList — never a theme accent. */
  starClassName?: string;
  /** Unfilled star. */
  starEmptyClassName?: string;
  textClassName: string;
}) {
  const rating = useProductRating(productId);

  const scrollToReviews = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById(targetId);
    if (!target) return; // fall through to the plain hash navigation
    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const filled = rating ? Math.round(rating.average) : 0;
  const label = !rating
    ? ''
    : rating.count === 0
      ? 'No reviews yet'
      : `${rating.average.toFixed(1)} (${rating.count})`;

  return (
    <a
      href={`#${targetId}`}
      onClick={scrollToReviews}
      aria-label={
        rating && rating.count > 0
          ? `Rated ${rating.average.toFixed(1)} out of 5 from ${rating.count} reviews. Jump to reviews.`
          : 'Jump to customer reviews'
      }
      className={`group inline-flex h-6 items-center gap-2 transition-opacity ${rating ? 'opacity-100' : 'opacity-0'} ${className}`}
    >
      <span className="flex items-center gap-0.5" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            size={15}
            strokeWidth={1.75}
            className={i < filled ? starClassName : starEmptyClassName}
          />
        ))}
      </span>
      <span className={`${textClassName} underline-offset-4 group-hover:underline`}>{label}</span>
    </a>
  );
}
