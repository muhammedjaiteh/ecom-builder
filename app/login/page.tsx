'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const router = useRouter();
  const supabase = createClientComponentClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className="flex min-h-screen bg-white font-sans text-gray-900 selection:bg-gray-900 selection:text-white">
      
      {/* 🚀 LEFT SIDE: THE EDITORIAL RETAIL IMAGE (Hidden on small mobile, beautiful on tablet/PC) */}
      <div className="relative hidden w-full lg:block lg:w-1/2">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a2e1a]/90 via-[#1a2e1a]/40 to-transparent" />
        
        <div className="absolute bottom-16 left-16 right-16">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.3em] text-emerald-400">Seller Portal</p>
          <h1 className="text-4xl font-serif leading-tight text-white xl:text-5xl">
            Welcome back to <br /> the District.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-gray-300">
            Access your dashboard, manage your inventory, and connect with your exclusive customer base.
          </p>
        </div>
      </div>

      {/* 🚀 RIGHT SIDE: THE MINIMALIST FORM */}
      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-20 xl:px-32">
        
        <Link href="/" className="group mb-12 flex w-fit items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 transition hover:text-gray-900">
          <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" /> Back to Directory
        </Link>

        <div className="w-full max-w-md">
          <h2 className="text-3xl font-black tracking-tight text-gray-900">Sign In</h2>
          <p className="mt-2 text-sm text-gray-500">Enter your credentials to access your boutique.</p>

          <form onSubmit={handleLogin} className="mt-10 space-y-6">
            
            {error && (
              <div className="rounded-xl bg-red-50 p-4 text-xs font-bold text-red-600 border border-red-100">
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
                  placeholder="seller@boutique.com"
                  required
                  className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-5 py-4 text-sm font-medium text-gray-900 outline-none transition-all focus:border-gray-900 focus:bg-white focus:ring-1 focus:ring-gray-900"
                />
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
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
              {loading ? <Loader2 size={16} className="animate-spin" /> : 'Enter Dashboard'}
              {!loading && <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />}
            </button>
          </form>

          <p className="mt-10 text-center text-xs font-medium text-gray-500">
            Don't have a boutique yet?{' '}
            <Link href="/register" className="font-bold text-[#1a2e1a] hover:underline">
              Apply to open one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}