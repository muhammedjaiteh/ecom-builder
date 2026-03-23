'use client';

import { Check, Star, Crown, Zap } from 'lucide-react';
import Link from 'next/link';

export default function PricingTable() {
  return (
    <div className="bg-[#F9F8F6] py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-base font-semibold leading-7 text-emerald-600 uppercase tracking-widest">Pricing & Plans</h2>
          <p className="mt-2 text-4xl font-serif font-bold tracking-tight text-gray-900 sm:text-5xl">
            Choose the perfect tier for your boutique.
          </p>
          <p className="mx-auto mt-6 max-w-2xl text-center text-lg leading-8 text-gray-600">
            Whether you are a street vendor upgrading to digital, or an established empire, Sanndikaa provides the exact tools you need to dominate the Gambian market.
          </p>
        </div>

        <div className="isolate mx-auto mt-16 grid max-w-md grid-cols-1 gap-y-8 sm:mt-20 lg:mx-0 lg:max-w-none lg:grid-cols-3 lg:gap-x-8 xl:gap-x-12">
          
          {/* TIER 1: STARTER */}
          <div className="rounded-3xl p-8 ring-1 ring-gray-200 bg-white shadow-sm flex flex-col justify-between transition hover:shadow-md">
            <div>
              <div className="flex items-center justify-between gap-x-4">
                <h3 className="text-lg font-bold leading-8 text-gray-900 uppercase tracking-widest">Starter</h3>
              </div>
              <p className="mt-4 text-sm leading-6 text-gray-600">The gateway to digital commerce. Perfect for new sellers.</p>
              <p className="mt-6 flex items-baseline gap-x-1">
                <span className="text-4xl font-black tracking-tight text-gray-900">D399</span>
                <span className="text-sm font-semibold leading-6 text-gray-600">/month</span>
              </p>
              <ul role="list" className="mt-8 space-y-3 text-sm leading-6 text-gray-600">
                <li className="flex gap-x-3"><Check className="h-6 w-5 flex-none text-emerald-600" /> Up to 10 Products</li>
                <li className="flex gap-x-3"><Check className="h-6 w-5 flex-none text-emerald-600" /> Sanndikaa Subdomain</li>
                <li className="flex gap-x-3"><Check className="h-6 w-5 flex-none text-emerald-600" /> Basic WhatsApp Link</li>
                <li className="flex gap-x-3"><Check className="h-6 w-5 flex-none text-emerald-600" /> 3 AI Photo Edits/mo</li>
              </ul>
            </div>
            <Link href="/register?plan=starter" className="mt-8 block rounded-full px-3 py-3 text-center text-xs font-bold uppercase tracking-widest text-emerald-700 ring-1 ring-inset ring-emerald-200 hover:ring-emerald-300 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">
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
                <h3 className="text-lg font-bold leading-8 text-emerald-600 uppercase tracking-widest">Pro</h3>
              </div>
              <p className="mt-4 text-sm leading-6 text-gray-600">The growth engine. For serious businesses ready to scale.</p>
              <p className="mt-6 flex items-baseline gap-x-1">
                <span className="text-4xl font-black tracking-tight text-gray-900">D1,500</span>
                <span className="text-sm font-semibold leading-6 text-gray-600">/month</span>
              </p>
              <ul role="list" className="mt-8 space-y-3 text-sm leading-6 text-gray-600">
                <li className="flex gap-x-3"><Check className="h-6 w-5 flex-none text-emerald-600" /> <strong>Unlimited Products</strong></li>
                <li className="flex gap-x-3"><Check className="h-6 w-5 flex-none text-emerald-600" /> "Verified Seller" Badge</li>
                <li className="flex gap-x-3"><Check className="h-6 w-5 flex-none text-emerald-600" /> Auto WhatsApp Catalog</li>
                <li className="flex gap-x-3"><Check className="h-6 w-5 flex-none text-emerald-600" /> 50 AI Photo Edits/mo</li>
                <li className="flex gap-x-3"><Check className="h-6 w-5 flex-none text-emerald-600" /> 10 AI Ad Copy Scripts/mo</li>
              </ul>
            </div>
            <Link href="/register?plan=pro" className="mt-8 block rounded-full bg-emerald-600 px-3 py-3 text-center text-xs font-bold uppercase tracking-widest text-white shadow-sm hover:bg-emerald-500 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">
              Upgrade to Pro
            </Link>
          </div>

          {/* TIER 3: ADVANCED (THE LUXURY ANCHOR) */}
          <div className="rounded-3xl p-8 ring-1 ring-gray-900 bg-[#1A1A1A] shadow-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-x-4">
                <h3 className="text-lg font-bold leading-8 text-white uppercase tracking-widest flex items-center gap-2">
                  Advanced <Crown size={16} className="text-yellow-500" />
                </h3>
              </div>
              <p className="mt-4 text-sm leading-6 text-gray-400">The full business OS. Absolute dominance and extreme visibility.</p>
              <p className="mt-6 flex items-baseline gap-x-1">
                <span className="text-4xl font-black tracking-tight text-white">D2,500</span>
                <span className="text-sm font-semibold leading-6 text-gray-400">/month</span>
              </p>
              <ul role="list" className="mt-8 space-y-3 text-sm leading-6 text-gray-300">
                <li className="flex gap-x-3"><Check className="h-6 w-5 flex-none text-yellow-500" /> <strong>Custom Domain (.com)</strong></li>
                <li className="flex gap-x-3"><Check className="h-6 w-5 flex-none text-yellow-500" /> Top-of-Search Priority</li>
                <li className="flex gap-x-3"><Check className="h-6 w-5 flex-none text-yellow-500" /> Escrow Safe-Trade Included</li>
                <li className="flex gap-x-3"><Check className="h-6 w-5 flex-none text-yellow-500" /> <strong>Unlimited</strong> AI Photo Edits</li>
                <li className="flex gap-x-3"><Check className="h-6 w-5 flex-none text-yellow-500" /> <strong>Unlimited</strong> AI Ad Copies</li>
              </ul>
            </div>
            <Link href="/register?plan=advanced" className="mt-8 block rounded-full bg-white px-3 py-3 text-center text-xs font-bold uppercase tracking-widest text-gray-900 hover:bg-gray-100 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              Claim Your Empire
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}