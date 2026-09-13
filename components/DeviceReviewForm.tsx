'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { BadgeCheck, Star } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// DeviceReviewForm — "Write a Review" for a buyer this DEVICE recognises.
//
// Rendered by the PDP only when the product id is in the local purchase
// memory (lib/purchaseMemory — written on every successful WhatsApp order
// handoff). No phone, no login: Name + Rating + Comment → a direct INSERT
// under the public policy in sql/reviews-mvp.sql (is_verified = true).
// The phone-verified badge (verified_purchase) stays service-role-only.
// ─────────────────────────────────────────────────────────────────────────────

interface DeviceReviewFormProps {
  productId: string;
  shopId: string | null;
  onReviewSubmitted: () => void;
}

// 42703 = undefined column, PGRST204 = column missing from the schema cache —
// both mean sql/reviews-mvp.sql has not been applied yet.
const MISSING_COLUMN_CODES = new Set(['42703', 'PGRST204']);
const DEADLINE_MS = 12_000;

export default function DeviceReviewForm({ productId, shopId, onReviewSubmitted }: DeviceReviewFormProps) {
  const [rating, setRating] = useState(5);
  const [reviewerName, setReviewerName] = useState('');
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setError('You appear to be offline. Your review was not sent — try again when you’re back online.');
      setIsSubmitting(false);
      return;
    }

    const base = {
      product_id: productId,
      rating,
      comment: comment.trim(),
      reviewer_name: reviewerName.trim(),
      is_external: false,
      media_urls: [] as string[],
    };

    try {
      let { error: insertError } = await supabase
        .from('reviews')
        .insert({ ...base, shop_id: shopId, is_verified: true })
        .abortSignal(AbortSignal.timeout(DEADLINE_MS));
      if (insertError && MISSING_COLUMN_CODES.has(insertError.code)) {
        ({ error: insertError } = await supabase
          .from('reviews')
          .insert(base)
          .abortSignal(AbortSignal.timeout(DEADLINE_MS)));
      }
      if (insertError) throw insertError;

      setPosted(true);
      onReviewSubmitted();
    } catch (err) {
      console.error('[DeviceReviewForm] submit failed:', err);
      setError('Your review could not be saved. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (posted) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex items-center gap-2 mb-2">
          <BadgeCheck className="w-5 h-5 text-green-700" />
          <h3 className="text-lg font-medium tracking-tight text-neutral-900">Thank you!</h3>
        </div>
        <p className="text-sm text-neutral-600 leading-relaxed">Your verified review is live below.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="mb-1 flex items-center gap-2">
        <h3 className="text-lg font-medium tracking-tight text-neutral-900">Write a Review</h3>
        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">
          <BadgeCheck size={11} /> Verified buyer
        </span>
      </div>
      <p className="text-xs text-neutral-500 mb-4 leading-relaxed">
        We recognise this device &mdash; you ordered this item here. No phone number needed.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="device-review-name" className="block text-sm font-medium text-neutral-600 mb-2">Your Name</label>
          <input
            id="device-review-name"
            type="text"
            value={reviewerName}
            onChange={(e) => setReviewerName(e.target.value)}
            required
            minLength={2}
            maxLength={80}
            autoComplete="name"
            className="w-full min-h-11 rounded-xl border border-black/10 px-4 py-3 text-base focus:border-black focus:ring-1 focus:ring-black outline-none transition-all placeholder:text-neutral-400 bg-neutral-50"
            placeholder="e.g. Fatou Ceesay"
          />
        </div>

        <div>
          <span className="block text-sm font-medium text-neutral-600 mb-2">Rating</span>
          <div className="flex items-center">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                aria-label={`${star} star${star > 1 ? 's' : ''}`}
                className="flex h-11 w-11 items-center justify-center focus:outline-none transition-colors"
              >
                <Star className={`w-6 h-6 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-neutral-200'}`} />
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="device-review-comment" className="block text-sm font-medium text-neutral-600 mb-2">Your Review</label>
          <textarea
            id="device-review-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            required
            minLength={3}
            maxLength={2000}
            rows={4}
            className="w-full rounded-xl border border-black/10 px-4 py-3 text-base focus:border-black focus:ring-1 focus:ring-black outline-none transition-all placeholder:text-neutral-400 bg-neutral-50"
            placeholder="Share your experience with this product..."
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full min-h-11 rounded-xl bg-black text-white px-4 py-3 text-sm font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? 'Posting...' : 'Post Review'}
        </button>
      </form>
    </div>
  );
}
