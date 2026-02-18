'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2, Lock, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClientComponentClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert('Error: ' + error.message);
      setLoading(false);
    } else {
      router.push('/dashboard');
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1a2e1a] p-4 relative overflow-hidden">
      
      {/* Background Decor (Subtle Glows) */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
         <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-green-500/10 rounded-full blur-[100px]"></div>
         <div className="absolute bottom-[-10%] left-[-10%] w-[300px] h-[300px] bg-yellow-500/10 rounded-full blur-[80px]"></div>
      </div>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden relative z-10">
        
        {/* Header Section */}
        <div className="bg-[#F9F8F6] p-8 text-center border-b border-gray-100">
           <div className="inline-flex items-center justify-center w-12 h-12 bg-[#1a2e1a] rounded-full text-white mb-4 shadow-lg">
              <Lock size={20} />
           </div>
           <h1 className="text-2xl font-black tracking-tighter text-[#1a2e1a] mb-1">
             SANNDI<span className="text-green-700">KAA</span>
           </h1>
           <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Seller Central</p>
        </div>

        {/* Form Section */}
        <div className="p-8 pt-6">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#1a2e1a] focus:bg-white transition-all outline-none font-medium text-[#1a2e1a]"
                placeholder="seller@example.com"
                required
              />
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-2">
                 <label className="block text-xs font-bold uppercase tracking-widest text-gray-500">Password</label>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#1a2e1a] focus:bg-white transition-all outline-none font-medium text-[#1a2e1a]"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1a2e1a] hover:bg-green-900 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
            >
              {loading ? <Loader2 className="animate-spin" /> : <>Enter Dashboard <ArrowRight size={18} /></>}
            </button>
          </form>

          <div className="mt-8 text-center">
             <p className="text-sm text-gray-400">
               New seller? <Link href="/register" className="text-[#1a2e1a] font-bold hover:underline">Create a Shop</Link>
             </p>
          </div>
        </div>
      </div>

      {/* Footer Copyright */}
      <div className="absolute bottom-6 text-white/20 text-[10px] font-bold uppercase tracking-widest">
         &copy; 2026 Sanndikaa Inc.
      </div>

    </div>
  );
}