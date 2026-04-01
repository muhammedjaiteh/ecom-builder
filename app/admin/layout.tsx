'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Loader2 } from 'lucide-react';

const ADMIN_EMAIL = 'muhammedjaiteh419@gmail.com';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
  const router = useRouter();

  useEffect(() => {
    async function checkAdminAccess() {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Debug log to see what email we're receiving
      console.log('ADMIN ATTEMPT:', user?.email);
      console.log('Expected admin email:', ADMIN_EMAIL);
      
      // No user logged in
      if (!user) {
        console.log('No user found, redirecting to login');
        router.push('/login');
        return;
      }

      // Bulletproof email check: lowercase and trim whitespace
      const userEmail = user.email?.toLowerCase().trim() || '';
      const adminEmail = ADMIN_EMAIL.toLowerCase().trim();
      
      console.log('Comparing:', { userEmail, adminEmail, match: userEmail === adminEmail });

      // Check if user email matches admin email
      if (userEmail === adminEmail) {
        console.log('Admin access granted!');
        setIsAdmin(true);
        setLoading(false);
      } else {
        // Not admin - redirect to home
        console.log('Not admin, redirecting to home');
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
