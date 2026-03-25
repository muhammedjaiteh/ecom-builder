'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, ArrowRight } from 'lucide-react';

function RegisterForm() {
  const [shopName, setShopName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [pageChecking, setPageChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClientComponentClient();

  const plan = searchParams.get('plan');

  // 🚀 THE BOUNCER: Checks if they are logged in OR if they bypassed Pricing
  useEffect(() => {
    async function enforceFunnel() {
      // 1. If they are already logged in, send them straight to the Dashboard
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/dashboard');
        return;
      }

      // 2. If they are NOT logged in, but they didn't pick a plan, send them to Pricing
      if (!plan) {
        router.push('/pricing');
        return;
      }

      // If they pass both checks, let them see the registration form
      setPageChecking(false);
    }
    
    enforceFunnel();
  }, [plan, router, supabase]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please try again.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      setLoading(false);
      return;
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`,
        data: {
          shop_name: shopName,
          phone_number: phone,
          subscription_tier: plan || 'starter', // Save their plan!
        }
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
    } else {
      // 🚀 THE FUNNEL: Send them straight to the DFY Upsell Page
      router.push('/onboarding/concierge');
    }
  };

  if (pageChecking) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-6 inline-block rounded-full bg-gray-100 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-600">
        Selected Plan: <span className="text-emerald-600">{plan}</span>
      </div>
      <h2 className="text-3xl font-black tracking-tight text-gray-900">Open a Boutique</h2>
      <p className="mt-2 text-sm text-gray-500">Apply to become a verified seller on Sanndikaa.</p>

      <form onSubmit={handleRegister} className="mt-8 space-y-5">
        
        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-xs font-bold text-red-600">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Boutique Name</label>
            <input
              type="text"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder="e.g. Delight Cosmetics"
              required
              className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3.5 text-sm font-medium text-gray-900 outline-none transition-all focus:border-gray-900 focus:bg-white focus:ring-1 focus:ring-gray-900"
            />
          </div>

          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Phone / WhatsApp</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 7000000"
              required
              className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3.5 text-sm font-medium text-gray-900 outline-none transition-all focus:border-gray-900 focus:bg-white focus:ring-1 focus:ring-gray-900"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="founder@brand.com"
            required
            className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3.5 text-sm font-medium text-gray-900 outline-none transition-all focus:border-gray-900 focus:bg-white focus:ring-1 focus:ring-gray-900"
          />
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 6 characters"
              required
              className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3.5 text-sm font-medium text-gray-900 outline-none transition-all focus:border-gray-900 focus:bg-white focus:ring-1 focus:ring-gray-900"
            />
          </div>

          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat password"
              required
              className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3.5 text-sm font-medium text-gray-900 outline-none transition-all focus:border-gray-900 focus:bg-white focus:ring-1 focus:ring-gray-900"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="group mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a2e1a] py-4 text-xs font-bold uppercase tracking-widest text-white shadow-md transition-all hover:bg-black disabled:opacity-70"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : 'Create Account'}
          {!loading && <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />}
        </button>
      </form>

      <p className="mt-8 text-center text-xs font-medium text-gray-500">
        Already have a boutique?{' '}
        <Link href="/login" className="font-bold text-[#1a2e1a] hover:underline">
          Sign in here
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen bg-white font-sans text-gray-900 selection:bg-gray-900 selection:text-white">
      
      {/* LEFT SIDE: THE EDITORIAL RETAIL IMAGE */}
      <div className="relative hidden w-full lg:block lg:w-1/2">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a2e1a]/90 via-[#1a2e1a]/40 to-transparent" />
        
        <div className="absolute bottom-16 left-16 right-16">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.3em] text-emerald-400">Partner Program</p>
          <h1 className="text-4xl font-serif leading-tight text-white xl:text-5xl">
            Claim your space <br /> in the District.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-gray-300">
            Join Gambia's premier digital marketplace. Build your flagship store, upload your inventory, and reach thousands of premium buyers.
          </p>
        </div>
      </div>

      {/* RIGHT SIDE: THE MINIMALIST FORM */}
      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-20 xl:px-32">
        <Link href="/pricing" className="group mb-8 flex w-fit items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 transition hover:text-gray-900">
          <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" /> Back to Pricing
        </Link>

        <Suspense fallback={<div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-400" /></div>}>
          <RegisterForm />
        </Suspense>
      </div>
    </div>
  );
}