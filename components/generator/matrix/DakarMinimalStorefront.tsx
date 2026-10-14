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

  const handleInquiry = (productName: string) => {
    const tone = brandTokens?.whatsapp_cta_tone || "I would like to acquire this piece.";
    const message = `${tone}\n\nItem: ${productName}`;
    window.open(`https://wa.me/${merchant.whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-white text-black selection:bg-black selection:text-white pb-32">
      
      <header className="fixed top-0 z-50 flex w-full items-center justify-between bg-white/80 px-6 py-5 backdrop-blur-md md:px-12">
        <div className="font-serif text-sm font-bold uppercase tracking-[0.2em]">
          {merchant.name}
        </div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
          Catalog
        </div>
      </header>

      <section className="flex flex-col items-start justify-end px-6 pb-20 pt-40 md:min-h-[60vh] md:px-12 md:pb-24 md:pt-48">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-5xl font-serif text-5xl font-medium tracking-tighter md:text-7xl lg:text-[7rem] leading-[0.9]"
        >
          {merchant.hero?.title || merchant.name}
        </motion.h1>
        
        {merchant.hero?.subtitle && (
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 1 }}
            className="mt-6 max-w-md text-sm font-medium leading-relaxed text-gray-500 md:text-base md:mt-12"
          >
            {merchant.hero.subtitle}
          </motion.p>
        )}
      </section>

      {/* Massive gap-y-32 injects the necessary luxury breathing room between products */}
      <section className="md:px-12">
        <div className="flex flex-col gap-y-32 md:gap-y-48">
          {products.map((product, index) => {
            const isEven = index % 2 === 0;
            
            return (
              <motion.div 
                key={product.id}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className={`flex flex-col md:flex-row md:items-center ${isEven ? 'md:flex-row' : 'md:flex-row-reverse'}`}
              >
                
                <div className={`relative w-full overflow-hidden bg-gray-50 ${isEven ? 'md:w-7/12' : 'md:w-6/12'}`}>
                  <div className="aspect-[4/5] w-full md:aspect-[3/4]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={product.image}
                      alt={product.name}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </div>
                  {!product.inStock && (
                    <div className="absolute left-4 top-4 bg-black px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
                      Archived
                    </div>
                  )}
                </div>

                <div className={`w-full px-6 pt-8 md:w-5/12 md:px-0 md:pt-0 ${isEven ? 'md:pl-16' : 'md:pr-16'}`}>
                  <div className="flex flex-col md:border-t md:border-black md:pt-8">
                    
                    <span className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
                      {product.kicker || 'Collection'}
                    </span>
                    
                    <h2 className="font-serif text-3xl font-medium tracking-tight md:text-5xl">
                      {product.name}
                    </h2>
                    
                    <div className="mt-4 text-sm font-medium tabular-nums">
                      D{product.price.toLocaleString()}
                    </div>

                    {/* Strict 2-line clamp to suppress legacy AI slop paragraphs */}
                    {product.description.length > 0 && (
                      <div className="mt-6 line-clamp-2 text-xs font-medium leading-relaxed text-gray-500">
                        {product.description[0]}
                      </div>
                    )}

                    {/* Refined CTA: Minimalist border replaces the heavy black block */}
                    <button
                      onClick={() => handleInquiry(product.name)}
                      disabled={!product.inStock}
                      className="group mt-10 flex w-full items-center justify-between border border-black bg-transparent px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-black transition-colors hover:bg-black hover:text-white disabled:border-gray-200 disabled:text-gray-400"
                    >
                      <span>{product.inStock ? 'Inquire' : 'Archived'}</span>
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