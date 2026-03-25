'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Lock, Loader2 } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentLink, setPaymentLink] = useState('https://wa.me/447599710468');
  
  const supabase = createClientComponentClient();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function checkGlobalAccess() {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      // Fetch their exact subscription tier and shop name
      const { data } = await supabase.from('shops').select('shop_name, subscription_tier').eq('id', user.id).single();
      
      if (data) {
        setStatus(data.subscription_tier);

        // 🧠 THE MAGIC: Read their memory and generate the personalized professional invoice
        if (data.subscription_tier === 'pending' || data.subscription_tier === 'suspended') {
          const savedPlan = localStorage.getItem('sanndikaa_plan') || 'starter';
          const savedConcierge = localStorage.getItem('sanndikaa_concierge') || 'no';

          let planPrice = 399;
          let planName = 'Starter';
          if (savedPlan === 'pro') { planPrice = 1500; planName = 'Pro'; }
          if (savedPlan === 'advanced' || savedPlan === 'flagship') { planPrice = 2500; planName = 'Advanced'; }

          let total = planPrice;
          let conciergeText = '';
          if (savedConcierge === 'yes') {
             total += 500;
             conciergeText = `\nI also added the *Done-For-You Setup* (D500).`;
          }

          const shopNameStr = data.shop_name || 'my boutique';
          
          // The Ultimate Professional Invoice Message
          const msg = `✨ *Sanndikaa Store Activation*\n\nHello Admin! I need to complete my payment to unlock the dashboard for *${shopNameStr}*.\n\nI selected the *${planName} Plan* (D${planPrice}).${conciergeText}\n\n*Total Due: D${total}*\n\nHow do I send my payment?`;
          
          setPaymentLink(`https://wa.me/447599710468?text=${encodeURIComponent(msg)}`);
        }
      }
      setLoading(false);
    }
    checkGlobalAccess();
  }, [router, supabase, pathname]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#F9F8F6]"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;
  }

  // 🛑 THE GLOBAL VAULT DOOR
  if (status === 'pending' || status === 'suspended' || status === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F9F8F6] px-4 text-center selection:bg-gray-900 selection:text-white">
        <div className="w-full max-w-md rounded-[2rem] bg-white p-10 shadow-2xl border border-red-100">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
            <Lock size={32} />
          </div>
          <h1 className="mb-2 text-2xl font-black tracking-tight text-gray-900">Account Locked</h1>
          <p className="mb-8 text-sm leading-relaxed text-gray-500">
            Your boutique is currently <strong className="text-gray-900 uppercase">Pending Activation</strong>. 
            To unlock your Command Center and start uploading products, please complete your subscription payment.
          </p>
          
          <div className="space-y-3">
            <a 
              href={paymentLink} 
              target="_blank"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a2e1a] py-4 text-xs font-bold uppercase tracking-widest text-white shadow-md transition hover:bg-black"
            >
              Contact Admin to Pay
            </a>
            
            <button 
              onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }} 
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-50 py-4 text-xs font-bold uppercase tracking-widest text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}