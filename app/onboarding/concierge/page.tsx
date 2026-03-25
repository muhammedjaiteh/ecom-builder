'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Sparkles, Clock, Image as ImageIcon, PenTool, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function ConciergeIntercept() {
  const [shopName, setShopName] = useState<string>('my boutique');
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    async function loadShop() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      
      const { data } = await supabase.from('shops').select('shop_name').eq('id', user.id).single();
      if (data && data.shop_name) {
        setShopName(data.shop_name);
      }
      setLoading(false);
    }
    loadShop();
  }, [router, supabase]);

  // 🚀 THE UPSLELL WIRE: Sending the D500 lead straight to your phone
  const handleConciergeAccept = () => {
    const adminNumber = '447599710468'; // Chief's Admin Number
    const message = `✨ *Sanndikaa Concierge Request*\n\nHello Admin! I just created my store, *${shopName}*.\n\nI would like to pay the D500 one-time fee to have your expert team build and optimize my luxury boutique for me.\n\nHow do I send the payment and my product photos?`;
    
    const whatsappUrl = `https://wa.me/${adminNumber}?text=${encodeURIComponent(message)}`;
    
    // Open WhatsApp in a new tab, then seamlessly redirect their main tab to the dashboard
    window.open(whatsappUrl, '_blank');
    router.push('/dashboard');
  };

  if (loading) return <div className="min-h-screen bg-[#F9F8F6] flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;

  return (
    <div className="min-h-screen bg-[#F9F8F6] flex items-center justify-center p-4 selection:bg-gray-900 selection:text-white pb-24">
      <div className="max-w-2xl w-full bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-gray-100">
        
        {/* Progress Bar & Header */}
        <div className="bg-gray-50 border-b border-gray-100 p-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="h-2 w-12 rounded-full bg-emerald-500"></div>
            <div className="h-2 w-12 rounded-full bg-emerald-500"></div>
            <div className="h-2 w-12 rounded-full bg-emerald-200"></div>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Step 2 of 3: Store Setup</p>
          <h1 className="mt-4 text-2xl font-serif font-bold text-gray-900 md:text-3xl">
            Your account is active! 🎉
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            You can go to your dashboard now and spend the next few hours building your store... <br className="hidden md:block" />
            <strong className="text-gray-900">OR, you can skip the hard work.</strong>
          </p>
        </div>

        {/* The Pitch */}
        <div className="p-6 md:p-10">
          <div className="rounded-2xl bg-gradient-to-br from-emerald-900 to-[#1a2e1a] p-8 text-white relative overflow-hidden shadow-lg">
            <div className="absolute top-0 right-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-emerald-500/20 blur-2xl" />
            
            <div className="relative z-10 flex items-center gap-2 mb-4">
              <Sparkles size={20} className="text-yellow-400" />
              <h2 className="text-xl font-bold font-serif">Sanndikaa Concierge</h2>
            </div>
            
            <p className="text-sm text-emerald-100 leading-relaxed mb-6">
              For a one-time fee of <strong className="text-white text-lg">D500</strong>, our expert team will build your entire luxury boutique for you in 48 hours. Just send us your raw photos on WhatsApp, and we handle the rest.
            </p>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
                  <ImageIcon size={16} className="text-emerald-300" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Professional Image Editing</h4>
                  <p className="text-xs text-emerald-200 mt-0.5">We remove messy backgrounds and make your products look expensive.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
                  <PenTool size={16} className="text-emerald-300" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Luxury Copywriting</h4>
                  <p className="text-xs text-emerald-200 mt-0.5">We write compelling titles and descriptions that make customers want to buy.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
                  <Clock size={16} className="text-emerald-300" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Ready in 48 Hours</h4>
                  <p className="text-xs text-emerald-200 mt-0.5">Your store will be fully loaded with up to 20 products and ready to launch.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons (The Psychology) */}
          <div className="mt-10 flex flex-col items-center gap-4">
            
            {/* The Big Yes */}
            <button 
              onClick={handleConciergeAccept}
              className="w-full flex items-center justify-center gap-2 rounded-full bg-yellow-400 px-8 py-4 text-sm font-bold uppercase tracking-widest text-emerald-900 shadow-xl transition hover:bg-yellow-300 hover:-translate-y-1"
            >
              <CheckCircle2 size={20} /> Yes, Build My Store For Me (D500)
            </button>
            
            {/* The Small No */}
            <Link href="/dashboard" className="text-[11px] font-bold uppercase tracking-widest text-gray-400 underline-offset-4 hover:text-gray-900 hover:underline transition">
              No thanks, I will build it myself
            </Link>

          </div>
        </div>

      </div>
    </div>
  );
}