'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useEffect, useState } from 'react';
import { Image as ImageIcon, Loader2, Sparkles, X } from 'lucide-react';
import SmartImage from '@/components/SmartImage';
import BottomSheet from '@/components/website/BottomSheet';
import { useIsMobileViewport } from '@/lib/useIsMobileViewport';

// ─────────────────────────────────────────────────────────────────────────────
// HeroImagePicker — Ad Studio STILL picker for the hero image slot.
// Sibling of VideoHeroPicker with the same data contract: lists the seller's
// video_ads rows that carry a hero still (status preview_ready = still-only
// renders, completed = full commercials — both own a hero_image_url), read
// through the browser client's owner RLS. Law 4 by construction: every
// offered asset is a render the seller already owns.
//
// Viewport-adaptive shell exactly like the film picker: bottom sheet under
// 768px, centered modal at md+.
// ─────────────────────────────────────────────────────────────────────────────

type PickerStill = {
  id: string;
  product_id: string | null;
  hero_image_url: string;
  created_at: string | null;
};

type HeroImagePickerProps = {
  shopId: string;
  onSelect: (url: string) => void;
  onClose: () => void;
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function HeroImagePicker({ shopId, onSelect, onClose }: HeroImagePickerProps) {
  const isMobile = useIsMobileViewport();
  const [stills, setStills] = useState<PickerStill[]>([]);
  const [productNames, setProductNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data, error } = await supabase
        .from('video_ads')
        .select('id, product_id, hero_image_url, created_at')
        .eq('shop_id', shopId)
        .in('status', ['preview_ready', 'completed'])
        .not('hero_image_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(24);
      if (cancelled) return;
      if (error) {
        console.error('[HeroImagePicker] Failed to load Ad Studio stills:', error);
        setLoading(false);
        return;
      }
      const rows = ((data ?? []) as PickerStill[]).filter(
        (r) => typeof r.hero_image_url === 'string' && r.hero_image_url.length > 0
      );
      setStills(rows);

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

  const body = loading ? (
    <div className="flex h-40 items-center justify-center">
      <Loader2 size={20} className="animate-spin text-gray-300" />
    </div>
  ) : stills.length === 0 ? (
    <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 text-center">
      <ImageIcon size={22} className="text-gray-300" />
      <p className="text-sm font-medium text-gray-600">No Ad Studio scenes yet</p>
      <p className="max-w-xs text-xs text-gray-400">
        Compose a scene in the Ad Studio and it appears here — or upload your own hero image.
      </p>
    </div>
  ) : (
    <>
      <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">
        Your Ad Studio scenes
      </p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {stills.map((still) => {
          const name = (still.product_id && productNames[still.product_id]) || 'Ad Studio scene';
          const date = formatDate(still.created_at);
          return (
            <button
              key={still.id}
              type="button"
              onClick={() => onSelect(still.hero_image_url)}
              className="group min-h-[44px] text-left"
            >
              <div className="relative aspect-video overflow-hidden rounded-xl bg-neutral-100 ring-1 ring-gray-200 transition group-hover:ring-2 group-hover:ring-[#f0a500]">
                <SmartImage
                  src={still.hero_image_url}
                  alt={name}
                  fill
                  sizes="(min-width: 640px) 213px, 45vw"
                  className="object-cover"
                />
                <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-neutral-950/80 px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest text-white">
                  <Sparkles size={9} /> Scene
                </span>
              </div>
              <p className="mt-2 truncate text-xs font-semibold text-gray-800">{name}</p>
              {date && <p className="text-[10px] text-gray-400">{date}</p>}
            </button>
          );
        })}
      </div>
    </>
  );

  if (isMobile) {
    return (
      <BottomSheet label="Choose a hero image" onDismiss={onClose}>
        <div className="px-5 pb-4 pt-1">{body}</div>
      </BottomSheet>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close hero image picker"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-neutral-950/60 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose a hero image"
        className="relative flex max-h-[85dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[1.5rem] bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <ImageIcon size={18} className="text-[#f0a500]" />
            <h3 className="font-serif text-lg font-bold text-gray-900">Choose a hero image</h3>
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
        <div className="flex-1 overflow-y-auto px-6 py-5">{body}</div>
      </div>
    </div>
  );
}
