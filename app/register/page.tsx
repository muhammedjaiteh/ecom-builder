'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, ArrowRight } from 'lucide-react';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const router = useRouter();
  const supabase = createClientComponentClient();

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
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white font-sans text-gray-900 selection:bg-gray-900 selection:text-white">
      
      {/* 🚀 LEFT SIDE: THE EDITORIAL RETAIL IMAGE */}
      <div className="relative hidden w-full lg:block lg:w-1/2">
        {/* Stunning boutique interior image */}
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

      {/* 🚀 RIGHT SIDE: THE MINIMALIST FORM */}
      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-20 xl:px-32">
        
        <Link href="/" className="group mb-10 flex w-fit items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 transition hover:text-gray-900">
          <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" /> Back to Directory
        </Link>

        <div className="w-full max-w-md">
          <h2 className="text-3xl font-black tracking-tight text-gray-900">Open a Boutique</h2>
          <p className="mt-2 text-sm text-gray-500">Apply to become a verified seller on Sanndikaa.</p>

          {success ? (
            <div className="mt-10 animate-in fade-in rounded-2xl border border-green-200 bg-green-50 p-6 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-green-900">Application Received</h3>
              <p className="mt-2 text-sm text-green-700">
                Please check your email to verify your account and access your new dashboard.
              </p>
              <button 
                onClick={() => router.push('/login')}
                className="mt-6 w-full rounded-xl bg-green-700 py-3.5 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-green-800"
              >
                Go to Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="mt-10 space-y-6">
              
              {error && (
                <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-xs font-bold text-red-600">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="founder@brand.com"
                    required
                    className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-5 py-4 text-sm font-medium text-gray-900 outline-none transition-all focus:border-gray-900 focus:bg-white focus:ring-1 focus:ring-gray-900"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Create Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    required
                    className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-5 py-4 text-sm font-medium text-gray-900 outline-none transition-all focus:border-gray-900 focus:bg-white focus:ring-1 focus:ring-gray-900"
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
                    className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-5 py-4 text-sm font-medium text-gray-900 outline-none transition-all focus:border-gray-900 focus:bg-white focus:ring-1 focus:ring-gray-900"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a2e1a] py-4 text-xs font-bold uppercase tracking-widest text-white shadow-md transition-all hover:bg-black disabled:opacity-70"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : 'Submit Application'}
                {!loading && <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />}
              </button>
            </form>
          )}

          <p className="mt-10 text-center text-xs font-medium text-gray-500">
            Already have a boutique?{' '}
            <Link href="/login" className="font-bold text-[#1a2e1a] hover:underline">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}