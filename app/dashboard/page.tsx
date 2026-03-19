'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Package,
  DollarSign,
  TrendingUp,
  Plus,
  Edit,
  Trash2,
  ExternalLink,
  BarChart3,
  Eye,
  Image as ImageIcon,
  Upload,
  Store,
  Truck,
  LogOut,
  ShoppingCart,
  Clock,
  CheckCircle2,
  Phone,
  User,
  Users,
  MessageCircle
} from 'lucide-react';
import Link from 'next/link';

type Product = {
  id: string;
  image_url: string | null;
  name: string;
  price: number;
  category: string;
};

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
};

type OrderItem = {
  quantity: number;
  variant_details: string;
  products: { name: string; image_url: string | null };
};

type Order = {
  id: string;
  total_amount: number;
  status: string;
  fulfillment_method: string;
  created_at: string;
  customers: { name: string; phone_number: string; location: string };
  order_items: OrderItem[];
};

// UPGRADE 1: The CRM Customer Type
type CustomerCRM = {
  phone: string;
  name: string;
  location: string;
  totalSpent: number;
  orderCount: number;
  lastOrderDate: string;
};

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
  
  // UPGRADE 2: CRM State
  const [customersCRM, setCustomersCRM] = useState<CustomerCRM[]>([]);

  const [userId, setUserId] = useState<string | null>(null);
  
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const fetchShop = async (id: string) => {
    const { data: shopData } = await supabase
      .from('shops')
      .select('id, shop_name, shop_slug, banner_url, logo_url, bio, store_layout, theme_color, offers_delivery, offers_pickup, pickup_instructions')
      .eq('id', id)
      .single();

    const resolvedShop = shopData as Shop | null;
    setShop(resolvedShop);
    setBioInput(resolvedShop?.bio || '');
    setStoreLayout(resolvedShop?.store_layout || 'bantaba');
    setThemeColor(resolvedShop?.theme_color || 'emerald');
    setOffersDelivery(resolvedShop?.offers_delivery ?? true);
    setOffersPickup(resolvedShop?.offers_pickup ?? true);
    setPickupInstructions(resolvedShop?.pickup_instructions || '');
  };

  useEffect(() => {
    async function loadDashboard() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUserId(user.id);

      await fetchShop(user.id);

      const { data: productData } = await supabase
        .from('products')
        .select('id, image_url, name, price, category')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setProducts((productData as Product[]) || []);

      const { data: ordersData } = await supabase
        .from('orders')
        .select(`
          id, total_amount, status, fulfillment_method, created_at,
          customers (name, phone_number, location),
          order_items (quantity, variant_details, products (name, image_url))
        `)
        .eq('shop_id', user.id)
        .order('created_at', { ascending: false });

      if (ordersData) {
        const fetchedOrders = ordersData as unknown as Order[];
        setOrders(fetchedOrders);
        setTotalOrders(fetchedOrders.length);
        
        const revenue = fetchedOrders.reduce((acc, order) => acc + Number(order.total_amount), 0);
        setTotalRevenue(revenue);

        if (fetchedOrders.length > 0) {
          const counts: Record<string, number> = {};
          fetchedOrders.forEach((order) => {
            order.order_items.forEach((item) => {
              const pName = item.products?.name || 'Unknown Item';
              counts[pName] = (counts[pName] || 0) + item.quantity;
            });
          });
          const top = Object.keys(counts).reduce((a, b) => (counts[a] > counts[b] ? a : b), 'None');
          setTopProduct(top);
        }

        // UPGRADE 3: The CRM Intelligence Engine (Grouping Customers)
        const crmMap = new Map<string, CustomerCRM>();
        fetchedOrders.forEach((order) => {
          const phone = order.customers.phone_number;
          if (!crmMap.has(phone)) {
            crmMap.set(phone, {
              phone: phone,
              name: order.customers.name,
              location: order.customers.location,
              totalSpent: 0,
              orderCount: 0,
              lastOrderDate: order.created_at,
            });
          }
          const c = crmMap.get(phone)!;
          c.totalSpent += Number(order.total_amount);
          c.orderCount += 1;
          if (new Date(order.created_at) > new Date(c.lastOrderDate)) {
            c.lastOrderDate = order.created_at; // Update to most recent order date
          }
        });
        
        // Sort by total spent (Best customers at the top)
        const sortedCRM = Array.from(crmMap.values()).sort((a, b) => b.totalSpent - a.totalSpent);
        setCustomersCRM(sortedCRM);
      }

      setLoading(false);
    }

    loadDashboard();
  }, [router, supabase]);

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));
    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    if (error) {
      alert("Failed to update order status.");
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: o.status === 'completed' ? 'pending' : 'completed' } : o)));
    }
  };

  const handleBannerUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userId) return;
    setUploadingBanner(true);
    const fileExt = file.name.split('.').pop();
    const filePath = `${userId}/${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from('banners').upload(filePath, file, { upsert: false });
    if (uploadError) { alert('Error uploading banner. Please try again.'); setUploadingBanner(false); return; }
    const { data: publicUrlData } = supabase.storage.from('banners').getPublicUrl(filePath);
    const uploadedBannerUrl = publicUrlData.publicUrl;
    const { error: updateError } = await supabase.from('shops').update({ banner_url: uploadedBannerUrl }).eq('id', userId);
    if (updateError) { alert('Banner uploaded but failed to save.'); setUploadingBanner(false); return; }
    setShop((prev) => (prev ? { ...prev, banner_url: uploadedBannerUrl } : prev));
    setBannerUrl(uploadedBannerUrl);
    setUploadingBanner(false);
    event.target.value = '';
  };

  const handleRemoveBanner = async () => {
    if (!userId) return;
    const { error } = await supabase.from('shops').update({ banner_url: null }).eq('id', userId);
    if (error) { alert('Failed to remove banner. Please try again.'); return; }
    setShop((prev) => (prev ? { ...prev, banner_url: null } : prev));
    setBannerUrl(null);
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userId) return;
    setUploadingLogo(true);
    const fileExt = file.name.split('.').pop();
    const filePath = `${userId}/${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from('logos').upload(filePath, file, { upsert: false });
    if (uploadError) { alert('Error uploading logo. Please try again.'); setUploadingLogo(false); return; }
    const { data: publicUrlData } = supabase.storage.from('logos').getPublicUrl(filePath);
    const logoUrl = publicUrlData.publicUrl;
    const { error: updateError } = await supabase.from('shops').update({ logo_url: logoUrl }).eq('id', userId);
    if (updateError) { alert('Logo uploaded but failed to save.'); setUploadingLogo(false); return; }
    setShop((prev) => (prev ? { ...prev, logo_url: logoUrl } : prev));
    setUploadingLogo(false);
    event.target.value = '';
  };

  const handleSaveBio = async () => {
    if (!userId) return;
    setSavingBio(true);
    const sanitizedBio = bioInput.trim().slice(0, 150);
    const { error } = await supabase.from('shops').update({ bio: sanitizedBio }).eq('id', userId);
    if (error) { alert('Failed to save bio. Please try again.'); setSavingBio(false); return; }
    setShop((prev) => (prev ? { ...prev, bio: sanitizedBio } : prev));
    setBioInput(sanitizedBio);
    setSavingBio(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) alert('Error deleting');
    else window.location.reload();
  };

  const handleSaveDesignSettings = async () => {
    if (!userId) return;
    setSavingDesign(true);
    const { error } = await supabase
      .from('shops')
      .update({
        store_layout: storeLayout,
        theme_color: themeColor,
        offers_delivery: offersDelivery,
        offers_pickup: offersPickup,
        pickup_instructions: offersPickup ? pickupInstructions.trim() : '',
      })
      .eq('id', userId);
    if (error) { alert('Failed to save design settings.'); setSavingDesign(false); return; }
    setShop((prev) => prev ? { ...prev, store_layout: storeLayout, theme_color: themeColor, offers_delivery: offersDelivery, offers_pickup: offersPickup, pickup_instructions: offersPickup ? pickupInstructions.trim() : '' } : prev);
    setSavingDesign(false);
  };

  const layoutOptions = [
    { id: 'serrekunda', name: 'The Serrekunda', description: 'A clean, dense minimalist catalog. Perfect for high-volume everyday fashion.' },
    { id: 'bantaba', name: 'The Bantaba', description: 'A premium, airy trust layout with floating cards. Ideal for jewelry, watches, and verified brands.' },
    { id: 'kairaba', name: 'The Kairaba', description: 'An exclusive side-by-side editorial hero with a curated feed. Perfect for high-end aesthetics.' },
    { id: 'jollof', name: 'The Jollof', description: 'An asymmetric, premium off-white boutique gallery. Perfect for artistic collections.' },
    { id: 'senegambia', name: 'The Senegambia', description: 'A massive, bright, and airy high-fashion editorial lookbook. Best for designer apparel.' },
  ];

  const colorOptions = [
    { value: 'emerald', name: 'Emerald', className: 'bg-emerald-600' },
    { value: 'midnight', name: 'Midnight', className: 'bg-slate-900' },
    { value: 'terracotta', name: 'Terracotta', className: 'bg-orange-700' },
    { value: 'ocean', name: 'Ocean', className: 'bg-blue-600' },
    { value: 'rose', name: 'Rose', className: 'bg-rose-500' },
    { value: 'champagne', name: 'Champagne', className: 'bg-[#D7C0AE]' },
    { value: 'sage', name: 'Sage', className: 'bg-[#8A9A86]' },
    { value: 'onyx', name: 'Onyx', className: 'bg-[#1A1A1A]' },
    { value: 'crimson', name: 'Crimson', className: 'bg-[#8B0000]' },
    { value: 'sand', name: 'Sand', className: 'bg-[#C2B280]' },
    { value: 'stone', name: 'Stone', className: 'bg-[#8B8C89]' },
  ];

  if (loading) return <div className="min-h-screen bg-[#F9F8F6] p-8 font-serif animate-pulse">Loading Command Center...</div>;

  return (
    <div className="min-h-screen bg-[#F9F8F6] p-6 font-sans text-[#2C3E2C] md:p-10">
      <div className="mb-10 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-serif font-bold text-[#1a2e1a]">Dashboard</h1>
          <p className="text-sm text-gray-500">
            Welcome back, <span className="font-bold">{shop?.shop_name || 'Partner'}</span>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/shop/${shop?.shop_slug}`} target="_blank" className="flex items-center gap-2 rounded-xl border border-[#E6E4DC] bg-white px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all hover:border-[#2C3E2C]">
            <Eye size={16} /> View Shop
          </Link>
          <Link href="/dashboard/add" className="flex items-center gap-2 rounded-xl bg-[#2C3E2C] px-4 py-3 text-xs font-bold uppercase tracking-widest text-white shadow-lg transition-all hover:bg-black">
            <Plus size={16} /> Add Product
          </Link>
          <button onClick={handleLogout} className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-bold uppercase tracking-widest text-red-600 transition-all hover:bg-red-100 hover:text-red-700">
            <LogOut size={16} /> Log Out
          </button>
        </div>
      </div>

      <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="group relative overflow-hidden rounded-3xl bg-[#1a2e1a] p-6 text-white shadow-xl">
          <div className="absolute -mr-10 -mt-10 h-32 w-32 rounded-full bg-white/5 blur-2xl" />
          <div className="relative z-10">
            <div className="mb-2 flex items-center gap-2 opacity-70">
              <BarChart3 size={18} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Total Orders</span>
            </div>
            <div className="mb-1 text-5xl font-serif font-medium">{totalOrders}</div>
            <p className="text-xs opacity-60">Verified platform transactions</p>
          </div>
        </div>

        <div className="group rounded-3xl border border-[#E6E4DC] bg-white p-6 shadow-sm transition-colors hover:border-[#2C3E2C]">
          <div className="mb-2 flex items-center gap-2 text-green-700">
            <DollarSign size={18} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Total Revenue (GMV)</span>
          </div>
          <div className="mb-1 text-4xl font-serif font-medium text-[#2C3E2C]">D{totalRevenue.toLocaleString()}</div>
          <p className="text-xs text-gray-400">Value of all captured orders</p>
        </div>

        <div className="group rounded-3xl border border-[#E6E4DC] bg-white p-6 shadow-sm transition-colors hover:border-[#2C3E2C]">
          <div className="mb-2 flex items-center gap-2 text-orange-600">
            <TrendingUp size={18} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Top Product</span>
          </div>
          <div className="mb-1 truncate line-clamp-1 text-2xl font-serif font-bold text-[#2C3E2C]" title={topProduct}>
            {topProduct}
          </div>
          <p className="text-xs text-gray-400">Most requested item globally</p>
        </div>
      </div>

      {/* --- ORDER MANAGEMENT --- */}
      <div className="mb-12 overflow-hidden rounded-3xl border border-[#E6E4DC] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 p-6">
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-[#2C3E2C]" />
            <h3 className="font-bold text-[#2C3E2C]">Order Management</h3>
          </div>
          <span className="rounded-md bg-orange-100 px-2 py-1 text-xs font-bold text-orange-800">
            {orders.filter(o => o.status === 'pending').length} Pending
          </span>
        </div>

        {orders.length === 0 ? (
          <div className="p-12 text-center">
            <ShoppingCart size={48} className="mx-auto mb-4 text-gray-200" />
            <p className="mb-4 text-gray-400">No orders captured yet. Share your store link to start selling!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {orders.map((order) => {
              const isPending = order.status === 'pending';
              const orderRef = order.id.split('-')[0].toUpperCase();
              
              return (
                <div key={order.id} className={`p-4 transition-colors hover:bg-gray-50 md:p-6 ${isPending ? 'bg-orange-50/30' : ''}`}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">#{orderRef}</span>
                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-full ${isPending ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                          {order.status}
                        </span>
                      </div>
                      <h4 className="text-lg font-bold text-[#2C3E2C] flex items-center gap-2">
                        <User size={16} /> {order.customers.name}
                      </h4>
                      <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                        <Phone size={14} /> {order.customers.phone_number}
                      </p>
                      <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                        <Truck size={14} /> {order.fulfillment_method === 'delivery' ? order.customers.location : 'Store Pickup'}
                      </p>
                    </div>

                    <div className="flex-1 md:px-8 border-l-2 border-transparent md:border-gray-100">
                      {order.order_items.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 mb-2 last:mb-0">
                          <div className="h-10 w-10 bg-gray-100 rounded-md overflow-hidden border border-gray-200">
                            {item.products?.image_url && <img src={item.products.image_url} alt="Item" className="w-full h-full object-cover" />}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-[#2C3E2C]">{item.quantity}x {item.products?.name}</p>
                            {item.variant_details && item.variant_details !== 'None' && (
                              <p className="text-xs text-gray-500">{item.variant_details}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-3 pt-4 md:pt-0 border-t border-gray-100 md:border-t-0">
                      <div className="text-xl font-black text-gray-900">D{order.total_amount}</div>
                      
                      {isPending ? (
                        <button 
                          onClick={() => handleUpdateOrderStatus(order.id, 'completed')}
                          className="flex items-center gap-1.5 rounded-xl bg-[#2C3E2C] px-3 py-2 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-black"
                        >
                          <CheckCircle2 size={14} /> Mark Paid
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleUpdateOrderStatus(order.id, 'pending')}
                          className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-widest text-gray-500 transition hover:bg-gray-50"
                        >
                          <Clock size={14} /> Undo
                        </button>
                      )}
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* UPGRADE 4: THE CUSTOMER DIRECTORY (CRM) */}
      <div className="mb-12 overflow-hidden rounded-3xl border border-[#E6E4DC] bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-gray-100 bg-gray-50/50 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Users size={18} className="text-[#2C3E2C]" />
              <h3 className="font-bold text-[#2C3E2C]">Customer Directory</h3>
            </div>
            <p className="mt-1 text-xs text-gray-500">Your database of past buyers. Retarget them for your next drop.</p>
          </div>
          <span className="inline-flex items-center justify-center rounded-md bg-[#2C3E2C] px-3 py-1.5 text-xs font-bold text-white shadow-sm md:w-auto">
            {customersCRM.length} Total Customers
          </span>
        </div>

        {customersCRM.length === 0 ? (
          <div className="p-12 text-center">
            <Users size={48} className="mx-auto mb-4 text-gray-200" />
            <p className="mb-4 text-gray-400">Your customer list is empty. Start generating sales to build your database!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {customersCRM.map((customer, idx) => {
              const initials = customer.name.substring(0, 2).toUpperCase();
              
              // Pre-fill a WhatsApp template for retargeting
              const whatsappLink = `https://wa.me/${sanitizePhoneNumber(customer.phone)}?text=${encodeURIComponent(
                `Hi ${customer.name}! It's ${shop?.shop_name || 'Sanndikaa'}! We have some new items dropping soon and wanted to give our best customers early access. Let me know if you're looking for anything specific!`
              )}`;

              return (
                <div key={idx} className="group flex flex-col justify-between p-4 transition-colors hover:bg-gray-50 md:flex-row md:items-center md:p-6">
                  
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#1a2e1a] text-sm font-bold text-white shadow-inner">
                      {initials}
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-[#2C3E2C]">{customer.name}</h4>
                      <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
                        <Phone size={12} /> {customer.phone}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 md:mt-0 md:border-t-0 md:pt-0 md:gap-8">
                    <div className="text-left md:text-right">
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Total Spent</p>
                      <p className="text-lg font-black text-gray-900">D{customer.totalSpent.toLocaleString()}</p>
                      <p className="text-[10px] font-bold text-gray-500 uppercase">{customer.orderCount} Order{customer.orderCount > 1 ? 's' : ''}</p>
                    </div>

                    <a 
                      href={whatsappLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-green-700 transition hover:bg-green-100 hover:text-green-800 shadow-sm"
                    >
                      <MessageCircle size={16} /> 
                      <span className="hidden sm:inline">Retarget</span>
                    </a>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* --- STORE APPEARANCE --- */}
      <div className="mb-12 overflow-hidden rounded-3xl border border-[#E6E4DC] bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/50 p-6">
          <ImageIcon size={18} className="text-[#2C3E2C]" />
          <h3 className="font-bold text-[#2C3E2C]">Store Appearance</h3>
        </div>

        <div className="space-y-6 p-6">
          <div className="space-y-3">
            <p className="text-sm font-semibold text-[#2C3E2C]">Store Logo</p>
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 overflow-hidden rounded-full border border-[#E6E4DC] bg-gray-100">
                {shop?.logo_url ? (
                  <img src={shop.logo_url} alt="Store logo preview" className="aspect-square h-full w-full rounded-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-gray-400">
                    <Store size={26} />
                  </div>
                )}
              </div>

              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#E6E4DC] px-4 py-2 text-sm font-semibold transition-colors hover:border-[#2C3E2C]">
                <Upload size={16} />
                {uploadingLogo ? 'Uploading logo...' : 'Upload Store Logo'}
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
              </label>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[#2C3E2C]">Store Bio</p>
              <span className="text-xs text-gray-400">{bioInput.length}/150</span>
            </div>
            <textarea
              value={bioInput}
              onChange={(event) => setBioInput(event.target.value.slice(0, 150))}
              maxLength={150}
              rows={3}
              placeholder="Write a short store bio for your customers..."
              className="w-full rounded-xl border border-[#E6E4DC] px-4 py-3 text-sm text-[#2C3E2C] outline-none transition focus:border-[#2C3E2C]"
            />
            <button
              type="button"
              onClick={handleSaveBio}
              disabled={savingBio}
              className="inline-flex items-center rounded-xl bg-[#2C3E2C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
            >
              {savingBio ? 'Saving...' : 'Save Bio'}
            </button>
          </div>

          <div className="rounded-2xl border border-[#E6E4DC] bg-gradient-to-br from-white to-emerald-50/40 p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">New</p>
                <h4 className="text-lg font-bold text-[#1a2e1a]">Design Studio</h4>
                <p className="text-xs text-gray-500">Choose the storefront layout and color signature that fits your brand.</p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-[#2C3E2C]">Layout</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {layoutOptions.map((layout) => {
                  const isActive = storeLayout === layout.id;
                  return (
                    <button
                      key={layout.id}
                      type="button"
                      onClick={() => setStoreLayout(layout.id)}
                      className={`rounded-2xl border bg-white p-4 text-left transition-all ${
                        isActive
                          ? 'border-[#2C3E2C] ring-2 ring-[#2C3E2C]/30 shadow-md'
                          : 'border-[#E6E4DC] hover:border-[#2C3E2C]/60 hover:shadow-sm'
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="font-bold text-[#2C3E2C]">{layout.name}</p>
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${
                            isActive ? 'bg-[#2C3E2C] text-white' : 'bg-[#F4F2EB] text-[#2C3E2C]/80'
                          }`}
                        >
                          {isActive ? 'Selected' : 'Layout'}
                        </span>
                      </div>
                      <p className="text-xs leading-5 text-gray-500">{layout.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-[#2C3E2C]">Theme Color</p>
              <div className="grid grid-cols-6 gap-3 sm:grid-cols-11 md:gap-4">
                {colorOptions.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setThemeColor(color.value)}
                    title={color.name}
                    className={`h-10 w-10 rounded-full transition-all ${color.className} ${
                      themeColor === color.value
                        ? 'scale-110 shadow-md ring-2 ring-[#2C3E2C]/50 ring-offset-2 ring-offset-white'
                        : 'opacity-80 hover:scale-105 hover:opacity-100'
                    }`}
                    aria-label={`Set theme color to ${color.name}`}
                  />
                ))}
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Selected: <span className="font-semibold text-[#2C3E2C]">{colorOptions.find(c => c.value === themeColor)?.name || 'Emerald'}</span>
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-[#E6E4DC] bg-white p-5 shadow-sm">
            <h4 className="text-lg font-bold text-[#1a2e1a]">Fulfillment Settings</h4>
            <p className="mt-1 text-xs text-gray-500">How do you get your products to customers?</p>

            <div className="mt-5 space-y-6">
              <div className="flex w-full max-w-md items-center rounded-xl bg-gray-100 p-1.5 shadow-inner">
                <button
                  type="button"
                  onClick={() => { setOffersDelivery(true); setOffersPickup(false); }}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all duration-200 ${
                    offersDelivery && !offersPickup
                      ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Delivery Only
                </button>
                <button
                  type="button"
                  onClick={() => { setOffersDelivery(false); setOffersPickup(true); }}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all duration-200 ${
                    !offersDelivery && offersPickup
                      ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Pickup Only
                </button>
                <button
                  type="button"
                  onClick={() => { setOffersDelivery(true); setOffersPickup(true); }}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all duration-200 ${
                    offersDelivery && offersPickup
                      ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Both Available
                </button>
              </div>

              {offersPickup && (
                <div className="space-y-2 max-w-md">
                  <label htmlFor="pickup-instructions" className="text-xs font-bold uppercase tracking-widest text-[#2C3E2C]">
                    Pickup/Meetup Instructions
                  </label>
                  <textarea
                    id="pickup-instructions"
                    value={pickupInstructions}
                    onChange={(event) => setPickupInstructions(event.target.value)}
                    rows={3}
                    placeholder="E.g., Meet at Westfield Monument or pickup from shop."
                    className="w-full rounded-xl border border-[#E6E4DC] px-4 py-3 text-sm text-[#2C3E2C] outline-none transition focus:border-[#2C3E2C]"
                  />
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleSaveDesignSettings}
              disabled={savingDesign}
              className="mt-6 inline-flex items-center rounded-xl bg-[#1a2e1a] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
            >
              {savingDesign ? 'Saving settings...' : 'Save Design & Fulfillment Settings'}
            </button>
          </div>

          <p className="text-sm text-gray-500">Upload a custom banner to personalize your storefront.</p>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#E6E4DC] px-4 py-2 text-sm font-semibold transition-colors hover:border-[#2C3E2C]">
            <Upload size={16} />
            {uploadingBanner ? 'Uploading banner...' : 'Upload Store Banner'}
            <input type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} disabled={uploadingBanner} />
          </label>

          {bannerUrl && (
            <div>
              <p className="mb-2 text-xs uppercase tracking-widest text-gray-400">Current Banner</p>
              <img
                src={bannerUrl}
                alt="Store banner preview"
                className="h-48 w-full rounded-xl border border-gray-200 object-cover shadow-sm"
              />
              <button
                type="button"
                onClick={handleRemoveBanner}
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-red-500 transition-colors hover:text-red-700"
              >
                <Trash2 size={14} />
                Remove Banner
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-[#E6E4DC] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 p-6">
          <h3 className="font-bold text-[#2C3E2C]">Active Inventory</h3>
          <span className="rounded-md bg-[#2C3E2C] px-2 py-1 text-xs font-bold text-white">{products.length} Items</span>
        </div>

        {products.length === 0 ? (
          <div className="p-12 text-center">
            <Package size={48} className="mx-auto mb-4 text-gray-200" />
            <p className="mb-4 text-gray-400">You have not listed any products yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {products.map((product) => (
              <div key={product.id} className="group flex items-center justify-between p-4 transition-colors hover:bg-gray-50 md:p-6">
                <div className="flex items-center gap-4 md:gap-6">
                  <div className="h-16 w-16 overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                    {product.image_url && <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />}
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-[#2C3E2C]">{product.name}</h4>
                    <p className="text-sm text-gray-500">
                      D{product.price} •{' '}
                      <span className="text-xs font-bold uppercase text-green-600">{product.category}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 md:gap-4">
                  <Link
                    href={`/product/${product.id}`}
                    target="_blank"
                    className="rounded-full p-2 text-gray-400 transition-all hover:bg-white hover:text-[#2C3E2C]"
                    title="View"
                  >
                    <ExternalLink size={18} />
                  </Link>
                  <Link
                    href={`/dashboard/edit/${product.id}`}
                    className="rounded-full p-2 text-gray-400 transition-all hover:bg-blue-50 hover:text-blue-600"
                    title="Edit"
                  >
                    <Edit size={18} />
                  </Link>
                  <button
                    onClick={() => handleDelete(product.id)}
                    className="rounded-full p-2 text-gray-400 transition-all hover:bg-red-50 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="h-48 w-full"></div>
    </div>
  );
}