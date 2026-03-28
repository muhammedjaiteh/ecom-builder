'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Loader2 } from 'lucide-react';

const ADMIN_EMAIL = 'Muhammedjaiteh419@Gmail.com';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const supabase = createClientComponentClient();
  const router = useRouter();

  useEffect(() => {
    async function checkAdminAccess() {
      const { data: { user } } = await supabase.auth.getUser();
      
      // No user logged in
      if (!user) {
        router.push('/login');
        return;
      }

      // Check if user email matches admin email
      if (user.email === ADMIN_EMAIL) {
        setIsAdmin(true);
        setLoading(false);
      } else {
        // Not admin - redirect to home
        router.push('/');
      }
    }
    
    checkAdminAccess();
  }, [router, supabase]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F9F8F6]">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F9F8F6]">
      <div className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
              <Shield className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-gray-900">Admin Command Center</h1>
              <p className="text-xs text-gray-500">Secure access granted</p>
            </div>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
