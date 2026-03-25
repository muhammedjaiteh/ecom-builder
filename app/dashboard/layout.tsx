'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Lock, Loader2 } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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

      // Fetch their exact subscription tier from the database
      const { data } = await supabase.from('shops').select('subscription_tier').eq('id', user.id).single();
      
      if (data) {
        setStatus(data.subscription_tier);
      }
      setLoading(false);
    }
    checkGlobalAccess();
  }, [router, supabase, pathname]);

  // 1. Show loader while checking security
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#F9F8F6]"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;
  }

  // 2. THE GLOBAL VAULT DOOR: If they are pending, they cannot see the children (dashboard pages)
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
              href="https://wa.me/447599710468?text=Hello%20Admin!%20I%20need%20to%20pay%20for%20my%20Sanndikaa%20subscription%20to%20unlock%20my%20dashboard." 
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

  // 3. If they are 'starter', 'pro', or 'flagship', let them into the dashboard
  return <>{children}</>;
}