'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2, Store, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const BRAND_COLOR = '#1a2e1a';
const DEFAULT_THEME_COLOR = 'terracotta';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClientComponentClient();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        const { error: shopError } = await supabase.from('shops').insert({
          id: data.user.id,
          shop_name: shopName,
          shop_slug: shopName.toLowerCase().replace(/ /g, '-') + '-' + Math.floor(Math.random() * 1000),
          whatsapp_number: whatsapp,
          theme_color: DEFAULT_THEME_COLOR,
        });

        if (shopError) {
          console.error('Shop creation failed:', shopError);
        }
      }

      alert('Registration successful! Please login to your dashboard.');
      router.push('/login');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Something went wrong';
      alert('Error: ' + message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ backgroundColor: BRAND_COLOR, transition: 'background-color 0.5s ease' }}
    >
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden relative z-10">
        <div className="bg-[#F9F8F6] p-8 text-center border-b border-gray-100">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-full text-white mb-4 shadow-lg"
            style={{ backgroundColor: BRAND_COLOR }}
          >
            <Store size={20} />
          </div>
          <h1 className="text-2xl font-black tracking-tighter text-[#1a2e1a] mb-1">
            SANNDI<span style={{ color: BRAND_COLOR }}>KAA</span>
          </h1>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Partner Registration</p>
        </div>

        <div className="p-8 pt-6">
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                Shop Name
              </label>
              <input
                type="text"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:bg-white transition-all outline-none font-medium text-[#1a2e1a] text-sm"
                placeholder="e.g. Bintu's Fashion"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                WhatsApp Number
              </label>
              <input
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:bg-white transition-all outline-none font-medium text-[#1a2e1a] text-sm"
                placeholder="e.g. 2207123456"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:bg-white transition-all outline-none font-medium text-[#1a2e1a] text-sm"
                placeholder="seller@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                Create Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:bg-white transition-all outline-none font-medium text-[#1a2e1a] text-sm"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white py-3.5 mt-2 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-500"
              style={{ backgroundColor: BRAND_COLOR }}
            >
              {loading ? <Loader2 className="animate-spin" /> : <>Launch My Shop <ArrowRight size={18} /></>}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-400">
              Already have a shop?{' '}
              <Link href="/login" className="font-bold hover:underline" style={{ color: BRAND_COLOR }}>
                Login here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
