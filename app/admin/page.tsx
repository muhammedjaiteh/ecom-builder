'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Clock, Crown, Zap, Rocket, Users, TrendingUp, DollarSign, Loader2, RefreshCw } from 'lucide-react';

interface Shop {
  id: string;
  shop_name: string;
  shop_slug: string;
  subscription_tier: string;
  created_at: string;
  email?: string;
  phone_number?: string;
  subscription_expires_at?: string;
  owner_email?: string;
}

export default function AdminDashboard() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  
  const supabase = createClientComponentClient();

  const fetchShops = async () => {
    setLoading(true);
    
    try {
      // Fetch shops from our secure API endpoint
      const response = await fetch('/api/admin/shops');
      
      if (response.ok) {
        const { shops: shopsData } = await response.json();
        setShops(shopsData as Shop[]);
      } else {
        console.error('Failed to fetch shops');
      }
    } catch (error) {
      console.error('Error fetching shops:', error);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchShops();
  }, []);

  const handleUpdateTier = async (shopId: string, newTier: string) => {
    setUpdating(shopId);
    
    try {
      const response = await fetch('/api/admin/update-tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId, newTier }),
      });

      if (response.ok) {
        // Update local state
        setShops(shops.map(shop => 
          shop.id === shopId ? { ...shop, subscription_tier: newTier } : shop
        ));
      } else {
        alert('Failed to update tier');
      }
    } catch (error) {
      console.error('Error updating tier:', error);
      alert('Error updating tier');
    }
    
    setUpdating(null);
  };

  const getStatusBadge = (tier: string) => {
    const badges: Record<string, { icon: any; color: string; bg: string; label: string }> = {
      pending: { icon: Clock, color: 'text-yellow-700', bg: 'bg-yellow-100 border-yellow-200', label: 'Pending' },
      starter: { icon: CheckCircle2, color: 'text-green-700', bg: 'bg-green-100 border-green-200', label: 'Starter' },
      pro: { icon: Crown, color: 'text-purple-700', bg: 'bg-purple-100 border-purple-200', label: 'Pro' },
      advanced: { icon: Rocket, color: 'text-blue-700', bg: 'bg-blue-100 border-blue-200', label: 'Advanced' },
      suspended: { icon: XCircle, color: 'text-red-700', bg: 'bg-red-100 border-red-200', label: 'Suspended' },
    };

    const badge = badges[tier] || badges.pending;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${badge.bg} ${badge.color}`}>
        <Icon size={12} />
        {badge.label}
      </span>
    );
  };

  const stats = {
    total: shops.length,
    pending: shops.filter(s => s.subscription_tier === 'pending').length,
    active: shops.filter(s => ['starter', 'pro', 'advanced'].includes(s.subscription_tier)).length,
    revenue: shops
      .filter(s => ['starter', 'pro', 'advanced'].includes(s.subscription_tier))
      .reduce((sum, s) => {
        const prices: Record<string, number> = { starter: 399, pro: 1500, advanced: 2500 };
        return sum + (prices[s.subscription_tier] || 0);
      }, 0),
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* Stats Cards */}
      <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Total Shops</p>
              <p className="mt-2 text-3xl font-black text-gray-900">{stats.total}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <Users className="h-6 w-6 text-gray-600" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-yellow-700">Pending</p>
              <p className="mt-2 text-3xl font-black text-yellow-900">{stats.pending}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-green-200 bg-green-50 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-green-700">Active</p>
              <p className="mt-2 text-3xl font-black text-green-900">{stats.active}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Monthly Revenue</p>
              <p className="mt-2 text-3xl font-black text-emerald-900">D{stats.revenue}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
              <DollarSign className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Table Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-black text-gray-900">All Sellers</h2>
        <button
          onClick={fetchShops}
          className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Shops Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-gray-600">Shop Name</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-gray-600">Email</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-gray-600">Status</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-gray-600">Joined</th>
                <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shops.map((shop) => (
                <tr key={shop.id} className="transition hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-bold text-gray-900">{shop.shop_name}</p>
                      <p className="text-xs text-gray-500">/{shop.shop_slug}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-700">{shop.owner_email || shop.email || 'N/A'}</p>
                    <p className="text-xs text-gray-500">{shop.phone_number || 'N/A'}</p>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(shop.subscription_tier)}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-700">
                      {new Date(shop.created_at).toLocaleDateString('en-GB', { 
                        day: '2-digit', 
                        month: 'short', 
                        year: 'numeric' 
                      })}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    {shop.subscription_tier === 'pending' ? (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleUpdateTier(shop.id, 'starter')}
                          disabled={updating === shop.id}
                          className="rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700 transition hover:bg-green-100 disabled:opacity-50"
                        >
                          {updating === shop.id ? <Loader2 size={12} className="animate-spin" /> : 'Starter'}
                        </button>
                        <button
                          onClick={() => handleUpdateTier(shop.id, 'pro')}
                          disabled={updating === shop.id}
                          className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-700 transition hover:bg-purple-100 disabled:opacity-50"
                        >
                          {updating === shop.id ? <Loader2 size={12} className="animate-spin" /> : 'Pro'}
                        </button>
                        <button
                          onClick={() => handleUpdateTier(shop.id, 'advanced')}
                          disabled={updating === shop.id}
                          className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
                        >
                          {updating === shop.id ? <Loader2 size={12} className="animate-spin" /> : 'Advanced'}
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleUpdateTier(shop.id, 'suspended')}
                          disabled={updating === shop.id}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                        >
                          {updating === shop.id ? <Loader2 size={12} className="animate-spin" /> : 'Suspend'}
                        </button>
                        <button
                          onClick={() => handleUpdateTier(shop.id, 'pending')}
                          disabled={updating === shop.id}
                          className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-700 transition hover:bg-gray-100 disabled:opacity-50"
                        >
                          {updating === shop.id ? <Loader2 size={12} className="animate-spin" /> : 'Reset'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {shops.length === 0 && (
          <div className="py-16 text-center">
            <Users className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-4 text-sm font-medium text-gray-500">No shops registered yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
