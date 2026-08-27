'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { fetchJSON, isTransportError } from '@/lib/transport';
import { Star, Upload, X, BadgeCheck, ImageIcon } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// BuyerReviewForm — the FRICTIONLESS verified-review form on the public PDP.
//
// Buyers are not auth users on this platform (checkout is a WhatsApp handoff
// keyed on customers.phone_number), so there is NO login wall here: the buyer
// proves purchase with the phone number they ordered with, verified entirely
// server-side by POST /api/reviews (service role — see that route's header).
//
// TWO-PHASE SUBMIT (Gambia Standard — a text review survives a dead 2G
// upload):
//   1. POST /api/reviews (JSON only) → 201 { review, uploads } — the review
//      IS posted from this moment.
//   2. uploadToSignedUrl for each photo (the token is the authorization;
//      no auth session needed) → POST /api/reviews/media confirms
//      server-side (size/MIME authority lives there).
// Phase-2 failure shows the honest "review posted — photos didn't make it"
// state with a retry that re-runs ONLY the photo phase.
//
// The dashboard seller-mode path keeps components/ReviewForm.tsx untouched —
// two callers, two components, zero seller-tab regression.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_PHOTOS = 4;
const MAX_FILE_BYTES = 8 * 1024 * 1024; // mirror of the server authority

type UploadTarget = { path: string; token: string };

type SubmitPhase =
  | { step: 'idle' }
  | { step: 'submitting' }
  | { step: 'uploading' }
  | { step: 'photos_failed'; reviewId: string; uploads: UploadTarget[] };

interface BuyerReviewFormProps {
  productId: string;
  onReviewSubmitted: () => void;
}

