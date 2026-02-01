'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState } from 'react';
import { Package, TrendingUp, DollarSign, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link'; // <--- We need this for navigation

export default function Dashboard() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponentClient();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    setProducts(data || []);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    await supabase.from('products').delete().eq('id', id);
    fetchData();
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-black text-gray-900">Overview</h1>
        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold">
          A
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
            <Package size={24} />
          </div>
          <div>
            <div className="text-gray-500 text-sm font-medium">Total Products</div>
            <div className="text-2xl font-black text-gray-900">{products.length}</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="bg-green-50 p-3 rounded-xl text-green-600">
            <DollarSign size={24} />
          </div>
          <div>
            <div className="text-gray-500 text-sm font-medium">Inventory Value</div>
            <div className="text-2xl font-black text-gray-900">
              D{products.reduce((acc, curr) => acc + curr.price, 0)}
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="bg-purple-50 p-3 rounded-xl text-purple-600">
            <TrendingUp size={24} />
          </div>
          <div>
            <div className="text-gray-500 text-sm font-medium">Avg. Price</div>
            <div className="text-2xl font-black text-gray-900">
              D{products.length > 0 ? Math.round(products.reduce((acc, curr) => acc + curr.price, 0) / products.length) : 0}
            </div>
          </div>
        </div>
      </div>

      {/* Inventory Section */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Inventory</h2>
          
          {/* 👇 THIS IS THE CRITICAL FIX: The Link Wrapper */}
          <Link href="/dashboard/add-product">
            <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-green-200">
              <Plus size={18} /> Add Product
            </button>
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-4 text-sm font-bold text-gray-500">Product</th>
                <th className="p-4 text-sm font-bold text-gray-500">Price</th>
                <th className="p-4 text-sm font-bold text-gray-500">Status</th>
                <th className="p-4 text-sm font-bold text-gray-500 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                         {/* Simple placeholder logic for now */}
                         {product.image_url ? (
                           <img src={product.image_url} className="w-full h-full object-cover" />
                         ) : (
                           <Package size={20} className="text-gray-400" />
                         )}
                      </div>
                      <span className="font-bold text-gray-900">{product.name}</span>
                    </div>
                  </td>
                  <td className="p-4 text-gray-600 font-medium">D{product.price}</td>
                  <td className="p-4">
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold uppercase tracking-wide">
                      Active
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button 
                      onClick={() => handleDelete(product.id)}
                      className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {products.length === 0 && !loading && (
            <div className="p-10 text-center text-gray-400">
              No products yet. Click "Add Product" to create one!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}