'use client';

import { motion } from 'framer-motion';
import { Check, Palette } from 'lucide-react';
import { SITE_TEMPLATES, type SiteConcept, type TemplateKey } from '@/lib/siteTemplates';

// Per-template art direction so the two concept cards read like pitches from
// two different agencies — each mini-hero mirrors its template's real look.
const TEMPLATE_STYLES: Record<TemplateKey, {
  hero: string;
  heroLabel: string;
  headline: string;
  sub: string;
  badge: string;
}> = {
  editorial: {
    hero: 'bg-[#141414] text-white',
    heroLabel: 'text-emerald-300',
    headline: 'font-serif text-2xl font-bold leading-tight',
    sub: 'text-white/60',
    badge: 'bg-[#141414] text-white',
  },
  ritual: {
    hero: 'bg-[#faf4ec] text-[#3c2f28]',
    heroLabel: 'text-[#b08d6a]',
    headline: 'font-serif text-2xl font-medium italic leading-tight',
    sub: 'text-[#3c2f28]/70',
    badge: 'bg-[#b08d6a] text-white',
  },
  vitality: {
    hero: 'bg-[#10151b] text-white',
    heroLabel: 'text-[#f0a500]',
    headline: 'text-2xl font-black uppercase tracking-tight leading-tight',
    sub: 'text-white/60',
    badge: 'bg-[#f0a500] text-black',
  },
};

type ConceptCardProps = {
  concept: SiteConcept;
  index: number;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

export default function ConceptCard({ concept, index, selected, disabled, onSelect }: ConceptCardProps) {
  const meta = SITE_TEMPLATES[concept.template_key];
  const styles = TEMPLATE_STYLES[concept.template_key];

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      initial={{ opacity: 0, y: -10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut', delay: index * 0.08 }}
      className={`relative flex h-full flex-col overflow-hidden rounded-[2rem] border bg-white text-left shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
        selected
          ? 'border-[#f0a500] ring-2 ring-[#f0a500] ring-offset-2 ring-offset-[#F9F8F6]'
          : 'border-gray-100 hover:-translate-y-0.5 hover:shadow-lg'
      }`}
    >
      {/* Selection indicator */}
      <span
        className={`absolute right-4 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-full transition-all ${
          selected ? 'bg-[#f0a500] text-black' : 'bg-white/80 text-transparent ring-1 ring-gray-200'
        }`}
      >
        <Check size={14} strokeWidth={3} />
      </span>

      {/* Mini hero sample, art-directed per template */}
      <div className={`px-7 pb-8 pt-10 ${styles.hero}`}>
        <p className={`text-[10px] font-bold uppercase tracking-widest ${styles.heroLabel}`}>{concept.tagline}</p>
        <h3 className={`mt-3 ${styles.headline}`}>{concept.hero_headline}</h3>
        <p className={`mt-3 text-sm leading-relaxed ${styles.sub}`}>{concept.hero_subheadline}</p>
      </div>

      {/* Concept brief */}
      <div className="flex flex-1 flex-col gap-4 p-7">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${styles.badge}`}>
            {meta.name} Template
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{meta.niche}</span>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Concept</p>
          <p className="mt-1 font-serif text-xl font-bold text-gray-900">{concept.concept_name}</p>
        </div>
        <p className="text-sm leading-relaxed text-gray-600">{concept.vibe}</p>
        <div className="mt-auto flex items-start gap-2 rounded-xl bg-gray-50 p-3">
          <Palette size={14} className="mt-0.5 shrink-0 text-gray-400" />
          <p className="text-xs font-medium leading-relaxed text-gray-500">{concept.palette}</p>
        </div>
      </div>
    </motion.button>
  );
}