export default function BuyerReviewForm({ productId, onReviewSubmitted }: BuyerReviewFormProps) {
  const [rating, setRating] = useState(5);
  const [reviewerName, setReviewerName] = useState('');
  const [phone, setPhone] = useState('');
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [phase, setPhase] = useState<SubmitPhase>({ step: 'idle' });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const busy = phase.step === 'submitting' || phase.step === 'uploading';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const incoming = Array.from(e.target.files);
    e.target.value = '';
    setError(null);
    const rejected: string[] = [];
    setPhotos((prev) => {
      const next = [...prev];
      for (const file of incoming) {
        if (next.length >= MAX_PHOTOS) {
          rejected.push(`Up to ${MAX_PHOTOS} photos per review.`);
          break;
        }
        if (!file.type.startsWith('image/')) {
          rejected.push(`"${file.name}" is not a photo.`);
          continue;
        }
        if (file.size > MAX_FILE_BYTES) {
          rejected.push(`"${file.name}" is over 8MB.`);
          continue;
        }
        next.push(file);
      }
      return next;
    });
    if (rejected.length > 0) setError(rejected[0]);
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setRating(5);
    setReviewerName('');
    setPhone('');
    setComment('');
    setPhotos([]);
    setPhase({ step: 'idle' });
  };

  /** Phase two: signed-token uploads + server-side confirmation. Returns true
   *  when every step (including the confirm write) succeeded. */
  const runPhotoPhase = async (reviewId: string, uploads: UploadTarget[]): Promise<boolean> => {
    try {
      const pairs = uploads.slice(0, photos.length);
      for (let i = 0; i < pairs.length; i++) {
        const { error: uploadError } = await supabase.storage
          .from('review-media')
          .uploadToSignedUrl(pairs[i].path, pairs[i].token, photos[i]);
        if (uploadError) throw uploadError;
      }
      await fetchJSON('/api/reviews/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId }),
      }, { timeoutMs: 30_000 });
      return true;
    } catch (err) {
      console.error('[BuyerReviewForm] photo phase failed:', err);
      return false;
    }
  };

  const retryPhotos = async () => {
    if (phase.step !== 'photos_failed') return;
    const { reviewId, uploads } = phase;
    setPhase({ step: 'uploading' });
    setError(null);
    const ok = await runPhotoPhase(reviewId, uploads);
    if (ok) {
      setNotice('Thank you! Your verified review and photos are live.');
      resetForm();
      onReviewSubmitted();
    } else {
      setPhase({ step: 'photos_failed', reviewId, uploads });
      setError('Your review is posted, but the photos still didn’t make it. Retry when your connection is stronger.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setNotice(null);
    setPhase({ step: 'submitting' });

    let response: { review: { id: string }; uploads?: UploadTarget[] };
    try {
      // Phase one — JSON only. From a 201 the review IS posted.
      response = await fetchJSON<{ review: { id: string }; uploads?: UploadTarget[] }>('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          phone,
          reviewerName,
          rating,
          comment,
          mediaCount: photos.length,
        }),
      }, { timeoutMs: 30_000 });
    } catch (err) {
      setPhase({ step: 'idle' });
      if (isTransportError(err)) {
        setError(
          err.kind === 'offline'
            ? 'You appear to be offline. Your review was not sent — try again when you’re back online.'
            : err.message
        );
      } else {
        setError('Failed to submit your review. Please try again.');
      }
      return;
    }

    const uploads = response.uploads ?? [];
    if (photos.length > 0 && uploads.length > 0) {
      setPhase({ step: 'uploading' });
      const ok = await runPhotoPhase(response.review.id, uploads);
      if (!ok) {
        // HONESTY: the review is live; only the photos failed.
        setPhase({ step: 'photos_failed', reviewId: response.review.id, uploads });
        setError('Your review is posted — but the photos didn’t make it. Retry the photos below, or leave it as a text review.');
        onReviewSubmitted();
        return;
      }
    }

    setNotice('Thank you! Your verified review is live.');
    resetForm();
    onReviewSubmitted();
  };

  // ── Honest photo-retry state (review already posted) ──────────────────────
  if (phase.step === 'photos_failed') {
    return (
      <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex items-center gap-2 mb-3">
          <BadgeCheck className="w-5 h-5 text-green-700" />
          <h3 className="text-lg font-medium tracking-tight text-neutral-900">Review posted</h3>
        </div>
        <p className="text-sm text-neutral-600 leading-relaxed mb-4">
          Your verified review is live. Your {photos.length === 1 ? 'photo' : 'photos'} didn&rsquo;t
          finish uploading &mdash; you can retry now or keep it as a text review.
        </p>
        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={retryPhotos}
            className="w-full min-h-11 rounded-xl bg-black text-white px-4 py-3 text-sm font-medium hover:bg-neutral-800 transition-colors"
          >
            Retry photo upload
          </button>
          <button
            type="button"
            onClick={() => { resetForm(); setNotice('Your verified review is live.'); }}
            className="w-full min-h-11 rounded-xl border border-black/10 px-4 py-3 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
          >
            Keep it as a text review
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="mb-1 flex items-center gap-2">
        <h3 className="text-lg font-medium tracking-tight text-neutral-900">Write a Review</h3>
        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">
          <BadgeCheck size={11} /> Verified purchases only
        </span>
      </div>
      <p className="text-xs text-neutral-500 mb-4 leading-relaxed">
        No account needed &mdash; we match the phone number you ordered with on WhatsApp.
      </p>

      {notice && (
        <div className="mb-4 rounded-xl bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-800">
          {notice}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="buyer-review-name" className="block text-sm font-medium text-neutral-600 mb-2">Your Name</label>
          <input
            id="buyer-review-name"
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
          <label htmlFor="buyer-review-phone" className="block text-sm font-medium text-neutral-600 mb-2">
            Phone Number You Ordered With
          </label>
          <input
            id="buyer-review-phone"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            autoComplete="tel"
            className="w-full min-h-11 rounded-xl border border-black/10 px-4 py-3 text-base focus:border-black focus:ring-1 focus:ring-black outline-none transition-all placeholder:text-neutral-400 bg-neutral-50"
            placeholder="e.g. 7470187"
          />
          <p className="mt-1.5 text-[11px] text-neutral-400">
            Used only to confirm your purchase &mdash; never shown or stored with your review.
          </p>
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
                <Star
                  className={`w-6 h-6 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-neutral-200'}`}
                />
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="buyer-review-comment" className="block text-sm font-medium text-neutral-600 mb-2">Your Review</label>
          <textarea
            id="buyer-review-comment"
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

        <div>
          <span className="block text-sm font-medium text-neutral-600 mb-2">
            Photos <span className="font-normal text-neutral-400">(optional, up to {MAX_PHOTOS})</span>
          </span>
          <div className="relative flex min-h-11 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50 p-4 transition-colors hover:bg-neutral-100">
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileChange}
              disabled={busy}
              aria-label="Add photos to your review"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
            <Upload className="mb-2 h-6 w-6 text-neutral-400" />
            <span className="text-xs font-medium text-neutral-500">Add photos of your purchase</span>
          </div>
          {photos.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {photos.map((file, idx) => (
                <div
                  key={`${file.name}-${idx}`}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-100 pl-2.5 text-xs"
                >
                  <ImageIcon size={12} className="text-neutral-400" />
                  <span className="max-w-[110px] truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removePhoto(idx)}
                    disabled={busy}
                    aria-label={`Remove ${file.name}`}
                    className="flex h-11 w-10 items-center justify-center text-neutral-400 hover:text-red-500"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full min-h-11 rounded-xl bg-black text-white px-4 py-3 text-sm font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50"
        >
          {phase.step === 'submitting'
            ? 'Verifying your purchase...'
            : phase.step === 'uploading'
              ? 'Uploading photos...'
              : 'Submit Verified Review'}
        </button>
      </form>
    </div>
  );
}
