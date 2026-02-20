'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Lock } from 'lucide-react';

export default function UpdatePassword() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClientComponentClient();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) {
      alert('Error updating password: ' + error.message);
      setLoading(false);
    } else {
      alert('Password updated successfully!');
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1a2e1a] p-4 relative overflow-hidden">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 relative z-10 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-green-50 rounded-full text-green-700 mb-4">
           <Lock size={20} />
        </div>
        <h1 className="text-2xl font-black tracking-tighter text-[#1a2e1a] mb-2">Create New Password</h1>
        <p className="text-sm text-gray-500 mb-8">Please enter your new secure password below.</p>

        <form onSubmit={handleUpdate} className="space-y-5">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#1a2e1a] outline-none font-medium text-[#1a2e1a]"
            placeholder="New Password"
            required
            minLength={6}
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1a2e1a] text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" /> : 'Save Password'}
          </button>
        </form>
      </div>
    </div>
  );
}