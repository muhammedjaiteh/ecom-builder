'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { CheckCircle, Package, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    setOrders(data || []);
    setLoading(false);
  };

  const markComplete = async (id: string) => {
    await supabase.from('orders').update({ status: 'completed' }).eq('id', id);
    fetchOrders(); // Refresh list
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-gray-900">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
            <Link href="/dashboard" className="p-2 bg-white rounded-full border hover:bg-gray-100 transition-colors">
                <ArrowLeft size={20} className="text-gray-600" />
            </Link>
            <h1 className="text-3xl font-black flex items-center gap-3 text-gray-900">
                <Package className="text-green-600" size={32} /> 
                Customer Orders
            </h1>
        </div>

        {/* Orders Table Card */}
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-green-50/50 border-b border-green-100">
              <tr>
                <th className="p-5 font-bold text-green-900">Product</th>
                <th className="p-5 font-bold text-green-900">Price</th>
                <th className="p-5 font-bold text-green-900">Date</th>
                <th className="p-5 font-bold text-green-900">Status</th>
                <th className="p-5 font-bold text-green-900 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-5 font-bold text-lg">{order.product_name}</td>
                  <td className="p-5 font-medium text-gray-600">D{order.price}</td>
                  <td className="p-5 text-sm text-gray-500">
                    {new Date(order.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-5">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      order.status === 'completed' 
                        ? 'bg-green-100 text-green-700 border border-green-200' 
                        : 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                    }`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="p-5 text-right">
                    {order.status !== 'completed' && (
                      <button 
                        onClick={() => markComplete(order.id)}
                        className="bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-green-700 flex items-center gap-2 ml-auto shadow-green-200 shadow-md transition-all active:scale-95"
                      >
                        <CheckCircle size={16} /> Mark Done
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {orders.length === 0 && !loading && (
              <div className="p-16 text-center text-gray-400 flex flex-col items-center">
                  <Package size={48} className="mb-4 text-gray-200" />
                  <p>No orders yet. Go make a sale! 💸</p>
              </div>
          )}
        </div>
      </div>
    </div>
  );
}