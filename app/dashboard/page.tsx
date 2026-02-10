'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Package, Plus, LogOut, TrendingUp, DollarSign, ExternalLink, Trash2, Share2, Settings } from 'lucide-react';
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

  // Calculate stats
  const totalProducts = products.length;
  const inventoryValue = products.reduce((acc, curr) => acc + (Number(curr.price) || 0), 0);
  const avgPrice = totalProducts > 0 ? Math.round(inventoryValue / totalProducts) : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9F8F6]">
        <p className="text-xl font-serif text-[#2C3E2C] animate-pulse">Loading Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F9F8F6] font-sans text-[#2C3E2C]">
      
      {/* Sidebar */}
      <aside className="w-64 bg-[#2C3E2C] text-white flex-shrink-0 hidden md:block relative">
        <div className="p-8">
          <h1 className="text-2xl font-black tracking-tighter flex items-center gap-2">
            <span className="w-8 h-8 bg-white text-[#2C3E2C] rounded-full flex items-center justify-center text-xs font-serif">S</span>
            SANNDI<span className="text-green-400">KAA</span>
          </h1>
        </div>
        
        <nav className="mt-6 px-4 space-y-2">
          {/* Overview Tab */}
          <a href="#" className="flex items-center gap-3 px-4 py-3 bg-white/10 rounded-xl text-white font-medium shadow-sm transition-all">
            <Package size={20} /> Overview
          </a>

          {/* 📊 ANALYTICS TAB (Fixed Link) */}
          <Link href="/dashboard/analytics" className="flex items-center gap-3 px-4 py-3 text-green-100 hover:bg-white/5 rounded-xl transition-all">
             <TrendingUp size={20} /> Analytics
          </Link>

          {/* Add Product Tab */}
          <Link href="/dashboard/add-product" className="flex items-center gap-3 px-4 py-3 text-green-100 hover:bg-white/5 rounded-xl transition-all">
             <Plus size={20} /> Add Product
          </Link>
          
          {/* Settings Tab */}
          <Link href="/dashboard/settings" className="flex items-center gap-3 px-4 py-3 text-green-100 hover:bg-white/5 rounded-xl transition-all">
             <Settings size={20} /> Settings
          </Link>
        </nav>

        <div className="absolute bottom-8 left-0 w-full px-6">
            <button onClick={() => router.push('/')} className="w-full mb-4 flex items-center justify-center gap-2 text-sm text-green-200 hover:text-white transition-colors">
              ← Back to Store
            </button>
            <div className="flex items-center gap-3 p-3 bg-black/20 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-xs font-bold text-white">
                    {user?.email?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate opacity-80">{user?.email}</p>
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
            <h2 className="text-3xl font-serif font-bold text-[#2C3E2C]">Dashboard</h2>
            <div className="md:hidden w-10 h-10 rounded-full bg-[#2C3E2C] text-white flex items-center justify-center font-bold">
                {user?.email?.charAt(0).toUpperCase()}
            </div>
        </div>

        {/* Stats & Shop Card */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
            
            {/* 🪪 Shop Identity Card */}
            <div className="md:col-span-1 bg-[#2C3E2C] text-[#F9F8F6] p-6 rounded-2xl shadow-lg flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                
                <div>
                    <h3 className="text-xs font-bold tracking-widest uppercase opacity-70 mb-1">My Storefront</h3>
                    <p className="text-xl font-serif truncate">{user?.email?.split('@')[0]} Store</p>
                </div>
                
                <div className="mt-4">
                    <Link 
                      href={`/shop/${user?.email?.split('@')[0]}`} // Fallback link
                      className="flex items-center justify-between bg-white/10 hover:bg-white/20 px-4 py-3 rounded-xl transition-all cursor-pointer backdrop-blur-sm"
                    >
                        <span className="text-sm font-bold">Visit Shop</span>
                        <ExternalLink size={16} />
                    </Link>
                </div>
            </div>

            {/* Inventory Stats */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E6E4DC] flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-2 text-[#5F6F5F]">
                    <Package size={18} /> <span className="text-xs font-bold uppercase tracking-wider">Products</span>
                </div>
                <p className="text-3xl font-serif text-[#2C3E2C]">{totalProducts}</p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E6E4DC] flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-2 text-[#5F6F5F]">
                    <DollarSign size={18} /> <span className="text-xs font-bold uppercase tracking-wider">Value</span>
                </div>
                <p className="text-3xl font-serif text-[#2C3E2C]">D{inventoryValue}</p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E6E4DC] flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-2 text-[#5F6F5F]">
                    <TrendingUp size={18} /> <span className="text-xs font-bold uppercase tracking-wider">Avg. Price</span>
                </div>
                <p className="text-3xl font-serif text-[#2C3E2C]">D{avgPrice}</p>
            </div>
        </div>

        {/* Inventory List */}
        <div className="bg-white rounded-3xl shadow-sm border border-[#E6E4DC] overflow-hidden">
            <div className="p-6 border-b border-[#E6E4DC] flex justify-between items-center">
                <h3 className="text-xl font-bold">Inventory</h3>
                <Link href="/dashboard/add-product" className="px-4 py-2 bg-[#2C3E2C] hover:bg-black text-white rounded-lg text-sm font-bold shadow-md transition-all flex items-center gap-2">
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
                        <thead className="bg-[#F9F8F6] text-gray-500 text-xs uppercase font-semibold">
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
                                        <div className="flex items-center gap-4">
                                            {/* 📸 IMAGE THUMBNAIL */}
                                            <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 overflow-hidden relative border border-gray-200">
                                                {product.image_url ? (
                                                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <Package size={20} />
                                                )}
                                            </div>
                                            <span className="font-bold text-gray-800">{product.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600 font-medium">D{product.price}</td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800">
                                            ACTIVE
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-3">
                                            {/* View Public Page */}
                                            <Link 
                                              href={`/product/${product.id}`}
                                              className="p-2 text-gray-400 hover:text-green-700 hover:bg-green-50 rounded-full transition-all"
                                              title="View on Store"
                                              target="_blank"
                                            >
                                                <ExternalLink size={18} />
                                            </Link>

                                            {/* Share Button */}
                                            <Link 
                                              href={`/dashboard/share/${product.id}`}
                                              className="p-2 text-blue-400 hover:text-blue-700 hover:bg-blue-50 rounded-full transition-all"
                                              title="Create Ad"
                                            >
                                                <Share2 size={18} />
                                            </Link>
                                            
                                            {/* Delete Button */}
                                            <button 
                                                onClick={() => handleDelete(product.id)}
                                                className="p-2 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-full transition-all"
                                                title="Delete Product"
                                            >
                                                <Trash2 size={18} />
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