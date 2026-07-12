'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import type { SiteConcept } from '@/lib/siteTemplates';
import MiniSitePreview from './MiniSitePreview';

// Visual concept selection (founder mandate): each card IS the website — a
// live, true-to-structure miniature of the real template component wearing
// the concept's AI copy. Card text is limited to the concept name and a
// single tagline chip; everything else is shown, not described.

type ConceptCardProps = {
  concept: SiteConcept;
  index: number;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  shopName?: string | null;
};

export default function ConceptCard({ concept, index, selected, disabled, onSelect, shopName }: ConceptCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={disabled ? undefined : { y: -5 }}
      transition={{ duration: 0.3, ease: 'easeOut', delay: index * 0.08 }}
      className={`relative flex h-full flex-col overflow-hidden rounded-[2rem] border bg-white text-left shadow-sm transition-shadow ${
        selected
          ? 'border-[#f0a500] shadow-lg ring-2 ring-[#f0a500] ring-offset-2 ring-offset-[#F9F8F6]'
          : 'border-gray-100 hover:shadow-xl'
      } ${disabled ? 'opacity-60' : ''}`}
    >
      {/* Full-card select affordance. An overlay button (rather than wrapping
          the card in one) keeps the miniature's anchors out of the button
          subtree — valid HTML, one clean focus target. */}
      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        aria-pressed={selected}
        aria-label={`Choose the ${concept.concept_name} concept`}
        className="absolute inset-0 z-20 cursor-pointer rounded-[2rem] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f0a500] focus-visible:ring-offset-2 disabled:cursor-not-allowed"
      />

      {/* Browser chrome — frames the miniature as a real page */}
      <div className="flex items-center gap-1.5 border-b border-gray-100 bg-gray-50 px-4 py-2.5">
        <span className="h-2 w-2 rounded-full bg-gray-300" />
        <span className="h-2 w-2 rounded-full bg-gray-300" />
        <span className="h-2 w-2 rounded-full bg-gray-300" />
        <span className="ml-3 h-4 flex-1 rounded-full bg-white ring-1 ring-gray-200" />
      </div>

      {/* Live miniature of the actual template component */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-white">
        <MiniSitePreview concept={concept} shopName={shopName} />
        {/* Selection indicator */}
        <span
          className={`absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full shadow-md transition-all ${
            selected ? 'bg-[#f0a500] text-black' : 'bg-white/90 text-transparent ring-1 ring-gray-200 backdrop-blur'
          }`}
        >
          <Check size={15} strokeWidth={3} />
        </span>
      </div>

      {/* Identity bar — concept name + tagline chip, nothing more */}
      <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-5 py-4">
        <p className="truncate font-serif text-lg font-bold text-gray-900">{concept.concept_name}</p>
        <span className="max-w-[55%] truncate rounded-full bg-gray-50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-500 ring-1 ring-gray-200">
          {concept.tagline}
        </span>
      </div>
    </motion.div>
  );
}
