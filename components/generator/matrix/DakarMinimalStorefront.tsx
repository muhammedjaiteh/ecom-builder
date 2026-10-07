'use client';

import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import type { StorefrontMerchant, StorefrontProduct } from './BanjulNoirStorefront';

export default function DakarMinimalStorefront({
  merchant,
  products,
}: {
  merchant: StorefrontMerchant;
  products: StorefrontProduct[];
}) {
  const brandTokens = merchant.brandTokens;

  // The brutalist WhatsApp handoff
  const handleInquiry = (productName: string) => {
    const tone = brandTokens?.whatsapp_cta_tone || "I would like to acquire this piece.";
    const message = `${tone}\n\nItem: ${productName}`;
    window.open(`https://wa.me/${merchant.whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-white text-black selection:bg-black selection:text-white pb-32">
      
      {/* HEADER: Stark, stripped-down navigation */}
      <header className="fixed top-0 z-50 flex w-full items-center justify-between bg-white/80 px-6 py-6 backdrop-blur-md md:px-12">
        <div className="font-serif text-sm font-bold uppercase tracking-[0.2em]">
          {merchant.name}
        </div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
          Atelier / Catalog
        </div>
      </header>

      {/* HERO: Editorial text treatment. No massive banner image, just typography. */}
      <section className="flex min-h-[70vh] flex-col items-start justify-end px-6 pb-24 pt-48 md:px-12">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-5xl text-5xl font-medium tracking-tighter md:text-7xl lg:text-[7rem] leading-[0.9]"
        >
          {/* Strict safe-navigation with a fallback to the brand name */}
          {merchant.hero?.title || merchant.name}
        </motion.h1>
        
        {merchant.hero?.subtitle && (
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 1 }}
            className="mt-8 max-w-md text-sm font-medium leading-relaxed text-gray-500 md:text-base md:mt-12"
          >
            {merchant.hero?.subtitle}
          </motion.p>
        )}
      </section>

      {/* THE LOOKBOOK GRID: Asymmetric, staggered layout for physical dominance */}
      <section className="px-6 md:px-12">
        <div className="flex flex-col gap-y-32 md:gap-y-48">
          {products.map((product, index) => {
            // Determine alignment to create the high-fashion staggered effect
            const isEven = index % 2 === 0;
            
            return (
              <motion.div 
                key={product.id}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className={`flex flex-col gap-8 md:flex-row md:items-end ${isEven ? 'md:flex-row' : 'md:flex-row-reverse'}`}
              >
                
                {/* THE ASSET: Massive 3:4 aspect ratio frame */}
                <div className={`relative w-full overflow-hidden bg-gray-50 ${isEven ? 'md:w-7/12 lg:w-8/12' : 'md:w-6/12 lg:w-7/12'}`}>
                  <div className="aspect-[3/4] w-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={product.image}
                      alt={product.name}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-[2s] hover:scale-105"
                    />
                  </div>
                  {!product.inStock && (
                    <div className="absolute left-4 top-4 bg-black px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
                      Archived
                    </div>
                  )}
                </div>

                {/* THE META: Stark typography, strict alignment */}
                <div className={`w-full md:w-5/12 lg:w-4/12 ${isEven ? 'md:pl-12' : 'md:pr-12'}`}>
                  <div className="flex flex-col border-t border-black pt-6">
                    <span className="mb-4 text-[9px] font-bold uppercase tracking-[0.2em] text-gray-400">
                      {product.kicker}
                    </span>
                    
                    <h2 className="text-2xl font-medium tracking-tight md:text-3xl lg:text-4xl">
                      {product.name}
                    </h2>
                    
                    <div className="mt-4 text-sm font-medium tabular-nums">
                      D{product.price.toLocaleString()}
                    </div>

                    <div className="mt-8 space-y-4 text-xs font-medium leading-relaxed text-gray-500">
                      {product.description.map((p, i) => <p key={i}>{p}</p>)}
                    </div>

                    {product.details.length > 0 && (
                      <ul className="mt-8 space-y-2 border-l border-gray-200 pl-4 text-[10px] uppercase tracking-widest text-gray-400">
                        {product.details.map((detail, i) => (
                          <li key={i}>{detail}</li>
                        ))}
                      </ul>
                    )}

                    <button
                      onClick={() => handleInquiry(product.name)}
                      disabled={!product.inStock}
                      className="group mt-12 flex w-full items-center justify-between border-b border-black pb-4 text-xs font-bold uppercase tracking-widest transition-opacity hover:opacity-50 disabled:opacity-20"
                    >
                      <span>{product.inStock ? 'Inquire / Acquire' : 'Out of Season'}</span>
                      <ArrowUpRight size={16} className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>
    </div>
  );
}