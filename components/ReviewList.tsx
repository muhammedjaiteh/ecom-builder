'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Star, Play, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  buyer_id: string;
  is_external: boolean;
  external_author: string | null;
  media_urls: string[] | null;
}

export default function ReviewList({ productId, refreshTrigger }: { productId: string, refreshTrigger: number }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [average, setAverage] = useState<number>(0);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReviews() {
      setFetchError(null);
      // Fetch Reviews
      const { data: revs, error: revErr } = await supabase
        .from('reviews')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

      if (revErr) {
        console.error('[ReviewList] fetch error:', revErr.message);
        setFetchError('Could not load reviews. Please refresh the page.');
        return;
      }
      if (revs) setReviews(revs);

      // Fetch Aggregated Average
      const { data: avg, error: avgErr } = await supabase
        .rpc('get_average_rating', { p_id: productId });

      if (!avgErr && avg !== null) setAverage(avg);
    }
    fetchReviews();
  }, [productId, refreshTrigger]);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4 border-b border-black/5 pb-6">
        <h2 className="text-2xl font-semibold tracking-tight">Customer Reviews</h2>
        {average > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-neutral-50 rounded-full border border-black/5">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-medium">{average.toFixed(1)} out of 5</span>
            <span className="text-sm text-neutral-500">({reviews.length})</span>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {fetchError ? (
          <p className="text-sm text-red-500">{fetchError}</p>
        ) : reviews.length === 0 ? (
          <p className="text-neutral-500 text-sm">No reviews yet. Be the first to review this product!</p>
        ) : (
          <AnimatePresence>
            {reviews.map((review) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="pb-6 border-b border-black/5 last:border-0"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-neutral-200'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-neutral-400 font-medium">
                    {review.is_external ? `Verified via ${review.external_author || 'External'}` : 'Verified Buyer'}
                  </span>
                  <span className="text-xs text-neutral-300 mx-1">•</span>
                  <span className="text-xs text-neutral-400">
                    {new Date(review.created_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric'
                    })}
                  </span>
                </div>
                <p className="text-neutral-700 text-sm leading-relaxed">{review.comment}</p>
                
                {review.media_urls && review.media_urls.length > 0 && (
                  <div className="mt-4 flex gap-3 overflow-x-auto hide-scrollbar snap-x snap-mandatory">
                    {review.media_urls.map((url, index) => {
                      const isVideo = url.match(/\.(mp4|webm|ogg)$/i);
                      return (
                        <div key={index} className="relative shrink-0 snap-start h-24 w-24 md:h-32 md:w-32 rounded-xl overflow-hidden bg-neutral-100 ring-1 ring-black/5">
                          {isVideo ? (
                            <>
                              <video src={url} className="w-full h-full object-cover" muted loop autoPlay playsInline />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
                                <Play className="w-6 h-6 text-white" />
                              </div>
                            </>
                          ) : (
                            <img src={url} className="w-full h-full object-cover" alt="Review Media" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}