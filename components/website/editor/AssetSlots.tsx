'use client';

import { useRef } from 'react';
import { Image as ImageIcon, Loader2, Sparkles, Trash2, Upload } from 'lucide-react';
import SmartImage from '@/components/SmartImage';
import type { HeroMedia, SiteAssets } from '@/lib/siteTemplates';

// ─────────────────────────────────────────────────────────────────────────────
// AssetSlots — the hero-image and logo slots of the hero/brand section
// inspector. Purely presentational: uploads, generation calls, and Ad Studio
// picking are owned by SiteCopyEditor (one optimistic state machine, one
// save path). Each slot shows honest per-slot progress and exposes three
// sources — Upload / Ad Studio picker (hero only) / Generate with AI — plus
// Clear when an override is set. All controls are ≥44px (Gambia Standard).
// ─────────────────────────────────────────────────────────────────────────────

export type AssetSlotKind = 'hero' | 'logo';

export type AssetBusyState = Partial<Record<AssetSlotKind, string>>;

type AssetSlotsProps = {
  assets: SiteAssets | undefined;
  /** What the hero renders when no override is set (fallback chain). */
  heroFallback: HeroMedia;
  /** shop.logo_url — the logo slot's own fallback before the monogram. */
  shopLogoUrl: string | null;
  busy: AssetBusyState;
  onUpload: (slot: AssetSlotKind, file: File) => void;
  onGenerate: (slot: AssetSlotKind) => void;
  onPickAdStill: () => void;
  onClear: (slot: AssetSlotKind) => void;
};

const BUTTON =
  'flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-gray-200 bg-white px-3.5 text-[10px] font-bold uppercase tracking-widest text-gray-700 transition hover:border-gray-900 active:bg-gray-50 disabled:opacity-40';

function SlotShell({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50/60 p-3.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-gray-400">{note}</p>
      {children}
    </div>
  );
}

export default function AssetSlots({
  assets,
  heroFallback,
  shopLogoUrl,
  busy,
  onUpload,
  onGenerate,
  onPickAdStill,
  onClear,
}: AssetSlotsProps) {
  const heroInputRef = useRef<HTMLInputElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const heroOverride = assets?.hero_image_url ?? null;
  const logoOverride = assets?.logo_url ?? null;
  const heroBusy = busy.hero ?? null;
  const logoBusy = busy.logo ?? null;

  const heroPreview = heroOverride ?? (heroFallback?.type === 'image' ? heroFallback.url : heroFallback?.type === 'video' ? heroFallback.poster : null);
  const logoPreview = logoOverride ?? shopLogoUrl;

  const fileHandler = (slot: AssetSlotKind) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so re-picking the same file fires change again.
    e.target.value = '';
    if (file) onUpload(slot, file);
  };

  return (
    <div className="space-y-3">
      {/* ── Hero image slot ─────────────────────────────────────────────── */}
      <SlotShell
        title="Hero image"
        note={
          heroOverride
            ? 'Your dedicated hero shot — it overrides the automatic media pick.'
            : heroFallback?.type === 'video'
              ? 'Currently showing your Ad Studio film. Set an image to override it.'
              : 'Currently using your best available media. Set a dedicated shot to take control.'
        }
      >
        <div className="mt-3 flex items-start gap-3">
          <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-stone-200 ring-1 ring-gray-200">
            {heroPreview ? (
              <SmartImage src={heroPreview} alt="Hero image" fill sizes="96px" className="object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-stone-200 to-stone-300">
                <ImageIcon size={16} className="text-stone-400" />
              </div>
            )}
            {heroBusy && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                <Loader2 size={16} className="animate-spin text-gray-500" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            {heroBusy ? (
              <p className="text-xs font-medium text-amber-700">{heroBusy}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => heroInputRef.current?.click()} className={BUTTON}>
                  <Upload size={12} /> Upload
                </button>
                <button type="button" onClick={onPickAdStill} className={BUTTON}>
                  <ImageIcon size={12} /> Ad Studio
                </button>
                <button
                  type="button"
                  onClick={() => onGenerate('hero')}
                  className={`${BUTTON} border-transparent bg-gradient-to-r from-[#1a2e1a] to-gray-900 text-white hover:border-transparent hover:opacity-90`}
                >
                  <Sparkles size={12} className="text-[#f0a500]" /> Generate with AI
                </button>
                {heroOverride && (
                  <button type="button" onClick={() => onClear('hero')} className={`${BUTTON} text-red-600`}>
                    <Trash2 size={12} /> Clear
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        <input ref={heroInputRef} type="file" accept="image/*" className="hidden" onChange={fileHandler('hero')} />
      </SlotShell>

      {/* ── Logo slot ───────────────────────────────────────────────────── */}
      <SlotShell
        title="Logo"
        note={
          logoOverride
            ? 'Your site logo — it overrides the boutique logo across this website.'
            : shopLogoUrl
              ? 'Currently using your boutique logo. Set a site logo to override it.'
              : 'No logo yet — your monogram mark is shown. Draft one with AI or upload your own.'
        }
      >
        <div className="mt-3 flex items-start gap-3">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-stone-200 ring-1 ring-gray-200">
            {logoPreview ? (
              <SmartImage src={logoPreview} alt="Logo" fill sizes="56px" className="object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center bg-stone-900 font-serif text-lg font-bold text-white">
                ·
              </div>
            )}
            {logoBusy && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-white/70">
                <Loader2 size={14} className="animate-spin text-gray-500" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            {logoBusy ? (
              <p className="text-xs font-medium text-amber-700">{logoBusy}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => logoInputRef.current?.click()} className={BUTTON}>
                  <Upload size={12} /> Upload
                </button>
                <button
                  type="button"
                  onClick={() => onGenerate('logo')}
                  className={`${BUTTON} border-transparent bg-gradient-to-r from-[#1a2e1a] to-gray-900 text-white hover:border-transparent hover:opacity-90`}
                >
                  <Sparkles size={12} className="text-[#f0a500]" /> Generate with AI
                </button>
                {logoOverride && (
                  <button type="button" onClick={() => onClear('logo')} className={`${BUTTON} text-red-600`}>
                    <Trash2 size={12} /> Clear
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={fileHandler('logo')} />
      </SlotShell>
    </div>
  );
}
