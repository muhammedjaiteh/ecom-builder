'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Package, Plus, LogOut, TrendingUp, DollarSign } from 'lucide-react';
import Link from 'next/link';

export default function Dashboard() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    async function getUserAndProducts() {
      // 1. Get the current User
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }
      setUser(user);

      // 2. Get ONLY this user's products
      // We added .eq('user_id', user.id) to filter the list 🛡️
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user.id) 
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching products:', error);
      } else {
        setProducts(data || []);
      }
      setLoading(false);
    }

    getUserAndProducts();
  }, [router, supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (!error) {
        setProducts(products.filter(p => p.id !== id));
      }
    }
  };

  // Calculate stats for the cards
  const totalProducts = products.length;
  const inventoryValue = products.reduce((acc, curr) => acc + (Number(curr.price) || 0), 0);
  const avgPrice = totalProducts > 0 ? Math.round(inventoryValue / totalProducts) : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-xl font-semibold text-green-800 animate-pulse">Loading Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-green-900 text-white flex-shrink-0 hidden md:block">
        <div className="p-6">
          <h1 className="text-2xl font-black tracking-tighter">GAMBIA<span className="text-green-400">ADMIN</span></h1>
        </div>
        <nav className="mt-6 px-4 space-y-2">
          <a href="#" className="flex items-center gap-3 px-4 py-3 bg-green-800 rounded-xl text-white font-medium shadow-sm transition-all">
            <Package size={20} /> Overview
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-3 text-green-100 hover:bg-green-800 hover:text-white rounded-xl transition-all">
             <TrendingUp size={20} /> Orders
          </a>
          <Link href="/dashboard/add-product" className="flex items-center gap-3 px-4 py-3 text-green-100 hover:bg-green-800 hover:text-white rounded-xl transition-all">
             <Plus size={20} /> Add Product
          </Link>
        </nav>

        <div className="absolute bottom-8 left-0 w-full px-6">
            <button onClick={() => router.push('/')} className="w-full mb-4 flex items-center justify-center gap-2 text-sm text-green-200 hover:text-white transition-colors">
              ← Back to Store
            </button>
            <div className="flex items-center gap-3 p-3 bg-green-800 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-xs font-bold">
                    {user?.email?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{user?.email}</p>
                </div>
                <button onClick={handleSignOut} className="text-red-300 hover:text-red-100">
                    <LogOut size={16} />
                </button>
            </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="flex justify-between items-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800">Overview</h2>
            <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center md:hidden font-bold">
                {user?.email?.charAt(0).toUpperCase()}
            </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                    <Package size={24} />
                </div>
                <div>
                    <p className="text-sm text-gray-500 font-medium">Total Products</p>
                    <p className="text-2xl font-bold text-gray-900">{totalProducts}</p>
                </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="p-3 bg-green-50 text-green-600 rounded-xl">
                    <DollarSign size={24} />
                </div>
                <div>
                    <p className="text-sm text-gray-500 font-medium">Inventory Value</p>
                    <p className="text-2xl font-bold text-gray-900">D{inventoryValue}</p>
                </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                    <TrendingUp size={24} />
                </div>
                <div>
                    <p className="text-sm text-gray-500 font-medium">Avg. Price</p>
                    <p className="text-2xl font-bold text-gray-900">D{avgPrice}</p>
                </div>
            </div>
        </div>

        {/* Inventory List */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-800">Inventory</h3>
                <Link href="/dashboard/add-product" className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold shadow-md shadow-green-200 transition-all flex items-center gap-2">
                    <Plus size={16} /> Add Product
                </Link>
            </div>
            
            <div className="overflow-x-auto">
                {products.length === 0 ? (
                    <div className="p-12 text-center text-gray-400">
                        <Package size={48} className="mx-auto mb-4 opacity-20" />
                        <p>No products yet. Add your first item!</p>
                    </div>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                            <tr>
                                <th className="px-6 py-4">Product</th>
                                <th className="px-6 py-4">Price</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {products.map((product) => (
                                <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
                                                <Package size={20} />
                                            </div>
                                            <span className="font-bold text-gray-800">{product.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">D{product.price}</td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                            ACTIVE
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-3">
                                           {/* Share Button */}
                                            <Link 
                                              href={`/dashboard/share/${product.id}`}
                                              className="text-blue-400 hover:text-blue-600 transition-colors"
                                              title="Share Product"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                                            </Link>
                                            
                                            {/* Delete Button */}
                                            <button 
                                                onClick={() => handleDelete(product.id)}
                                                className="text-red-400 hover:text-red-600 transition-colors"
                                                title="Delete Product"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
      </main>
    </div>
  );
}