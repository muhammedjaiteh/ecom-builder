'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Store, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const router = useRouter();
  const supabase = createClientComponentClient();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // 1. Create the User Account
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          shop_name: shopName, // Save their shop name!
        },
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

  if (success) {
    return (
      <div className="min-h-screen bg-green-900 flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full animate-in zoom-in duration-300">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={32} />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">Welcome to Sanndikaa! 🇬🇲</h2>
          <p className="text-gray-600 mb-6">
            We have sent a confirmation link to <strong>{email}</strong>. <br/>
            Please check your email to activate your shop.
          </p>
          <Link href="/login" className="text-green-600 font-bold hover:underline">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      
      {/* Left Side: The Sales Pitch */}
      <div className="hidden lg:flex w-1/2 bg-green-900 text-white p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
        
        <div className="z-10">
          <div className="flex items-center gap-2 text-green-300 font-bold tracking-widest mb-2">
            <Store size={20} /> GAMBIA STORE PARTNERS
          </div>
          <h1 className="text-5xl font-black leading-tight mb-6">
            Sell to thousands of Gambians online.
          </h1>
          <p className="text-green-100 text-lg max-w-md leading-relaxed">
            Join the fastest growing marketplace in The Gambia. Accept Wave, QMoney, and Cash. Manage inventory effortlessly.
          </p>
        </div>

        <div className="z-10 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-green-800 rounded-full flex items-center justify-center">
              <span className="font-bold">1</span>
            </div>
            <span>Create your free account</span>
          </div>
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 bg-green-800 rounded-full flex items-center justify-center">
              <span className="font-bold">2</span>
            </div>
            <span>Upload your products</span>
          </div>
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 bg-green-800 rounded-full flex items-center justify-center">
              <span className="font-bold">3</span>
            </div>
            <span>Start getting paid</span>
          </div>
        </div>
      </div>

      {/* Right Side: The Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="max-w-md w-full">
          <div className="text-center lg:text-left mb-8">
            <h2 className="text-3xl font-black text-gray-900 mb-2">Create your Shop 🚀</h2>
            <p className="text-gray-500">Enter your details to get started.</p>
          </div>

          <form onSubmit={handleSignUp} className="space-y-5">
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Shop Name</label>
              <input 
                type="text" 
                required
                placeholder="e.g. Fatou's Fashion"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                className="w-full p-4 rounded-xl bg-gray-100 border-transparent focus:bg-white focus:ring-2 focus:ring-green-500 transition-all outline-none font-medium"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Email Address</label>
              <input 
                type="email" 
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-4 rounded-xl bg-gray-100 border-transparent focus:bg-white focus:ring-2 focus:ring-green-500 transition-all outline-none font-medium"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Password</label>
              <input 
                type="password" 
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-4 rounded-xl bg-gray-100 border-transparent focus:bg-white focus:ring-2 focus:ring-green-500 transition-all outline-none font-medium"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg font-medium">
                ⚠️ {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-green-900 hover:bg-green-800 text-white font-bold py-4 rounded-xl shadow-lg shadow-green-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" /> : <>Create Account <ArrowRight size={20} /></>}
            </button>

          </form>

          <div className="mt-8 text-center">
            <p className="text-gray-500">
              Already have a shop?{' '}
              <Link href="/login" className="font-bold text-green-700 hover:underline">
                Log in here
              </Link>
            </p>
          </div>

        </div>
      </div>

    </div>
  );
}