'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { CheckCircle, Package, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface Order {
  id: string;
  product_name: string;
  price: number;
  status: 'new' | 'processing' | 'shipped' | 'completed' | 'cancelled';
  fulfillment_method?: 'delivery' | 'pickup';
  created_at: string;
}

const STATUS_CONFIG = {
  new: { label: 'New', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  processing: { label: 'Processing', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  shipped: { label: 'Shipped', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700 border-green-200' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700 border-red-200' },
};

const ALLOWED_STATUSES: Array<keyof typeof STATUS_CONFIG> = ['new', 'processing', 'shipped', 'completed', 'cancelled'];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      setOrders(data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    if (!ALLOWED_STATUSES.includes(newStatus as any)) {
      setError('Invalid status');
      return;
    }

    setUpdatingId(orderId);
    setError(null);

    try {
      // Get the session/token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setError('You must be logged in to update orders');
        return;
      }

      // Call the API to update the status
      const response = await fetch('/api/orders', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          orderId,
          status: newStatus,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to update order status');
        return;
      }

      // Optimistically update the UI
      setOrders(orders.map(order =>
        order.id === orderId ? { ...order, status: newStatus as any } : order
      ));
    } catch (err) {
      console.error('Error updating order status:', err);
      setError('Failed to update order status');
    } finally {
      setUpdatingId(null);
    }
  };

  const StatusBadge = ({ status }: { status: keyof typeof STATUS_CONFIG }) => {
    const config = STATUS_CONFIG[status];
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const StatusSelector = ({ orderId, currentStatus }: { orderId: string; currentStatus: string }) => {
    const isUpdating = updatingId === orderId;

    return (
      <div className="flex items-center gap-2">
        <select
          value={currentStatus}
          onChange={(e) => updateOrderStatus(orderId, e.target.value)}
          disabled={isUpdating}
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed bg-white"
        >
          {ALLOWED_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_CONFIG[status].label}
            </option>
          ))}
        </select>
        {isUpdating && <Loader2 size={16} className="text-green-600 animate-spin" />}
      </div>
    );
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

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Orders Table Card */}
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-green-50/50 border-b border-green-100">
              <tr>
                <th className="p-5 font-bold text-green-900">Product</th>
                <th className="p-5 font-bold text-green-900">Price</th>
                <th className="p-5 font-bold text-green-900">Date</th>
                <th className="p-5 font-bold text-green-900">Fulfillment</th>
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
                  <td className="p-5 text-sm">
                    <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                      {order.fulfillment_method ? (order.fulfillment_method.charAt(0).toUpperCase() + order.fulfillment_method.slice(1)) : 'Not set'}
                    </span>
                  </td>
                  <td className="p-5">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="p-5 text-right">
                    <StatusSelector orderId={order.id} currentStatus={order.status} />
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