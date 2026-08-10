'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useEffect, useState } from 'react';
import { Clapperboard, Film, Link2, Loader2, X } from 'lucide-react';
import SmartImage from '@/components/SmartImage';

// ─────────────────────────────────────────────────────────────────────────────
// VideoHeroPicker — asset picker for the video_hero block (Phase 4 Step 3).
// Lists the seller's COMPLETED Ad Studio commercials — video_ads carries
// owner-readable RLS through the browser client (same read pattern as
// VideoManager's history load) — plus a validated manual https URL input.
// Selecting an ad auto-fills posterUrl from its hero still; a manual URL
// carries no poster (VideoHeroMedia degrades to the template gradient if the
// asset fails). Law 4 by construction: every offered asset is a render the
// seller already owns — nothing here generates or mutates product pixels.
// ─────────────────────────────────────────────────────────────────────────────

export type VideoHeroSelection = { videoUrl: string; posterUrl: string | null };

type PickerAd = {
  id: string;
  product_id: string | null;
  video_url: string;
  hero_image_url: string | null;
  created_at: string | null;
};

type VideoHeroPickerProps = {
  shopId: string;
  heading: string;
  onSelect: (selection: VideoHeroSelection) => void;
  onClose: () => void;
};

function formatAdDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function VideoHeroPicker({ shopId, heading, onSelect, onClose }: VideoHeroPickerProps) {
  const [ads, setAds] = useState<PickerAd[]>([]);
  const [productNames, setProductNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [manualUrl, setManualUrl] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data, error } = await supabase
        .from('video_ads')
        .select('id, product_id, video_url, hero_image_url, created_at')
        .eq('shop_id', shopId)
        .eq('status', 'completed')
        .not('video_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(24);
      if (cancelled) return;
      if (error) {
        console.error('[VideoHeroPicker] Failed to load Ad Studio films:', error);
        setLoading(false);
        return;
      }
      const rows = ((data ?? []) as PickerAd[]).filter(
        (r) => typeof r.video_url === 'string' && r.video_url.length > 0
      );
      setAds(rows);

      // Product names for the cards — separate keyed read (public-read RLS),
      // never a join, so a missing FK relationship can't break the picker.
      const productIds = [...new Set(rows.map((r) => r.product_id).filter((v): v is string => Boolean(v)))];
      if (productIds.length > 0) {
        const { data: prods } = await supabase.from('products').select('id, name').in('id', productIds);
        if (!cancelled && prods) {
          setProductNames(Object.fromEntries(prods.map((p: { id: string; name: string }) => [p.id, p.name])));
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [shopId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Manual URLs must be full https:// — stricter than the schema's z.url(),
  // so a picked value always round-trips PUT validation.
  const handleManualSubmit = () => {
    let parsed: URL | null = null;
    try {
      parsed = new URL(manualUrl.trim());
    } catch {
      parsed = null;
    }
    if (!parsed || parsed.protocol !== 'https:') {
      setManualError('Enter a full https:// video URL (a direct MP4/WebM link works best).');
      return;
    }
    onSelect({ videoUrl: parsed.toString(), posterUrl: null });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close film picker"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-neutral-950/60 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-[1.5rem] bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Clapperboard size={18} className="text-[#f0a500]" />
            <h3 className="font-serif text-lg font-bold text-gray-900">{heading}</h3>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 transition hover:bg-gray-50 hover:text-gray-700"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 size={20} className="animate-spin text-gray-300" />
            </div>
          ) : ads.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 text-center">
              <Film size={22} className="text-gray-300" />
              <p className="text-sm font-medium text-gray-600">No completed Ad Studio films yet</p>
              <p className="max-w-xs text-xs text-gray-400">
                Render a commercial in the Ad Studio and it appears here — or paste a direct video URL below.
              </p>
            </div>
          ) : (
            <>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Your Ad Studio films
              </p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {ads.map((ad) => {
                  const name = (ad.product_id && productNames[ad.product_id]) || 'Ad Studio commercial';
                  const date = formatAdDate(ad.created_at);
                  return (
                    <button
                      key={ad.id}
                      type="button"
                      onClick={() => onSelect({ videoUrl: ad.video_url, posterUrl: ad.hero_image_url })}
                      className="group text-left"
                    >
                      <div className="relative aspect-video overflow-hidden rounded-xl bg-neutral-100 ring-1 ring-gray-200 transition group-hover:ring-2 group-hover:ring-[#f0a500]">
                        {ad.hero_image_url ? (
                          <SmartImage
                            src={ad.hero_image_url}
                            alt={name}
                            fill
                            sizes="(min-width: 640px) 213px, 45vw"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Film size={20} className="text-gray-300" />
                          </div>
                        )}
                        <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-neutral-950/80 px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest text-white">
                          <Clapperboard size={9} /> Film
                        </span>
                      </div>
                      <p className="mt-2 truncate text-xs font-semibold text-gray-800">{name}</p>
                      {date && <p className="text-[10px] text-gray-400">{date}</p>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="border-t border-gray-100 bg-gray-50/60 px-6 py-4">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            <Link2 size={11} /> Or paste a video URL
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              value={manualUrl}
              onChange={(e) => {
                setManualUrl(e.target.value);
                setManualError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleManualSubmit();
                }
              }}
              placeholder="https://…/your-brand-film.mp4"
              className="min-w-0 flex-1 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
            />
            <button
              type="button"
              onClick={handleManualSubmit}
              disabled={manualUrl.trim().length === 0}
              className="shrink-0 rounded-full bg-gray-900 px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white transition hover:bg-black active:scale-95 disabled:opacity-40"
            >
              Use this film
            </button>
          </div>
          {manualError && <p className="mt-2 text-xs font-medium text-red-600">{manualError}</p>}
        </div>
      </div>
    </div>
  );
}
