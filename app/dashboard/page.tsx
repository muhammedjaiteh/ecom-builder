'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Package, DollarSign, TrendingUp, Plus, Edit, Trash2, ExternalLink, 
  BarChart3, Eye, Image as ImageIcon, Upload, Store, Truck, LogOut, 
  ShoppingCart, Clock, CheckCircle2, Phone, User, Users, MessageCircle, 
  LayoutDashboard, Settings, LayoutTemplate, Loader2
} from 'lucide-react';
import Link from 'next/link';

type Product = { id: string; image_url: string | null; name: string; price: number; category: string; };
type Shop = { 
  id: string; 
  shop_name: string | null; 
  shop_slug: string | null; 
  banner_url: string | null; 
  logo_url: string | null; 
  bio: string | null; 
  store_layout: string | null; 
  theme_color: string | null; 
  offers_delivery: boolean | null; 
  offers_pickup: boolean | null; 
  pickup_instructions: string | null;
  subscription_tier: string; // 🚀 NEW
  ai_credits: number;        // 🚀 NEW
};
type OrderItem = { quantity: number; variant_details: string; products: { name: string; image_url: string | null }; };
type Order = { id: string; total_amount: number; status: string; fulfillment_method: string; created_at: string; customers: { name: string; phone_number: string; location: string }; order_items: OrderItem[]; };
type CustomerCRM = { phone: string; name: string; location: string; totalSpent: number; orderCount: number; lastOrderDate: string; };

