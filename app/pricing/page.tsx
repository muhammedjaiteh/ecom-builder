'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Sparkles, Bot, Zap, ArrowRight, ShieldCheck } from 'lucide-react';

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(false);

  // 🚀 YOUR SANNDIKAA ADMIN WHATSAPP NUMBER (Replace with your real number)
  // Format: Country code + phone number (No spaces, no '+' sign. e.g., "2201234567")
  const ADMIN_WHATSAPP_NUMBER = "447599711110468"; // Replace with your actual WhatsApp number

  // 🚀 The WhatsApp Concierge Logic
  const handleUpgradeClick = (tierName: string, priceMonthly: number, priceAnnual: number) => {
    // If they click Standard, just send them back to the dashboard
    if (tierName === 'Standard') {
      window.location.href = '/dashboard';
      return;
    }

    // Determine the price and billing cycle for the message
    const price = isAnnual ? priceAnnual : priceMonthly;
    const period = isAnnual ? 'year' : 'month';

    // Craft the perfectly formatted WhatsApp message
    const message = `Hello Sanndikaa VIP Concierge! 🦅\n\nI want to upgrade my boutique to the *${tierName}* plan for D${price}/${period}.\n\nPlease let me know how to proceed with my payment via Mobile Money!`;
    
    // Open WhatsApp in a new tab
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=${encodedMessage}`, '_blank');
  };

  // Pricing Data Strategy
  const tiers = [
    {
      name: 'Standard',
      tagline: 'Launch your digital storefront in 60 seconds.',
      priceMonthly: 0,
      priceAnnual: 0,
      buttonText: 'Current Plan',
      buttonVariant: 'outline',
      features: [
        'Up to 20 Products',
        'The Serrekunda Layout (2-Column)',
        'Standard WhatsApp Checkout',
        'Manual Product Uploads',
      ],
      aiFeatures: [
        '3 Free AI Writer Credits (Trial)'
      ]
    },
    {
      name: 'District PRO',
      tagline: 'Sell smarter with AI copy and premium layouts.',
      priceMonthly: 750,
      priceAnnual: 9000, 
      badge: 'Most Popular',
      buttonText: 'Upgrade to PRO',
      buttonVariant: 'primary',
      features: [
        'Everything in Standard, plus:',
        'Unlimited Products',
        'Unlock Layouts: Bantaba & Kairaba',
        'Custom Domain Support',
      ],
      aiFeatures: [
        'Unlimited AI Product Descriptions',
        'AI Image Enhancer (Studio Quality)',
        'AI Social Media Caption Generator',
        'AI Smart CRM (WhatsApp Retargeting)'
      ]
    },
    {
      name: 'District FLAGSHIP',
      tagline: 'Run your business on autopilot with a 24/7 AI Sales Agent.',
      priceMonthly: 2000,
      priceAnnual: 24000, 
      badge: 'VIP Only',
      buttonText: 'Claim Flagship',
      buttonVariant: 'dark',
      features: [
        'Everything in PRO, plus:',
        'Verified Seller Blue Tick',
        'Unlock Layouts: Jollof & Senegambia',
        'District Spotlight (Global Homepage Priority)',
      ],
      aiFeatures: [
        'Autonomous WhatsApp Sales Bot 🤖',
        'AI Trend & Competitor Intelligence',
        'Advanced Revenue Analytics'
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-[#F9F8F6] font-sans text-gray-900 selection:bg-gray-900 selection:text-white pb-24">
      
      {/* 🚀 HEADER & NAVIGATION */}
      <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur-md px-4 py-4 md:px-10">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-500 transition hover:text-gray-900">
            <ArrowLeft size={16} /> Back to Dashboard
          </Link>
          <div className="text-xl font-black tracking-tighter text-[#1a2e1a]">SANNDIKAA</div>
          <div className="w-24 hidden md:block" />
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-12 md:py-20 md:px-10">
        
        {/* 🚀 PAGE TITLE & TOGGLE */}
        <div className="text-center max-w-2xl mx-auto mb-16 animate-in slide-in-from-bottom-4 duration-500">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-gray-900 mb-4">
            Scale your boutique with <span className="text-emerald-600">District AI</span>.
          </h1>
          <p className="text-gray-500 text-sm md:text-base leading-relaxed mb-8">
            Upgrade your architecture. Automate your sales. Dominate the marketplace.
          </p>

          <div className="inline-flex items-center rounded-full bg-white p-1 border border-gray-200 shadow-sm">
            <button 
              onClick={() => setIsAnnual(false)} 
              className={`rounded-full px-6 py-2.5 text-xs font-bold uppercase tracking-widest transition-all duration-300 ${!isAnnual ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:text-gray-900'}`}
            >
              Pay Monthly
            </button>
            <button 
              onClick={() => setIsAnnual(true)} 
              className={`rounded-full px-6 py-2.5 text-xs font-bold uppercase tracking-widest transition-all duration-300 flex items-center gap-2 ${isAnnual ? 'bg-[#1a2e1a] text-white shadow-md' : 'text-gray-500 hover:text-gray-900'}`}
            >
              Pay Annually <span className={`${isAnnual ? 'bg-emerald-500 text-white' : 'bg-green-100 text-green-700'} rounded-full px-2 py-0.5 text-[9px]`}>Save 20%</span>
            </button>
          </div>
        </div>

        {/* 🚀 PRICING CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          {tiers.map((tier, index) => {
            const isPro = tier.name === 'District PRO';
            const isFlagship = tier.name === 'District FLAGSHIP';
            
            return (
              <div 
                key={tier.name} 
                className={`relative rounded-[2.5rem] p-8 transition-all duration-500 animate-in slide-in-from-bottom-8 ${
                  isFlagship 
                    ? 'bg-[#1a2e1a] text-white shadow-2xl md:-mt-4' 
                    : isPro 
                      ? 'bg-white border-2 border-emerald-500 shadow-xl relative z-10' 
                      : 'bg-white border border-gray-100 shadow-sm mt-4'
                }`}
                style={{ animationDelay: `${index * 150}ms`, animationFillMode: 'both' }}
              >
                {/* Badges */}
                {tier.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className={`rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-widest shadow-md ${
                      isFlagship ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-gray-900' : 'bg-emerald-500 text-white'
                    }`}>
                      {tier.badge}
                    </span>
                  </div>
                )}

                {/* Header */}
                <div className="mb-8">
                  <h3 className={`text-xl font-black tracking-tight mb-2 ${isFlagship ? 'text-white' : 'text-gray-900'}`}>{tier.name}</h3>
                  <p className={`text-xs leading-relaxed ${isFlagship ? 'text-gray-300' : 'text-gray-500'}`}>{tier.tagline}</p>
                </div>

                {/* Price */}
                <div className="mb-8 flex items-baseline gap-2">
                  <span className={`text-5xl font-serif font-medium ${isFlagship ? 'text-white' : 'text-gray-900'}`}>
                    D{isAnnual && tier.priceAnnual > 0 ? (tier.priceAnnual / 12).toFixed(0) : tier.priceMonthly}
                  </span>
                  <span className={`text-xs font-bold uppercase tracking-widest ${isFlagship ? 'text-gray-400' : 'text-gray-400'}`}>
                    / month
                  </span>
                </div>
                {isAnnual && tier.priceAnnual > 0 && (
                  <p className={`-mt-6 mb-8 text-xs font-bold ${isFlagship ? 'text-emerald-400' : 'text-emerald-600'}`}>
                    Billed D{tier.priceAnnual.toLocaleString()} annually
                  </p>
                )}

                {/* 🚀 CTA BUTTON - WIRED UP TO WHATSAPP */}
                <button 
                  onClick={() => handleUpgradeClick(tier.name, tier.priceMonthly, tier.priceAnnual)}
                  className={`w-full group flex items-center justify-center gap-2 rounded-2xl py-4 text-xs font-bold uppercase tracking-widest transition-all duration-300 mb-10 ${
                  tier.buttonVariant === 'primary' 
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md' 
                    : tier.buttonVariant === 'dark'
                      ? 'bg-white text-[#1a2e1a] hover:bg-gray-100 shadow-md'
                      : 'bg-gray-50 text-gray-900 hover:bg-gray-100 border border-gray-200'
                }`}>
                  {tier.buttonText}
                  {tier.buttonVariant !== 'outline' && <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />}
                </button>

                {/* Core Features */}
                <div className="space-y-6">
                  <div>
                    <p className={`mb-4 text-[10px] font-bold uppercase tracking-widest ${isFlagship ? 'text-gray-400' : 'text-gray-400'}`}>Platform Features</p>
                    <ul className="space-y-3">
                      {tier.features.map((feature, i) => (
                        <li key={i} className={`flex items-start gap-3 text-sm ${isFlagship ? 'text-gray-200' : 'text-gray-600'}`}>
                          <CheckCircle2 size={18} className={`shrink-0 ${isFlagship ? 'text-emerald-400' : 'text-emerald-500'}`} />
                          <span className={feature.includes('Everything in') ? 'font-bold' : ''}>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className={`pt-6 border-t ${isFlagship ? 'border-gray-700' : 'border-gray-100'}`}>
                    <p className={`mb-4 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${isFlagship ? 'text-yellow-400' : 'text-purple-600'}`}>
                      <Sparkles size={14} /> District AI Suite
                    </p>
                    <ul className="space-y-3">
                      {tier.aiFeatures.map((feature, i) => (
                        <li key={i} className={`flex items-start gap-3 text-sm font-medium ${isFlagship ? 'text-white' : 'text-gray-900'}`}>
                          {feature.includes('Bot') ? (
                            <Bot size={18} className="shrink-0 text-yellow-400" />
                          ) : feature.includes('Trial') ? (
                            <Zap size={18} className="shrink-0 text-gray-400" />
                          ) : (
                            <Sparkles size={18} className={`shrink-0 ${isFlagship ? 'text-emerald-400' : 'text-purple-500'}`} />
                          )}
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

              </div>
            );
          })}
        </div>

        {/* Trust Banner */}
        <div className="mt-20 flex flex-col items-center justify-center text-center">
          <ShieldCheck size={32} className="text-gray-300 mb-4" />
          <h4 className="text-lg font-bold text-gray-900">Secure & Transparent</h4>
          <p className="text-sm text-gray-500 mt-2 max-w-md">You can upgrade, downgrade, or cancel your subscription at any time. Your boutique data is always safe.</p>
        </div>

      </main>
    </div>
  );
}