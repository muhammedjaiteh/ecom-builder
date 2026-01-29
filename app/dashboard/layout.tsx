'use client';

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
      } else {
        setIsChecking(false);
      }
    };
    checkUser();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (isChecking) {
    return <div className="h-screen flex items-center justify-center text-gray-500">Verifying access...</div>;
  }

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* SIDEBAR: Always visible */}
      <aside className="w-64 bg-white border-r min-h-screen flex flex-col shrink-0">
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold tracking-tight">🛒 Store Admin</h1>
        </div>
        
        <nav className="p-4 space-y-2 flex-1">
          <Link
            href="/dashboard/products"
            className="block px-4 py-2 rounded-md text-gray-700 hover:bg-gray-100 font-medium"
          >
            📦 Inventory
          </Link>
          <Link
            href="/dashboard/orders"
            className="block px-4 py-2 rounded-md text-gray-700 hover:bg-gray-100 font-medium"
          >
            💰 Orders
          </Link>
          <Link
            href="/dashboard/add-product"
            className="block px-4 py-2 rounded-md text-gray-700 hover:bg-gray-100 font-medium"
          >
             ➕ Add Product
          </Link>
        </nav>

        <div className="p-4 border-t bg-gray-50">
           <button 
             onClick={handleLogout}
             className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-100 rounded-md font-bold transition-colors"
           >
             🚪 Sign Out
           </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}