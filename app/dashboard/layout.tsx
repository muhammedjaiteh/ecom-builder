'use client';

import { LayoutGrid, ShoppingBag, ShoppingCart, Settings, LogOut, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClientComponentClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const menuItems = [
    { name: 'Overview', icon: LayoutGrid, href: '/dashboard' },
    { name: 'Orders', icon: ShoppingCart, href: '/dashboard/orders' },
    { name: 'Add Product', icon: ShoppingBag, href: '/dashboard/add-product' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-green-900 text-white fixed h-full hidden md:flex flex-col">
        <div className="p-8">
          <h1 className="text-2xl font-black tracking-tight">GAMBIA<span className="text-green-400">ADMIN</span></h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive 
                    ? 'bg-green-800 text-white font-bold shadow-lg shadow-green-900/50' 
                    : 'text-green-100 hover:bg-green-800/50 hover:text-white'
                }`}
              >
                <item.icon size={20} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 space-y-2">
          <Link href="/" className="flex items-center gap-3 px-4 py-3 text-green-200 hover:text-white transition-colors">
             <ArrowLeft size={20} /> Back to Store
          </Link>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-300 hover:bg-red-900/20 hover:text-red-200 rounded-xl transition-colors text-left"
          >
            <LogOut size={20} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 md:ml-64">
        {children}
      </main>
    </div>
  );
}