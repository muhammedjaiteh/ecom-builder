'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Star, Upload, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ReviewFormProps {
  productId: string;
  onReviewSubmitted: () => void;
}

export default function ReviewForm({ productId, onReviewSubmitted }: ReviewFormProps) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isExternal, setIsExternal] = useState(false);
  const [externalAuthor, setExternalAuthor] = useState('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setMediaFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('You must be logged in to leave a review.');

      let uploadedUrls: string[] = [];

      if (isExternal && mediaFiles.length > 0) {
        for (const file of mediaFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Math.random()}.${fileExt}`;
          const filePath = `${userData.user.id}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('review-media')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { data } = supabase.storage.from('review-media').getPublicUrl(filePath);
          uploadedUrls.push(data.publicUrl);
        }
      }

      const { error } = await supabase.from('reviews').insert({
        product_id: productId,
        buyer_id: userData.user.id,
        rating,
        comment,
        is_external: isExternal,
        external_author: isExternal ? externalAuthor : null,
        media_urls: uploadedUrls,
      });

      if (error) throw error;
      
      setComment('');
      setRating(5);
      setIsExternal(false);
      setExternalAuthor('');
      setMediaFiles([]);
      onReviewSubmitted();
    } catch (err: unknown) {
      console.error('[review] submission error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to submit review. Please try again.';
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium tracking-tight text-neutral-900">Write a Review</h3>
        <label className="flex items-center gap-2 cursor-pointer group">
          <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider group-hover:text-neutral-900 transition-colors">Seller Mode</span>
          <div className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 ${isExternal ? 'bg-black' : 'bg-neutral-200'}`}>
            <input type="checkbox" className="sr-only" checked={isExternal} onChange={(e) => setIsExternal(e.target.checked)} />
            <span aria-hidden="true" className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isExternal ? 'translate-x-2' : '-translate-x-2'}`} />
          </div>
        </label>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <AnimatePresence>
          {isExternal && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pb-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-600 mb-2">Customer Name</label>
                  <input
                    type="text"
                    value={externalAuthor}
                    onChange={(e) => setExternalAuthor(e.target.value)}
                    required={isExternal}
                    className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm focus:border-black focus:ring-1 focus:ring-black outline-none transition-all placeholder:text-neutral-400 bg-neutral-50"
                    placeholder="e.g. John Doe (WhatsApp)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-600 mb-2">External Media</label>
                  <div className="border-2 border-dashed border-neutral-200 rounded-xl p-4 flex flex-col items-center justify-center bg-neutral-50 hover:bg-neutral-100 transition-colors cursor-pointer relative">
                    <input type="file" multiple accept="image/*,video/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    <Upload className="w-6 h-6 text-neutral-400 mb-2" />
                    <span className="text-xs text-neutral-500 font-medium">Click to upload photos/videos</span>
                  </div>
                  {mediaFiles.length > 0 && (
                    <div className="mt-3 flex gap-2 flex-wrap">
                      {mediaFiles.map((file, idx) => (
                        <div key={idx} className="relative inline-flex items-center gap-1 bg-neutral-100 px-2 py-1 rounded-md text-xs border border-neutral-200">
                          <span className="truncate max-w-[100px]">{file.name}</span>
                          <button type="button" onClick={() => removeFile(idx)} className="text-neutral-400 hover:text-red-500"><X size={12} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div>
          <label className="block text-sm font-medium text-neutral-600 mb-2">Rating</label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className="focus:outline-none transition-colors"
              >
                <Star
                  className={`w-6 h-6 ${
                    star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-neutral-200'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-600 mb-2">Comment</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            required
            rows={4}
            className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm focus:border-black focus:ring-1 focus:ring-black outline-none transition-all placeholder:text-neutral-400 bg-neutral-50"
            placeholder="Share your experience with this product..."
          />
        </div>
        {submitError && (
          <p className="text-sm text-red-500">{submitError}</p>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-black text-white px-4 py-3 text-sm font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Review'}
        </button>
      </form>
    </div>
  );
}