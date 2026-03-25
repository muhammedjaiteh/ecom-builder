'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Sparkles, Clock, Image as ImageIcon, PenTool, Loader2, CreditCard } from 'lucide-react';

function CheckoutEngine() {
  const [shopName, setShopName] = useState<string>('my boutique');
  const [loading, setLoading] = useState(true);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClientComponentClient();

  const shopTier = searchParams.get('plan') || 'starter';

  useEffect(() => {
    async function loadShop() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data } = await supabase.from('shops').select('shop_name').eq('id', user.id).single();
      if (data) setShopName(data.shop_name || 'my boutique');
      setLoading(false);
    }
    loadShop();
  }, [router, supabase]);

  const getPlanPrice = (tier: string) => {
    if (tier === 'pro') return 1500;
    if (tier === 'advanced' || tier === 'flagship') return 2500;
    return 399; 
  };

  const planName = shopTier.charAt(0).toUpperCase() + shopTier.slice(1);
  const planPrice = getPlanPrice(shopTier);
  const conciergePrice = 500;
  const totalWithConcierge = planPrice + conciergePrice;
  const adminNumber = '447599710468';

  const handleFullCheckout = () => {
    // 🧠 BROWSER MEMORY: Remember they wanted the Done-For-You service
    localStorage.setItem('sanndikaa_concierge', 'yes');
    const message = `✨ *Sanndikaa Store Activation & Setup*\n\nHello Admin! I just registered my store, *${shopName}*.\n\nI want to activate the *${planName} Plan* (D${planPrice}) AND I want the *Done-For-You Setup* (D${conciergePrice}).\n\n*Total Due: D${totalWithConcierge}*\n\nHow do I send my payment?`;
    window.open(`https://wa.me/${adminNumber}?text=${encodeURIComponent(message)}`, '_blank');
    router.replace('/dashboard');
  };

  const handleBaseCheckout = () => {
    // 🧠 BROWSER MEMORY: Remember they declined the Done-For-You service
    localStorage.setItem('sanndikaa_concierge', 'no');
    const message = `✨ *Sanndikaa Store Activation*\n\nHello Admin! I just registered my store, *${shopName}*.\n\nI am ready to activate my *${planName} Plan*.\n\n*Total Due: D${planPrice}*\n\nHow do I send my payment?`;
    window.open(`https://wa.me/${adminNumber}?text=${encodeURIComponent(message)}`, '_blank');
    router.replace('/dashboard'); 
  };

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;

  return (
    <div className="max-w-2xl w-full bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-gray-100">
      <div className="bg-gray-50 border-b border-gray-100 p-6 text-center">
        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Step 3 of 3: Activation</p>
        <h1 className="mt-4 text-2xl font-serif font-bold text-gray-900 md:text-3xl">Activate Your Boutique 🎉</h1>
        <p className="mt-2 text-sm text-gray-500">You selected the <strong className="text-gray-900">{planName} Plan (D{planPrice}/mo)</strong>.</p>
      </div>

      <div className="p-6 md:p-10">
        <div className="rounded-2xl bg-gradient-to-br from-emerald-900 to-[#1a2e1a] p-8 text-white relative overflow-hidden shadow-lg border border-emerald-800">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-emerald-500/20 blur-2xl" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2"><Sparkles size={20} className="text-yellow-400" /><h2 className="text-xl font-bold font-serif">Sanndikaa Concierge</h2></div>
              <p className="text-sm text-emerald-100 leading-relaxed max-w-sm">Skip the hard work. For a one-time fee of <strong className="text-white">D500</strong>, our expert team will build your entire luxury store in 48 hours.</p>
            </div>
            <div className="shrink-0 text-left md:text-right border-t border-emerald-800/50 md:border-t-0 md:border-l md:pl-6 pt-4 md:pt-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Total with Concierge</p>
              <p className="text-3xl font-black text-white">D{totalWithConcierge}</p>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center gap-4">
          <button onClick={handleFullCheckout} className="w-full flex items-center justify-center gap-2 rounded-xl bg-yellow-400 px-8 py-4 text-sm font-bold uppercase tracking-widest text-emerald-900 shadow-xl transition hover:bg-yellow-300 hover:-translate-y-1">
            <CheckCircle2 size={18} /> Activate & Build My Store (D{totalWithConcierge})
          </button>
          <div className="w-full flex items-center gap-4 my-2">
            <div className="flex-1 border-t border-gray-100"></div><span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">OR</span><div className="flex-1 border-t border-gray-100"></div>
          </div>
          <button onClick={handleBaseCheckout} className="w-full flex items-center justify-center gap-2 rounded-xl bg-white border border-gray-200 px-8 py-4 text-xs font-bold uppercase tracking-widest text-gray-700 shadow-sm transition hover:bg-gray-50 hover:border-gray-300">
            <CreditCard size={16} className="text-gray-400" /> I will build it myself. Activate {planName} Plan (D{planPrice})
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ConciergePage() {
  return (
    <div className="min-h-screen bg-[#F9F8F6] flex items-center justify-center p-4 selection:bg-gray-900 selection:text-white pb-24">
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div>}>
        <CheckoutEngine />
      </Suspense>
    </div>
  );
}