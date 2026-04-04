'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Crown, Star, CheckCircle2, BadgeCheck, Loader2, CreditCard } from 'lucide-react';
import { useRouter } from 'next/navigation';

// 🛡️ SHATTER THE CACHE: Ensure the dashboard always reads the live database value
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Shop = {
  id: string;
  shop_name: string;
  subscription_tier: string;
};

export default function SettingsPaywall() {
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const router = useRouter();

  useEffect(() => {
    async function loadShop() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      const { data } = await supabase.from('shops').select('id, shop_name, subscription_tier').eq('id', user.id).single();
      if (data) setShop(data as Shop);
      setLoading(false);
    }
    loadShop();
  }, [router, supabase]);

  // 🚀 THE MONEY PIPE ENGINE
  const handleUpgradeClick = (tier: string) => {
    const adminNumber = '447599710468'; // Chief's Admin Number
    const tierName = tier === 'advanced' ? 'ADVANCED FLAGSHIP (D2,500)' : 'PRO (D1,500)';
    const shopName = shop?.shop_name || 'my boutique';
    
    const message = `👑 *Sanndikaa Upgrade Request*\n\nHello Admin! I am the owner of *${shopName}*. \n\nI would like to upgrade my store to the *${tierName}* tier to unlock premium features.\n\nHow can I send the payment to activate this?`;
    
    const whatsappUrl = `https://wa.me/${adminNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#F9F8F6]"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;

  const isPro = shop?.subscription_tier === 'pro';
  // 🛡️ THE FIX: Check for 'advanced' to perfectly match the Admin Vault vocabulary
  const isAdvanced = shop?.subscription_tier === 'advanced' || shop?.subscription_tier === 'flagship';

  return (
    <div className="min-h-screen bg-[#F9F8F6] font-sans text-gray-900 selection:bg-gray-900 selection:text-white pb-24">
      
      {/* 1. SIMPLE DASHBOARD HEADER */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 px-4 py-4 md:px-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="group flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-gray-900 transition">
            <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" /> Back to Command Center
          </Link>
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Current Plan:</span>
            <span className={`text-[10px] font-black uppercase tracking-widest ${isAdvanced ? 'text-yellow-600' : isPro ? 'text-blue-600' : 'text-gray-900'}`}>
              {shop?.subscription_tier || 'Starter'}
            </span>
          </div>
        </div>
      </header>

      {/* 2. DYNAMIC HEADER TEXT BASED ON TIER */}
      <main className="max-w-6xl mx-auto px-4 py-12 md:px-10">
        <div className="text-center max-w-2xl mx-auto mb-16">
          {isAdvanced ? (
            <>
              <h1 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 flex items-center justify-center gap-3">
                <Crown className="text-yellow-500" size={32} /> Absolute Dominance
              </h1>
              <p className="mt-4 text-sm text-gray-500 leading-relaxed">
                You are on the highest tier: <strong className="text-gray-900">Advanced Flagship</strong>. 
                Your boutique currently enjoys Priority #1 Search Placement, the Gold Crown badge, and unlimited AI capabilities.
              </p>
            </>
          ) : isPro ? (
            <>
              <h1 className="text-3xl md:text-4xl font-serif font-bold text-gray-900">Expand Your Empire</h1>
              <p className="mt-4 text-sm text-gray-500 leading-relaxed">
                You are currently on the <strong className="text-blue-600">Pro</strong> plan. 
                Upgrade to Advanced today to unlock global Priority #1 Search Placement, your own custom domain, and the Flagship Gold Crown.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-3xl md:text-4xl font-serif font-bold text-gray-900">Unlock Your Empire</h1>
              <p className="mt-4 text-sm text-gray-500 leading-relaxed">
                You are currently on the <strong className="text-gray-900 capitalize">Starter</strong> plan. 
                Upgrade today to unlock priority search placement, the WhatsApp Commerce Engine, and the Verified Status badge.
              </p>
            </>
          )}
        </div>

        {/* 3. DYNAMIC PAYWALL GRID */}
        <div className={`grid grid-cols-1 gap-8 mx-auto ${isAdvanced ? 'max-w-md' : 'md:grid-cols-2 max-w-4xl'}`}>
          
          {/* PRO TIER */}
          {!isAdvanced && (
            <div className={`relative flex flex-col rounded-[2rem] bg-white p-8 shadow-sm transition-all border-2 ${isPro ? 'border-blue-500 ring-4 ring-blue-500/10' : 'border-gray-100 hover:border-blue-200'}`}>
              {isPro && (
                <div className="absolute -top-3.5 left-0 right-0 mx-auto w-fit rounded-full bg-blue-500 px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-white flex items-center gap-1 shadow-sm">
                  <CheckCircle2 size={12} /> Active Plan
                </div>
              )}
              
              <div className="flex items-center gap-2 mb-2">
                <BadgeCheck size={24} className="text-blue-500" fill="currentColor" />
                <h2 className="text-2xl font-black uppercase tracking-widest text-gray-900">Pro</h2>
              </div>
              <p className="text-sm font-semibold text-gray-500">The verified growth engine.</p>
              
              <div className="my-6 flex items-baseline gap-x-1">
                <span className="text-4xl font-black tracking-tight text-gray-900">D1,500</span>
                <span className="text-sm font-bold text-gray-400">/month</span>
              </div>

              <ul className="mb-8 space-y-4 text-sm text-gray-600 flex-1">
                <li className="flex items-start gap-3"><CheckCircle2 size={18} className="text-blue-500 shrink-0 mt-0.5" /> <strong className="text-gray-900">Verified Blue Checkmark</strong> on your profile</li>
                <li className="flex items-start gap-3"><CheckCircle2 size={18} className="text-blue-500 shrink-0 mt-0.5" /> Unlimited product listings & inventory</li>
                <li className="flex items-start gap-3"><CheckCircle2 size={18} className="text-blue-500 shrink-0 mt-0.5" /> All 5 Premium Boutique Layouts</li>
                <li className="flex items-start gap-3"><CheckCircle2 size={18} className="text-blue-500 shrink-0 mt-0.5" /> Automated WhatsApp Commerce Engine</li>
                <li className="flex items-start gap-3"><CheckCircle2 size={18} className="text-blue-500 shrink-0 mt-0.5" /> 50 AI-Powered Image Edits per month</li>
              </ul>

              <button 
                onClick={() => handleUpgradeClick('pro')}
                disabled={isPro}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-4 text-xs font-bold uppercase tracking-widest text-white shadow-md transition hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600"
              >
                {isPro ? 'Current Plan' : <><CreditCard size={16} /> Upgrade to Pro</>}
              </button>
            </div>
          )}

          {/* ADVANCED FLAGSHIP TIER */}
          <div className={`relative flex flex-col rounded-[2rem] bg-[#1a1a1a] p-8 shadow-xl transition-all border-2 ${isAdvanced ? 'border-yellow-400 ring-4 ring-yellow-400/20' : 'border-[#2a2a2a] hover:border-yellow-500/50'}`}>
            {isAdvanced && (
              <div className="absolute -top-3.5 left-0 right-0 mx-auto w-fit rounded-full bg-yellow-500 px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-900 flex items-center gap-1 shadow-sm">
                <CheckCircle2 size={12} /> Active Plan
              </div>
            )}

            <div className="flex items-center gap-2 mb-2">
              <Crown size={24} className="text-yellow-500" fill="currentColor" />
              <h2 className="text-2xl font-black uppercase tracking-widest text-white">Advanced</h2>
            </div>
            <p className="text-sm font-semibold text-gray-400">Absolute market dominance.</p>
            
            <div className="my-6 flex items-baseline gap-x-1">
              <span className="text-4xl font-black tracking-tight text-white">D2,500</span>
              <span className="text-sm font-bold text-gray-500">/month</span>
            </div>

            <ul className="mb-8 space-y-4 text-sm text-gray-300 flex-1">
              <li className="flex items-start gap-3"><Star size={18} className="text-yellow-500 shrink-0 mt-0.5" fill="currentColor" /> <strong className="text-white">Priority #1 Search Placement</strong> globally</li>
              <li className="flex items-start gap-3"><Star size={18} className="text-yellow-500 shrink-0 mt-0.5" fill="currentColor" /> <strong className="text-white">Flagship Gold Crown</strong> badge status</li>
              <li className="flex items-start gap-3"><CheckCircle2 size={18} className="text-yellow-500 shrink-0 mt-0.5" /> Your own Custom Domain Name (.com)</li>
              <li className="flex items-start gap-3"><CheckCircle2 size={18} className="text-yellow-500 shrink-0 mt-0.5" /> Escrow Safe-Trade features</li>
              <li className="flex items-start gap-3"><CheckCircle2 size={18} className="text-yellow-500 shrink-0 mt-0.5" /> Unlimited AI Image Edits & Copywriting</li>
            </ul>

            <button 
              onClick={() => handleUpgradeClick('advanced')}
              disabled={isAdvanced}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-yellow-500 py-4 text-xs font-bold uppercase tracking-widest text-gray-900 shadow-lg transition hover:bg-yellow-400 disabled:opacity-50 disabled:hover:bg-yellow-500"
            >
              {isAdvanced ? 'You Own The District' : <><Crown size={16} /> Claim Your Empire</>}
            </button>
          </div>

        </div>
      </main>
    </div>
  );
}