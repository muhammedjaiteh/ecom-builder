'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Clock, Crown, Rocket, Users, TrendingUp, DollarSign, Loader2, RefreshCw, type LucideIcon } from 'lucide-react';

interface ApiShop {
  id: string;
  shop_name: string; 
  description?: string | null;
  status?: string | null;
  subscription_tier?: string | null;
  created_at: string;
  owner_email?: string | null;
}

interface Shop {
  id: string;
  shop_name: string; 
  description?: string;
  status: string;
  subscription_tier: string;
  created_at: string;
  owner_email?: string;
}

interface Notice {
  type: 'success' | 'error';
  message: string;
}

function mapApiShopToUi(shop: ApiShop): Shop {
  return {
    id: shop.id,
    shop_name: shop.shop_name, 
    description: shop.description || undefined,
    subscription_tier: (shop.subscription_tier || 'pending').toLowerCase(),
    created_at: shop.created_at,
    owner_email: shop.owner_email || undefined,
    status: (shop.status || 'pending').toLowerCase(),
  };
}

function normalizeStatus(status?: string | null) {
  return (status || 'pending').toLowerCase();
}

export default function AdminDashboard() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const showNotice = useCallback((type: Notice['type'], message: string) => {
    setNotice({ type, message });
    window.setTimeout(() => {
      setNotice(null);
    }, 3000);
  }, []);

  const fetchShops = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/admin/shops', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to fetch shops');
      }

      setShops(((data.shops || []) as ApiShop[]).map(mapApiShopToUi));
    } catch (error) {
      console.error('Error fetching shops:', error);
      setShops([]);
      showNotice('error', 'Failed to load shops. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  }, [showNotice]);

  useEffect(() => {
    fetchShops();
  }, [fetchShops]);

  const adminControl = async (
    shopId: string,
    payload: { status: string; subscription_tier?: string }
  ) => {
    setUpdating(shopId);

    try {
      const response = await fetch('/api/admin/shops', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: shopId, ...payload }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to update shop');
      }

      const updatedShopFromDB = data?.shop as ApiShop | undefined;

      if (!updatedShopFromDB) {
        throw new Error('Updated shop was not returned from API');
      }

      setShops((prev) => prev.map((shop) => {
        if (shop.id === shopId) {
          return {
            ...mapApiShopToUi(updatedShopFromDB),
            owner_email: shop.owner_email 
          };
        }
        return shop;
      }));
      
      showNotice('success', 'Shop updated successfully.');
    } catch (error) {
      console.error('Error updating shop:', error);
      showNotice('error', 'Failed to update shop. Please try again.');
    } finally {
      setUpdating(null);
    }
  };

  const getStatusBadge = (tier: string) => {
    const badges: Record<string, { icon: LucideIcon; color: string; bg: string; label: string }> = {
      pending: { icon: Clock, color: 'text-yellow-700', bg: 'bg-yellow-100 border-yellow-200', label: 'Pending' },
      starter: { icon: CheckCircle2, color: 'text-green-700', bg: 'bg-green-100 border-green-200', label: 'Starter' },
      pro: { icon: Crown, color: 'text-purple-700', bg: 'bg-purple-100 border-purple-200', label: 'Pro' },
      advanced: { icon: Rocket, color: 'text-blue-700', bg: 'bg-blue-100 border-blue-200', label: 'Advanced' },
      suspended: { icon: XCircle, color: 'text-red-700', bg: 'bg-red-100 border-red-200', label: 'Suspended' },
      free: { icon: Clock, color: 'text-gray-700', bg: 'bg-gray-100 border-gray-200', label: 'Free' },
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
    pending: shops.filter((s) => s.status === 'pending').length,
    active: shops.filter((s) => s.status === 'active').length,
    revenue: shops
      .filter((s) => s.status === 'active')
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

      {notice && (
        <div
          className={`mb-4 rounded-xl border px-4 py-3 text-sm font-semibold ${
            notice.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {notice.message}
        </div>
      )}

      {/* Shops Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-gray-600">Shop Name</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-gray-600">Email</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-gray-600">Tier</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-gray-600">Joined</th>
                <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shops.map((shop) => {
                const normalizedStatus = normalizeStatus(shop.status);
                const isUpdatingRow = updating === shop.id;

                return (
                  <tr key={shop.id} className="transition hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{shop.shop_name || 'Unnamed Shop'}</div>
                      {shop.description && <div className="text-xs text-gray-500 truncate max-w-[200px]">{shop.description}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-700">{shop.owner_email || 'No email linked'}</p>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(shop.subscription_tier)}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-700">
                        {new Date(shop.created_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      {normalizedStatus === 'pending' || normalizedStatus === 'suspended' ? (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => adminControl(shop.id, { status: 'active', subscription_tier: 'starter' })}
                            disabled={isUpdatingRow}
                            className="rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700 transition hover:bg-green-100 disabled:opacity-50"
                          >
                            {isUpdatingRow ? <Loader2 size={12} className="animate-spin" /> : 'Starter'}
                          </button>
                          <button
                            onClick={() => adminControl(shop.id, { status: 'active', subscription_tier: 'pro' })}
                            disabled={isUpdatingRow}
                            className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-700 transition hover:bg-purple-100 disabled:opacity-50"
                          >
                            {isUpdatingRow ? <Loader2 size={12} className="animate-spin" /> : 'Pro'}
                          </button>
                          <button
                            onClick={() => adminControl(shop.id, { status: 'active', subscription_tier: 'advanced' })}
                            disabled={isUpdatingRow}
                            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
                          >
                            {isUpdatingRow ? <Loader2 size={12} className="animate-spin" /> : 'Advanced'}
                          </button>
                        </div>
                      ) : normalizedStatus === 'active' ? (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => adminControl(shop.id, { status: 'suspended', subscription_tier: 'free' })}
                            disabled={isUpdatingRow}
                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                          >
                            {isUpdatingRow ? <Loader2 size={12} className="animate-spin" /> : 'Suspend'}
                          </button>
                          <button
                            onClick={() => adminControl(shop.id, { status: 'pending' })}
                            disabled={isUpdatingRow}
                            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-700 transition hover:bg-gray-100 disabled:opacity-50"
                          >
                            {isUpdatingRow ? <Loader2 size={12} className="animate-spin" /> : 'Set to Pending'}
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => adminControl(shop.id, { status: 'active', subscription_tier: 'starter' })}
                            disabled={isUpdatingRow}
                            className="rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700 transition hover:bg-green-100 disabled:opacity-50"
                          >
                            {isUpdatingRow ? <Loader2 size={12} className="animate-spin" /> : 'Starter'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
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