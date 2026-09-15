'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { History, Star } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// LegacyReviewForm — seller-side "Add Past Review" (dashboard /reviews).
//
// Sellers arriving from WhatsApp / Instagram already hold months of buyer
// feedback. This imports it: Name + Rating + Comment → direct INSERT under
// reviews_seller_insert (sql/reviews-mvp.sql). shop_id = the seller's uid
// (shops.id == auth.uid()), is_external = true marks it as imported, and
// is_verified = true because the seller vouches for it (ReviewList renders
// "Verified Store Import" — never "Verified Buyer"; sql/iron-dome-security.sql).
// ─────────────────────────────────────────────────────────────────────────────

interface LegacyReviewFormProps {
  productId: string;
  productName?: string;
  onReviewSubmitted: () => void;
}

const MISSING_COLUMN_CODES = new Set(['42703', 'PGRST204']);
const DEADLINE_MS = 12_000;

export default function LegacyReviewForm({ productId, productName, onReviewSubmitted }: LegacyReviewFormProps) {
  const [supabase] = useState(() =>
    createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  );
  const [reviewerName, setReviewerName] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      // Local session read (no network) — the insert itself is the round-trip.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Your session has expired. Please sign in again.');

      const name = reviewerName.trim();
      const base = {
        product_id: productId,
        buyer_id: session.user.id,
        rating,
        comment: comment.trim(),
        reviewer_name: name,
        is_external: true,
        external_author: name,
        media_urls: [] as string[],
      };

      let { error: insertError } = await supabase
        .from('reviews')
        .insert({ ...base, shop_id: session.user.id, is_verified: true })
        .abortSignal(AbortSignal.timeout(DEADLINE_MS));
      // sql/reviews-mvp.sql not applied yet → retry without the new columns.
      if (insertError && MISSING_COLUMN_CODES.has(insertError.code)) {
        ({ error: insertError } = await supabase
          .from('reviews')
          .insert(base)
          .abortSignal(AbortSignal.timeout(DEADLINE_MS)));
      }
      if (insertError) throw insertError;

      setReviewerName('');
      setRating(5);
      setComment('');
      setNotice(`Past review from ${name} added.`);
      onReviewSubmitted();
    } catch (err) {
      console.error('[LegacyReviewForm] submit failed:', err);
      setError(err instanceof Error && err.message ? err.message : 'Could not save this review. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm md:p-8">
      <div className="mb-1 flex items-center gap-2">
        <History className="h-5 w-5 text-gray-400" />
        <h3 className="text-lg font-bold text-gray-900">Add Past Review</h3>
      </div>
      <p className="mb-6 text-sm text-gray-500">
        Import feedback you already received on WhatsApp or in person{productName ? ` for ${productName}` : ''}.
        It appears on the product page marked as a store import &mdash; never as a platform checkout.
      </p>

      {notice && (
        <div className="mb-4 rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="legacy-review-name" className="mb-2 block text-sm font-medium text-gray-600">Customer Name</label>
          <input
            id="legacy-review-name"
            type="text"
            value={reviewerName}
            onChange={(e) => setReviewerName(e.target.value)}
            required
            minLength={2}
            maxLength={80}
            className="w-full min-h-11 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base outline-none transition focus:border-gray-900"
            placeholder="e.g. Awa Jallow"
          />
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium text-gray-600">Rating</span>
          <div className="flex items-center">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                aria-label={`${star} star${star > 1 ? 's' : ''}`}
                className="flex h-11 w-11 items-center justify-center focus:outline-none"
              >
                <Star className={`h-6 w-6 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} />
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="legacy-review-comment" className="mb-2 block text-sm font-medium text-gray-600">Their Words</label>
          <textarea
            id="legacy-review-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            required
            minLength={3}
            maxLength={2000}
            rows={4}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base outline-none transition focus:border-gray-900"
            placeholder="Paste the feedback exactly as the customer wrote it..."
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full min-h-11 rounded-xl bg-gray-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-black disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : 'Add Past Review'}
        </button>
      </form>
    </div>
  );
}
