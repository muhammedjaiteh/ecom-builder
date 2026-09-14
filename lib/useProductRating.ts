'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export type ProductRating = { average: number; count: number };

// Cross-island refresh: the review forms live in a different client island
// than the title badge (the /site PDP is a server component), so a posted
// review is announced on window and every rating hook for that product
// re-fetches. Same anon read policy as components/ReviewList.
const REVIEW_SUBMITTED_EVENT = 'sanndikaa:review-submitted';

export function notifyReviewSubmitted(productId: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(REVIEW_SUBMITTED_EVENT, { detail: { productId } }));
}

/** Aggregate star rating for a product; null until the first read lands. */
export function useProductRating(productId: string): ProductRating | null {
  const [rating, setRating] = useState<ProductRating | null>(null);

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('rating')
        .eq('product_id', productId);
      if (cancelled || error || !data) return;
      const ratings = data
        .map((row) => Number(row.rating))
        .filter((n) => Number.isFinite(n));
      const count = ratings.length;
      const average = count ? ratings.reduce((sum, n) => sum + n, 0) / count : 0;
      setRating({ average, count });
    };

    const onSubmitted = (event: Event) => {
      const detail = (event as CustomEvent<{ productId?: string }>).detail;
      if (!detail?.productId || detail.productId === productId) void load();
    };

    void load();
    window.addEventListener(REVIEW_SUBMITTED_EVENT, onSubmitted);
    return () => {
      cancelled = true;
      window.removeEventListener(REVIEW_SUBMITTED_EVENT, onSubmitted);
    };
  }, [productId]);

  return rating;
}
