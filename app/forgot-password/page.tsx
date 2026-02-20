'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useState } from 'react';
import { Loader2, Mail, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const supabase = createClientComponentClient();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });

    if (error) {
      setMessage('Error: ' + error.message);
    } else {
      setMessage('Success! Check your email for the reset link.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1a2e1a] p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
         <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-green-500/10 rounded-full blur-[100px]"></div>
      </div>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden relative z-10 p-8">
        <Link href="/login" className="flex items-center text-xs font-bold text-gray-400 hover:text-[#1a2e1a] mb-6 transition-colors">
          <ArrowLeft size={14} className="mr-1" /> Back to Login
        </Link>
        
        <div className="text-center mb-8">
           <div className="inline-flex items-center justify-center w-12 h-12 bg-green-50 rounded-full text-green-700 mb-4">
              <Mail size={20} />
           </div>
           <h1 className="text-2xl font-black tracking-tighter text-[#1a2e1a]">Reset Password</h1>
           <p className="text-sm text-gray-500 mt-2">Enter your email and we'll send you a link to reset your password.</p>
        </div>

        <form onSubmit={handleReset} className="space-y-5">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#1a2e1a] outline-none font-medium text-[#1a2e1a]"
              placeholder="seller@example.com"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1a2e1a] hover:bg-green-900 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all"
          >
            {loading ? <Loader2 className="animate-spin" /> : 'Send Reset Link'}
          </button>
          
          {message && (
             <p className={`text-center text-sm font-bold mt-4 ${message.includes('Error') ? 'text-red-500' : 'text-green-600'}`}>
               {message}
             </p>
          )}
        </form>
      </div>
    </div>
  );
}