function sanitizePhoneNumber(rawNumber?: string | null) {
  if (!rawNumber) return null;
  let cleanNumber = rawNumber.replace(/\D/g, '');
  if (!cleanNumber) return null;
  if (cleanNumber.length === 7) cleanNumber = `220${cleanNumber}`;
  return cleanNumber;
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [shop, setShop] = useState<Shop | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customersCRM, setCustomersCRM] = useState<CustomerCRM[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'customers' | 'storefront' | 'inventory'>('overview');

  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [bioInput, setBioInput] = useState('');
  const [savingBio, setSavingBio] = useState(false);
  const [storeLayout, setStoreLayout] = useState('bantaba');
  const [themeColor, setThemeColor] = useState('emerald');
  const [offersDelivery, setOffersDelivery] = useState(true);
  const [offersPickup, setOffersPickup] = useState(true);
  const [pickupInstructions, setPickupInstructions] = useState('');
  const [savingDesign, setSavingDesign] = useState(false);

  const [totalOrders, setTotalOrders] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [topProduct, setTopProduct] = useState('None');

  const supabase = createClientComponentClient();
  const router = useRouter();

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };

  const fetchShop = async (id: string) => {
    const { data: shopData } = await supabase.from('shops').select('*').eq('id', id).single();
    const resolvedShop = shopData as Shop | null;
    setShop(resolvedShop);
    setBioInput(resolvedShop?.bio || '');
    setStoreLayout(resolvedShop?.store_layout || 'bantaba');
    setThemeColor(resolvedShop?.theme_color || 'emerald');
    setOffersDelivery(resolvedShop?.offers_delivery ?? true);
    setOffersPickup(resolvedShop?.offers_pickup ?? true);
    setPickupInstructions(resolvedShop?.pickup_instructions || '');
    setBannerUrl(resolvedShop?.banner_url || null);
  };

  useEffect(() => {
    async function loadDashboard() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUserId(user.id);
      await fetchShop(user.id);

      const { data: productData } = await supabase.from('products').select('id, image_url, name, price, category').eq('user_id', user.id).order('created_at', { ascending: false });
      setProducts((productData as Product[]) || []);

      const { data: ordersData } = await supabase.from('orders').select(`id, total_amount, status, fulfillment_method, created_at, customers (name, phone_number, location), order_items (quantity, variant_details, products (name, image_url))`).eq('shop_id', user.id).order('created_at', { ascending: false });

      if (ordersData) {
        const fetchedOrders = ordersData as unknown as Order[];
        setOrders(fetchedOrders);
        setTotalOrders(fetchedOrders.length);
        const revenue = fetchedOrders.reduce((acc, order) => acc + Number(order.total_amount), 0);
        setTotalRevenue(revenue);

        if (fetchedOrders.length > 0) {
          const counts: Record<string, number> = {};
          fetchedOrders.forEach((o) => o.order_items.forEach((i) => { const pName = i.products?.name || 'Unknown Item'; counts[pName] = (counts[pName] || 0) + i.quantity; }));
          setTopProduct(Object.keys(counts).reduce((a, b) => (counts[a] > counts[b] ? a : b), 'None'));
        }

        const crmMap = new Map<string, CustomerCRM>();
        fetchedOrders.forEach((order) => {
          const phone = order.customers.phone_number;
          if (!crmMap.has(phone)) crmMap.set(phone, { phone, name: order.customers.name, location: order.customers.location, totalSpent: 0, orderCount: 0, lastOrderDate: order.created_at });
          const c = crmMap.get(phone)!;
          c.totalSpent += Number(order.total_amount);
          c.orderCount += 1;
          if (new Date(order.created_at) > new Date(c.lastOrderDate)) c.lastOrderDate = order.created_at;
        });
        setCustomersCRM(Array.from(crmMap.values()).sort((a, b) => b.totalSpent - a.totalSpent));
      }
      setLoading(false);
    }
    loadDashboard();
  }, [router, supabase]);

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));
    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    if (error) { alert("Failed to update status."); setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: o.status === 'completed' ? 'pending' : 'completed' } : o))); }
  };

  const handleBannerUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userId) return;
    setUploadingBanner(true);
    const filePath = `${userId}/${Date.now()}.${file.name.split('.').pop()}`;
    const { error: uploadError } = await supabase.storage.from('banners').upload(filePath, file);
    if (uploadError) { alert('Error uploading.'); setUploadingBanner(false); return; }
    const url = supabase.storage.from('banners').getPublicUrl(filePath).data.publicUrl;
    await supabase.from('shops').update({ banner_url: url }).eq('id', userId);
    setShop((prev) => (prev ? { ...prev, banner_url: url } : prev));
    setBannerUrl(url);
    setUploadingBanner(false);
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userId) return;
    setUploadingLogo(true);
    const filePath = `${userId}/${Date.now()}.${file.name.split('.').pop()}`;
    await supabase.storage.from('logos').upload(filePath, file);
    const url = supabase.storage.from('logos').getPublicUrl(filePath).data.publicUrl;
    await supabase.from('shops').update({ logo_url: url }).eq('id', userId);
    setShop((prev) => (prev ? { ...prev, logo_url: url } : prev));
    setUploadingLogo(false);
  };

  const handleSaveBio = async () => {
    if (!userId) return;
    setSavingBio(true);
    const sanitizedBio = bioInput.trim().slice(0, 150);
    await supabase.from('shops').update({ bio: sanitizedBio }).eq('id', userId);
    setShop((prev) => (prev ? { ...prev, bio: sanitizedBio } : prev));
    setBioInput(sanitizedBio);
    setSavingBio(false);
  };

  const handleSaveDesignSettings = async () => {
    if (!userId) return;
    setSavingDesign(true);
    await supabase.from('shops').update({ store_layout: storeLayout, theme_color: themeColor, offers_delivery: offersDelivery, offers_pickup: offersPickup, pickup_instructions: offersPickup ? pickupInstructions.trim() : '' }).eq('id', userId);
    setShop((prev) => prev ? { ...prev, store_layout: storeLayout, theme_color: themeColor, offers_delivery: offersDelivery, offers_pickup: offersPickup } : prev);
    setSavingDesign(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    await supabase.from('products').delete().eq('id', id);
    window.location.reload();
  };

  const layoutOptions = [
    { id: 'serrekunda', name: 'The Serrekunda', desc: 'Dense 2-column minimal catalog.' },
    { id: 'bantaba', name: 'The Bantaba', desc: 'Premium airy cards. Best for boutiques.' },
    { id: 'kairaba', name: 'The Kairaba', desc: 'Horizontal lists. Clean and simple.' },
    { id: 'jollof', name: 'The Jollof', desc: 'Hype/Sneaker staggered layout.' },
    { id: 'senegambia', name: 'The Senegambia', desc: 'Massive full-screen editorial lookbook.' },
  ];

  const colorOptions = [
    { value: 'emerald', bg: 'bg-[#1a2e1a]' }, { value: 'midnight', bg: 'bg-slate-900' },
    { value: 'terracotta', bg: 'bg-orange-700' }, { value: 'ocean', bg: 'bg-blue-600' },
    { value: 'rose', bg: 'bg-rose-500' }, { value: 'champagne', bg: 'bg-[#D7C0AE]' },
    { value: 'sage', bg: 'bg-[#8A9A86]' }, { value: 'onyx', bg: 'bg-[#1A1A1A]' },
    { value: 'crimson', bg: 'bg-[#8B0000]' }
  ];

  if (loading) return <div className="min-h-screen bg-[#F9F8F6] flex justify-center items-center"><Loader2 className="animate-spin text-gray-400" /></div>;

  return (
    <div className="min-h-screen bg-[#F9F8F6] font-sans text-gray-900 selection:bg-gray-900 selection:text-white pb-24">
      
      {/* 1. LUXURY HEADER */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 px-4 py-4 md:px-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-serif font-bold text-gray-900">Command Center</h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-0.5">{shop?.shop_name || 'Boutique Partner'}</p>
          </div>
          
          <div className="flex items-center gap-2 md:gap-3 overflow-x-auto hide-scrollbar pb-1 md:pb-0">
            <Link href={`/shop/${shop?.shop_slug}`} target="_blank" className="flex shrink-0 items-center gap-1.5 rounded-full bg-gray-50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-700 transition hover:bg-gray-100">
              <Eye size={14} /> View Shop
            </Link>
            <Link href="/dashboard/add" className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#1a2e1a] px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white shadow-md transition hover:bg-black">
              <Plus size={14} /> Add Item
            </Link>
            <button onClick={handleLogout} className="flex shrink-0 items-center gap-1.5 rounded-full border border-red-100 bg-red-50 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-red-600 transition hover:bg-red-100">
              <LogOut size={14} />
            </button>
          </div>
        </div>

        {/* 2. THE APP TABS */}
        <div className="max-w-7xl mx-auto mt-6 flex gap-1 overflow-x-auto hide-scrollbar">
          {[
            { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
            { id: 'orders', icon: ShoppingCart, label: `Orders (${orders.filter(o => o.status === 'pending').length})` },
            { id: 'customers', icon: Users, label: 'Customers' },
            { id: 'storefront', icon: LayoutTemplate, label: 'Design Studio' },
            { id: 'inventory', icon: Package, label: 'Inventory' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex shrink-0 items-center gap-2 rounded-full px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest transition-all duration-200 ${
                activeTab === tab.id 
                  ? 'bg-gray-900 text-white shadow-md' 
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <tab.icon size={14} /> {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* 3. DYNAMIC TAB CONTENT */}
      <main className="max-w-7xl mx-auto px-4 py-8 md:px-10">
        
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="animate-in fade-in duration-300">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6 mb-8">
              <div className="rounded-[2rem] bg-[#1a2e1a] p-6 text-white shadow-lg relative overflow-hidden">
                <div className="absolute -mr-4 -mt-4 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
                <div className="relative z-10">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-2 flex items-center gap-1.5"><BarChart3 size={14} /> Total Sales</p>
                  <div className="text-4xl font-serif font-medium">{totalOrders}</div>
                </div>
              </div>

              <div className="rounded-[2rem] bg-white border border-gray-100 p-6 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-1.5"><DollarSign size={14} className="text-green-600" /> Gross Revenue</p>
                <div className="text-3xl font-serif font-medium text-gray-900">D{totalRevenue.toLocaleString()}</div>
              </div>

              <div className="rounded-[2rem] bg-white border border-gray-100 p-6 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-1.5"><TrendingUp size={14} className="text-orange-500" /> Best Seller</p>
                <div className="text-xl font-bold text-gray-900 truncate">{topProduct}</div>
              </div>
            </div>

            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-900 mb-4">Recent Activity</h3>
            <div className="rounded-[2rem] bg-white border border-gray-100 shadow-sm overflow-hidden">
              {orders.slice(0, 3).map((order) => (
                <div key={order.id} className="flex items-center justify-between p-5 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${order.status === 'pending' ? 'bg-orange-50 text-orange-500' : 'bg-green-50 text-green-500'}`}>
                      {order.status === 'pending' ? <Clock size={16} /> : <CheckCircle2 size={16} />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{order.customers.name}</p>
                      <p className="text-xs text-gray-500">D{order.total_amount.toLocaleString()}</p>
                    </div>
                  </div>
                  <button onClick={() => setActiveTab('orders')} className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-900">View</button>
                </div>
              ))}
              {orders.length === 0 && <div className="p-8 text-center text-sm text-gray-400">No recent orders.</div>}
            </div>
          </div>
        )}

        {/* ORDERS TAB */}
        {activeTab === 'orders' && (
          <div className="animate-in fade-in duration-300 space-y-4">
            {orders.length === 0 ? (
              <div className="rounded-[2rem] bg-white border border-dashed border-gray-200 p-12 text-center">
                <ShoppingCart className="mx-auto mb-4 h-10 w-10 text-gray-200" />
                <p className="text-sm font-medium text-gray-500">No orders yet.</p>
              </div>
            ) : (
              orders.map((order) => (
                <div key={order.id} className="rounded-[2rem] bg-white border border-gray-100 p-5 md:p-6 shadow-sm">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest rounded-full ${order.status === 'pending' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                          {order.status}
                        </span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase">#{order.id.split('-')[0]}</span>
                      </div>
                      <h4 className="text-base font-bold text-gray-900 flex items-center gap-1.5"><User size={14} className="text-gray-400" /> {order.customers.name}</h4>
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5"><Phone size={12} /> {order.customers.phone_number}</p>
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5"><Truck size={12} /> {order.fulfillment_method === 'delivery' ? order.customers.location : 'Store Pickup'}</p>
                    </div>

                    <div className="flex-1 md:px-8 border-y md:border-y-0 md:border-l border-gray-50 py-4 md:py-0">
                      {order.order_items.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 mb-3 last:mb-0">
                          <div className="h-12 w-10 rounded-lg bg-gray-50 overflow-hidden"><img src={item.products?.image_url!} className="w-full h-full object-cover" /></div>
                          <div>
                            <p className="text-xs font-bold text-gray-900">{item.quantity}x {item.products?.name}</p>
                            {item.variant_details !== 'None' && <p className="text-[10px] text-gray-400 uppercase tracking-wider">{item.variant_details}</p>}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between md:flex-col md:items-end md:justify-center gap-3">
                      <div className="text-lg font-black text-gray-900">D{order.total_amount.toLocaleString()}</div>
                      {order.status === 'pending' ? (
                        <button onClick={() => handleUpdateOrderStatus(order.id, 'completed')} className="flex items-center gap-1.5 rounded-full bg-gray-900 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white transition hover:bg-black">
                          <CheckCircle2 size={14} /> Mark Paid
                        </button>
                      ) : (
                        <button onClick={() => handleUpdateOrderStatus(order.id, 'pending')} className="flex items-center gap-1.5 rounded-full bg-gray-100 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-600 transition hover:bg-gray-200">
                          Undo
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* CUSTOMERS TAB */}
        {activeTab === 'customers' && (
          <div className="animate-in fade-in duration-300">
            <div className="rounded-[2rem] bg-white border border-gray-100 shadow-sm overflow-hidden">
              {customersCRM.length === 0 ? (
                <div className="p-12 text-center"><Users className="mx-auto mb-4 h-10 w-10 text-gray-200" /><p className="text-sm text-gray-500">No customers yet.</p></div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {customersCRM.map((c, idx) => (
                    <div key={idx} className="flex flex-col md:flex-row md:items-center justify-between p-5 md:p-6 hover:bg-gray-50 transition">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1a2e1a] text-sm font-bold text-white">{c.name.substring(0, 2).toUpperCase()}</div>
                        <div>
                          <h4 className="text-sm font-bold text-gray-900">{c.name}</h4>
                          <p className="text-xs text-gray-500 mt-0.5">{c.phone}</p>
                        </div>
                      </div>
                      <div className="mt-4 md:mt-0 flex items-center justify-between md:gap-8">
                        <div className="text-left md:text-right">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Total Spent</p>
                          <p className="text-lg font-black text-gray-900">D{c.totalSpent.toLocaleString()}</p>
                        </div>
                        <a href={`https://wa.me/${sanitizePhoneNumber(c.phone)}`} target="_blank" className="flex items-center gap-1.5 rounded-full bg-green-50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-green-700 hover:bg-green-100 transition">
                          <MessageCircle size={14} /> Retarget
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* DESIGN STUDIO TAB */}
        {activeTab === 'storefront' && (
          <div className="animate-in fade-in duration-300 space-y-6">
            
            {/* Brand Assets */}
            <div className="rounded-[2rem] bg-white border border-gray-100 p-6 shadow-sm">
              <h3 className="text-lg font-serif font-bold text-gray-900 mb-5">Brand Assets</h3>
              <div className="flex flex-col md:flex-row gap-8">
                <div className="flex items-center gap-4">
                  <div className="h-20 w-20 overflow-hidden rounded-full border-2 border-gray-100 bg-gray-50 shrink-0">
                    {shop?.logo_url ? <img src={shop.logo_url} className="h-full w-full object-cover" /> : <Store className="h-full w-full p-6 text-gray-300" />}
                  </div>
                  <label className="cursor-pointer rounded-full bg-gray-50 px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-600 transition hover:bg-gray-100">
                    {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                    <input type="file" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
                  </label>
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Store Banner</p>
                  <div className="h-24 w-full rounded-2xl bg-gray-50 overflow-hidden relative border border-gray-100">
                    {bannerUrl && <img src={bannerUrl} className="h-full w-full object-cover" />}
                    <label className="absolute inset-0 flex items-center justify-center bg-black/5 cursor-pointer hover:bg-black/10 transition backdrop-blur-sm opacity-0 hover:opacity-100">
                      <span className="rounded-full bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-900">Change Banner</span>
                      <input type="file" className="hidden" onChange={handleBannerUpload} disabled={uploadingBanner} />
                    </label>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Store Bio</p>
                <textarea value={bioInput} onChange={(e) => setBioInput(e.target.value)} rows={2} className="w-full rounded-2xl bg-gray-50 border border-transparent p-4 text-sm outline-none focus:border-gray-200 focus:bg-white transition" placeholder="Tell your customers about your brand..." />
                <button onClick={handleSaveBio} disabled={savingBio} className="mt-3 rounded-full bg-gray-900 px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-white transition hover:bg-black">{savingBio ? 'Saving...' : 'Save Bio'}</button>
              </div>
            </div>

            {/* Layout & Theme */}
            <div className="rounded-[2rem] bg-white border border-gray-100 p-6 shadow-sm">
              <h3 className="text-lg font-serif font-bold text-gray-900 mb-5">Architecture & Color</h3>
              
              <div className="mb-6">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">Store Layout</p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {layoutOptions.map((option) => {
                    const isActive = storeLayout === option.id;
                    const activeClasses = 'border-gray-900 ring-1 ring-gray-900 bg-gray-50/50 shadow-sm';
                    const inactiveClasses = 'border-gray-100 bg-white hover:border-gray-300';
                    
                    return (
                      <button 
                        key={option.id} 
                        onClick={() => setStoreLayout(option.id)} 
                        className={`text-left p-4 rounded-2xl border transition-all duration-200 ${isActive ? activeClasses : inactiveClasses}`}
                      >
                        <p className="font-bold text-sm text-gray-900">{option.name}</p>
                        <p className="text-xs text-gray-500 mt-1">{option.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mb-6">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">Theme Color</p>
                <div className="flex flex-wrap gap-3">
                  {colorOptions.map((color) => {
                    const isActive = themeColor === color.value;
                    const activeClass = 'ring-2 ring-offset-2 ring-gray-900 scale-110 shadow-md';
                    const inactiveClass = 'opacity-80 hover:opacity-100 hover:scale-105';
                    
                    return (
                      <button 
                        key={color.value} 
                        onClick={() => setThemeColor(color.value)} 
                        className={`h-10 w-10 rounded-full transition-all ${color.bg} ${isActive ? activeClass : inactiveClass}`} 
                      />
                    );
                  })}
                </div>
              </div>

              {/* Fulfillment */}
              <div className="mb-6 pt-6 border-t border-gray-50">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">Fulfillment Methods</p>
                <div className="flex bg-gray-50 p-1 rounded-xl w-full max-w-sm">
                  <button onClick={() => { setOffersDelivery(true); setOffersPickup(false); }} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${offersDelivery && !offersPickup ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}>Delivery</button>
                  <button onClick={() => { setOffersDelivery(false); setOffersPickup(true); }} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${!offersDelivery && offersPickup ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}>Pickup</button>
                  <button onClick={() => { setOffersDelivery(true); setOffersPickup(true); }} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${offersDelivery && offersPickup ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}>Both</button>
                </div>
              </div>

              <button onClick={handleSaveDesignSettings} disabled={savingDesign} className="w-full md:w-auto rounded-full bg-gray-900 px-8 py-3.5 text-[11px] font-bold uppercase tracking-widest text-white transition hover:bg-black shadow-md">
                {savingDesign ? 'Applying Changes...' : 'Save Architecture & Settings'}
              </button>
            </div>
          </div>
        )}

        {/* INVENTORY TAB */}
        {activeTab === 'inventory' && (
          <div className="animate-in fade-in duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-gray-900">Active Listings ({products.length})</h3>
              <Link href="/dashboard/add" className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 hover:text-emerald-700">+ Add Product</Link>
            </div>
            
            <div className="rounded-[2rem] bg-white border border-gray-100 shadow-sm overflow-hidden">
              {products.length === 0 ? (
                <div className="p-12 text-center"><Package className="mx-auto mb-4 h-10 w-10 text-gray-200" /><p className="text-sm text-gray-500">Your inventory is empty.</p></div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {products.map((product) => (
                    <div key={product.id} className="flex items-center justify-between p-4 md:p-5 hover:bg-gray-50 transition">
                      <div className="flex items-center gap-4">
                        <div className="h-14 w-12 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                          {product.image_url ? <img src={product.image_url} className="h-full w-full object-cover" /> : <Package className="h-full w-full p-3 text-gray-300" />}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-gray-900">{product.name}</h4>
                          <p className="text-xs text-gray-500 mt-0.5">D{product.price.toLocaleString()} • <span className="uppercase text-[9px] font-bold tracking-widest text-gray-400">{product.category}</span></p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 md:gap-2">
                        <Link href={`/product/${product.id}`} target="_blank" className="p-2 text-gray-400 hover:text-gray-900 rounded-full hover:bg-gray-100 transition"><ExternalLink size={16} /></Link>
                        <Link href={`/dashboard/edit/${product.id}`} className="p-2 text-gray-400 hover:text-blue-600 rounded-full hover:bg-blue-50 transition"><Edit size={16} /></Link>
                        <button onClick={() => handleDelete(product.id)} className="p-2 text-gray-400 hover:text-red-600 rounded-full hover:bg-red-50 transition"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}