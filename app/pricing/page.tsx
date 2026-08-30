'use client';

import { Check, Star, Crown, Plus, ArrowLeft, Sparkles, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { CONCIERGE_PRICE, TIER_BY_ID } from '@/lib/tiers';

// ─────────────────────────────────────────────────────────────────────────────
// /pricing — the ONLY public pricing surface. Prices and feature bullets flow
// from lib/tiers TIER_MATRIX (founder matrix 2026-08-29: Starter D100 · Pro
// D250 · Flagship D750). 'advanced' is no longer sold — it appears nowhere
// here; legacy advanced payers keep their capabilities (lib/tiers predicates).
// Every bullet is truthful: it names a shipped, verifiable feature.
// ─────────────────────────────────────────────────────────────────────────────

const starter = TIER_BY_ID.starter;
const pro = TIER_BY_ID.pro;
const flagship = TIER_BY_ID.flagship;

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#F9F8F6] selection:bg-gray-900 selection:text-white pb-24">

      {/* Sleek Minimalist Header */}
      <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-gray-100 bg-white/95 px-4 py-4 backdrop-blur-md md:px-10">
        <Link href="/" className="flex items-center gap-2 text-gray-500 transition hover:text-gray-900">
          <ArrowLeft size={18} />
          <span className="text-xs font-bold uppercase tracking-widest">Back to Directory</span>
        </Link>
        <div className="flex items-center justify-center">
          <img
            src="/logo.png"
            alt="Sanndikaa Logo"
            className="h-14 w-auto flex-shrink-0 object-contain"
          />
        </div>
        <div className="w-[100px]"></div> {/* Spacer for perfect centering */}
      </nav>

      {/* The Pricing Engine */}
      <div className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">

          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-base font-semibold leading-7 text-emerald-600 uppercase tracking-widest">Pricing &amp; Plans</h2>
            <p className="mt-2 text-4xl font-serif font-bold tracking-tight text-gray-900 sm:text-5xl">
              Turn your products into a premium digital empire.
            </p>
            <p className="mx-auto mt-6 max-w-2xl text-center text-lg leading-8 text-gray-600">
              Whether you are launching your first collection or dominating the Gambian market, Sanndikaa gives you the exact weapons you need to attract customers and close sales daily.
            </p>
          </div>

          <div id="plans" className="isolate mx-auto mt-16 grid max-w-md grid-cols-1 gap-y-8 sm:mt-20 lg:mx-0 lg:max-w-none lg:grid-cols-3 lg:gap-x-8 xl:gap-x-12">

            {/* TIER 1: STARTER */}
            <div className="rounded-3xl p-8 ring-1 ring-gray-200 bg-white shadow-sm flex flex-col justify-between transition hover:shadow-md">
              <div>
                <div className="flex items-center justify-between gap-x-4">
                  <h3 className="text-lg font-bold leading-8 text-gray-900 uppercase tracking-widest">{starter.name}</h3>
                </div>
                <p className="mt-4 text-sm font-semibold text-gray-900">{starter.tagline}</p>
                <p className="mt-2 text-sm leading-6 text-gray-500">Perfect for beginners stepping into digital commerce.</p>
                <p className="mt-6 flex items-baseline gap-x-1">
                  <span className="text-4xl font-black tracking-tight text-gray-900">D{starter.monthlyPrice}</span>
                  <span className="text-sm font-semibold leading-6 text-gray-600">/month</span>
                </p>

                <div className="mt-8">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-gray-900 mb-4">Your Sales Weapons:</h4>
                  <ul role="list" className="space-y-3 text-sm leading-6 text-gray-600">
                    {starter.features.map((feature) => (
                      <li key={feature} className="flex gap-x-3"><Check className="h-5 w-5 flex-none text-emerald-600" /> {feature}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <Link href="/register?plan=starter" className="mt-8 flex min-h-[48px] items-center justify-center rounded-full px-3 py-3 text-center text-xs font-bold uppercase tracking-widest text-emerald-700 ring-1 ring-inset ring-emerald-200 hover:ring-emerald-300 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">
                Start Selling
              </Link>
            </div>

            {/* TIER 2: PRO (THE HIGHLIGHT) */}
            <div className="rounded-3xl p-8 ring-2 ring-emerald-600 bg-white shadow-xl flex flex-col justify-between relative transform lg:-translate-y-4">
              <div className="absolute -top-4 left-0 right-0 mx-auto w-fit rounded-full bg-emerald-600 px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-white flex items-center gap-1">
                <Star size={12} /> Most Popular
              </div>
              <div>
                <div className="flex items-center justify-between gap-x-4">
                  <h3 className="text-lg font-bold leading-8 text-emerald-600 uppercase tracking-widest">{pro.name}</h3>
                </div>
                <p className="mt-4 text-sm font-semibold text-gray-900">{pro.tagline}</p>
                <p className="mt-2 text-sm leading-6 text-gray-500">Your own AI-built website, live in minutes.</p>
                <p className="mt-6 flex items-baseline gap-x-1">
                  <span className="text-4xl font-black tracking-tight text-gray-900">D{pro.monthlyPrice}</span>
                  <span className="text-sm font-semibold leading-6 text-gray-600">/month</span>
                </p>

                <div className="mt-8">
                  <div className="flex items-center gap-2 mb-4 text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
                    <Plus size={14} /> Everything in Starter
                  </div>

                  <h4 className="text-xs font-bold uppercase tracking-widest text-gray-900 mb-4">Your Growth Engine:</h4>
                  <ul role="list" className="space-y-3 text-sm leading-6 text-gray-600">
                    {pro.features.filter((f) => f !== 'Everything in Starter').map((feature) => (
                      <li key={feature} className="flex gap-x-3"><Check className="h-5 w-5 flex-none text-emerald-600" /> {feature}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <Link href="/register?plan=pro" className="mt-8 flex min-h-[48px] items-center justify-center rounded-full bg-emerald-600 px-3 py-3 text-center text-xs font-bold uppercase tracking-widest text-white shadow-sm hover:bg-emerald-500 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">
                Unlock More Sales
              </Link>
            </div>

            {/* TIER 3: FLAGSHIP (THE LUXURY ANCHOR) */}
            <div className="rounded-3xl p-8 ring-1 ring-gray-900 bg-[#1A1A1A] shadow-2xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-x-4">
                  <h3 className="text-lg font-bold leading-8 text-white uppercase tracking-widest flex items-center gap-2">
                    {flagship.name} <Crown size={16} className="text-yellow-500" />
                  </h3>
                </div>
                <p className="mt-4 text-sm font-semibold text-white">{flagship.tagline}</p>
                <p className="mt-2 text-sm leading-6 text-gray-400">For serious brands who want maximum exposure.</p>
                <p className="mt-6 flex items-baseline gap-x-1">
                  <span className="text-4xl font-black tracking-tight text-white">D{flagship.monthlyPrice}</span>
                  <span className="text-sm font-semibold leading-6 text-gray-400">/month</span>
                </p>

                <div className="mt-8">
                  <div className="flex items-center gap-2 mb-4 text-[10px] font-bold uppercase tracking-widest text-yellow-500 bg-yellow-500/10 px-3 py-2 rounded-lg border border-yellow-500/20">
                    <Plus size={14} /> Everything in Pro
                  </div>

                  <h4 className="text-xs font-bold uppercase tracking-widest text-gray-300 mb-4">Your Empire Tools:</h4>
                  <ul role="list" className="space-y-3 text-sm leading-6 text-gray-300">
                    {flagship.features.filter((f) => f !== 'Everything in Pro').map((feature) => (
                      <li key={feature} className="flex gap-x-3"><Check className="h-5 w-5 flex-none text-yellow-500" /> {feature}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <Link href="/register?plan=flagship" className="mt-8 flex min-h-[48px] items-center justify-center rounded-full bg-white px-3 py-3 text-center text-xs font-bold uppercase tracking-widest text-gray-900 hover:bg-gray-100 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                Claim Your Empire
              </Link>
            </div>

          </div>

         {/* 🚀 THE "DONE-FOR-YOU" UPSELL SECTION */}
          <div className="mx-auto mt-20 max-w-4xl rounded-[2rem] bg-gradient-to-r from-emerald-900 to-[#1a2e1a] p-8 md:p-10 shadow-xl overflow-hidden relative">
            <div className="absolute top-0 right-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-emerald-500/20 blur-2xl" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={18} className="text-yellow-400" />
                  <span className="text-xs font-bold uppercase tracking-widest text-yellow-400">Available to All Sellers</span>
                </div>
                <h3 className="text-2xl font-serif font-bold text-white mb-2">Sanndikaa Concierge</h3>
                <p className="text-emerald-100 text-sm leading-relaxed max-w-lg">
                  Don&apos;t have the time or tech skills to set up your store? Send us your raw photos on WhatsApp. Our team will enhance your images, write professional descriptions, and build your entire luxury boutique for you in 48 hours.
                </p>
                <div className="mt-6 flex items-center gap-6">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">One-Time Setup Fee</p>
                    <p className="text-2xl font-black text-white">D{CONCIERGE_PRICE}</p>
                  </div>
                  <ul className="hidden sm:block border-l border-emerald-700 pl-6 space-y-1 text-xs text-emerald-200">
                    <li>✓ Available for Starter, Pro &amp; Flagship</li>
                    <li>✓ Store fully built &amp; branded</li>
                    <li>✓ Products uploaded &amp; optimized</li>
                  </ul>
                </div>
              </div>
              <div className="shrink-0">
                {/* The concierge is chosen AFTER signup (onboarding step 3) —
                    this CTA honestly routes back to the plan grid, where the
                    journey actually starts. (The historical dead no-op button
                    is gone.) */}
                <a href="#plans" className="group flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-yellow-400 px-6 py-4 text-xs font-bold uppercase tracking-widest text-emerald-900 shadow-md transition hover:bg-yellow-300">
                  Pick a plan to begin <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                </a>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
