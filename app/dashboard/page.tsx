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
  Handshake,
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

type Lead = {
  product_price: number | null;
  product_name: string;
};

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [shop, setShop] = useState<Shop | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [bioInput, setBioInput] = useState('');
  const [savingBio, setSavingBio] = useState(false);
  const [storeLayout, setStoreLayout] = useState('bantaba');
  const [themeColor, setThemeColor] = useState('emerald');
  const [offersDelivery, setOffersDelivery] = useState(true);
  const [offersPickup, setOffersPickup] = useState(true);
  const [pickupInstructions, setPickupInstructions] = useState('');
  const [savingDesign, setSavingDesign] = useState(false);

  const [totalLeads, setTotalLeads] = useState(0);
  const [potentialRevenue, setPotentialRevenue] = useState(0);
  const [topProduct, setTopProduct] = useState('None');

  const supabase = createClientComponentClient();
  const router = useRouter();

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

      const { data: shopData } = await supabase
        .from('shops')
        .select(
          'id, shop_name, shop_slug, banner_url, logo_url, bio, store_layout, theme_color, offers_delivery, offers_pickup, pickup_instructions'
        )
        .eq('id', user.id)
        .single();

      const resolvedShop = shopData as Shop | null;
      setShop(resolvedShop);
      setBioInput(resolvedShop?.bio || '');
      setStoreLayout(resolvedShop?.store_layout || 'bantaba');
      setThemeColor(resolvedShop?.theme_color || 'emerald');
      setOffersDelivery(resolvedShop?.offers_delivery ?? true);
      setOffersPickup(resolvedShop?.offers_pickup ?? true);
      setPickupInstructions(resolvedShop?.pickup_instructions || '');

      const { data: productData } = await supabase
        .from('products')
        .select('id, image_url, name, price, category')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setProducts((productData as Product[]) || []);

      const { data: leadsData } = await supabase
        .from('leads')
        .select('product_price, product_name')
        .eq('seller_id', user.id);

      const leads = (leadsData as Lead[]) || [];
      setTotalLeads(leads.length);

      const revenue = leads.reduce((acc, lead) => acc + (lead.product_price || 0), 0);
      setPotentialRevenue(revenue);

      if (leads.length > 0) {
        const counts: Record<string, number> = {};
        leads.forEach((lead) => {
          counts[lead.product_name] = (counts[lead.product_name] || 0) + 1;
        });
        const top = Object.keys(counts).reduce((a, b) => (counts[a] > counts[b] ? a : b));
        setTopProduct(top);
      }

      setLoading(false);
    }

    loadDashboard();
  }, [router, supabase]);

  const handleBannerUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userId) return;

    setUploadingBanner(true);

    const fileExt = file.name.split('.').pop();
    const filePath = `${userId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage.from('banners').upload(filePath, file, { upsert: false });

    if (uploadError) {
      alert('Error uploading banner. Please try again.');
      setUploadingBanner(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from('banners').getPublicUrl(filePath);

    const bannerUrl = publicUrlData.publicUrl;

    const { error: updateError } = await supabase.from('shops').update({ banner_url: bannerUrl }).eq('id', userId);

    if (updateError) {
      alert('Banner uploaded but failed to save to your shop profile.');
      setUploadingBanner(false);
      return;
    }

    setShop((prev) => (prev ? { ...prev, banner_url: bannerUrl } : prev));
    setUploadingBanner(false);
    event.target.value = '';
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userId) return;

    setUploadingLogo(true);

    const fileExt = file.name.split('.').pop();
    const filePath = `${userId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage.from('logos').upload(filePath, file, { upsert: false });

    if (uploadError) {
      alert('Error uploading logo. Please try again.');
      setUploadingLogo(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from('logos').getPublicUrl(filePath);

    const logoUrl = publicUrlData.publicUrl;

    const { error: updateError } = await supabase.from('shops').update({ logo_url: logoUrl }).eq('id', userId);

    if (updateError) {
      alert('Logo uploaded but failed to save to your shop profile.');
      setUploadingLogo(false);
      return;
    }

    setShop((prev) => (prev ? { ...prev, logo_url: logoUrl } : prev));
    setUploadingLogo(false);
    event.target.value = '';
  };

  const handleSaveBio = async () => {
    if (!userId) return;

    setSavingBio(true);
    const sanitizedBio = bioInput.trim().slice(0, 150);

    const { error } = await supabase.from('shops').update({ bio: sanitizedBio }).eq('id', userId);

    if (error) {
      alert('Failed to save bio. Please try again.');
      setSavingBio(false);
      return;
    }

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

    if (error) {
      alert('Failed to save design settings. Please try again.');
      setSavingDesign(false);
      return;
    }

    setShop((prev) =>
      prev
        ? {
            ...prev,
            store_layout: storeLayout,
            theme_color: themeColor,
            offers_delivery: offersDelivery,
            offers_pickup: offersPickup,
            pickup_instructions: offersPickup ? pickupInstructions.trim() : '',
          }
        : prev
    );
    setSavingDesign(false);
  };

  const layoutOptions = [
    { value: 'bantaba', label: 'The Bantaba', subtitle: '2-Column Trust Grid' },
    { value: 'kairaba', label: 'The Kairaba', subtitle: 'Full-Width Fashion Feed' },
    { value: 'serrekunda', label: 'The Serrekunda', subtitle: 'Dense 3-Column Catalog' },
  ];

  const colorOptions = [
    { value: 'emerald', className: 'bg-emerald-600' },
    { value: 'midnight', className: 'bg-slate-900' },
    { value: 'terracotta', className: 'bg-orange-700' },
    { value: 'ocean', className: 'bg-blue-600' },
    { value: 'rose', className: 'bg-rose-500' },
  ];

  if (loading)
    return <div className="min-h-screen bg-[#F9F8F6] p-8 font-serif animate-pulse">Loading Command Center...</div>;

  return (
    <div className="min-h-screen bg-[#F9F8F6] p-6 font-sans text-[#2C3E2C] md:p-10">
      <div className="mb-10 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-serif font-bold text-[#1a2e1a]">Dashboard</h1>
          <p className="text-sm text-gray-500">
            Welcome back, <span className="font-bold">{shop?.shop_name || 'Partner'}</span>.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/shop/${shop?.shop_slug}`}
            target="_blank"
            className="flex items-center gap-2 rounded-xl border border-[#E6E4DC] bg-white px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all hover:border-[#2C3E2C]"
          >
            <Eye size={16} /> View Shop
          </Link>
          <Link
            href="/dashboard/add-product"
            className="flex items-center gap-2 rounded-xl bg-[#2C3E2C] px-6 py-3 text-xs font-bold uppercase tracking-widest text-white shadow-lg transition-all hover:bg-black"
          >
            <Plus size={16} /> Add Product
          </Link>
        </div>
      </div>

      <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="group relative overflow-hidden rounded-3xl bg-[#1a2e1a] p-6 text-white shadow-xl">
          <div className="absolute -mr-10 -mt-10 h-32 w-32 rounded-full bg-white/5 blur-2xl" />
          <div className="relative z-10">
            <div className="mb-2 flex items-center gap-2 opacity-70">
              <BarChart3 size={18} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Customer Interest</span>
            </div>
            <div className="mb-1 text-5xl font-serif font-medium">{totalLeads}</div>
            <p className="text-xs opacity-60">People clicked &quot;Order&quot;</p>
          </div>
        </div>

        <div className="group rounded-3xl border border-[#E6E4DC] bg-white p-6 shadow-sm transition-colors hover:border-[#2C3E2C]">
          <div className="mb-2 flex items-center gap-2 text-green-700">
            <DollarSign size={18} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Potential Revenue</span>
          </div>
          <div className="mb-1 text-4xl font-serif font-medium text-[#2C3E2C]">D{potentialRevenue.toLocaleString()}</div>
          <p className="text-xs text-gray-400">Value of interested leads</p>
        </div>

        <div className="group rounded-3xl border border-[#E6E4DC] bg-white p-6 shadow-sm transition-colors hover:border-[#2C3E2C]">
          <div className="mb-2 flex items-center gap-2 text-orange-600">
            <TrendingUp size={18} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Top Product</span>
          </div>
          <div className="mb-1 truncate line-clamp-1 text-2xl font-serif font-bold text-[#2C3E2C]" title={topProduct}>
            {topProduct}
          </div>
          <p className="text-xs text-gray-400">Most requested item</p>
        </div>
      </div>

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
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {layoutOptions.map((layout) => (
                  <button
                    key={layout.value}
                    type="button"
                    onClick={() => setStoreLayout(layout.value)}
                    className={`rounded-xl border bg-white p-4 text-left transition-all ${
                      storeLayout === layout.value
                        ? 'border-[#2C3E2C] ring-2 ring-[#2C3E2C]/30 shadow-md'
                        : 'border-[#E6E4DC] hover:border-[#2C3E2C]/60'
                    }`}
                  >
                    <p className="font-bold text-[#2C3E2C]">{layout.label}</p>
                    <p className="text-xs text-gray-500">{layout.subtitle}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-[#2C3E2C]">Theme Color</p>
              <div className="flex items-center gap-3">
                {colorOptions.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setThemeColor(color.value)}
                    className={`h-10 w-10 rounded-full ${color.className} transition-all ${
                      themeColor === color.value
                        ? 'scale-105 ring-4 ring-[#2C3E2C]/35 ring-offset-2 ring-offset-white'
                        : 'hover:scale-105'
                    }`}
                    aria-label={`Set theme color to ${color.value}`}
                    title={color.value}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#E6E4DC] bg-white p-5 shadow-sm">
            <h4 className="text-lg font-bold text-[#1a2e1a]">Fulfillment Settings</h4>
            <p className="mt-1 text-xs text-gray-500">How do you get your products to customers?</p>

            <div className="mt-5 space-y-4">
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#E6E4DC] p-3 transition hover:border-[#2C3E2C]/60">
                <input
                  type="checkbox"
                  checked={offersDelivery}
                  onChange={(event) => setOffersDelivery(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-[#2C3E2C] focus:ring-[#2C3E2C]"
                />
                <span className="flex items-center gap-2 text-sm font-medium text-[#2C3E2C]">
                  <Truck size={16} />
                  Offer Local Delivery
                </span>
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#E6E4DC] p-3 transition hover:border-[#2C3E2C]/60">
                <input
                  type="checkbox"
                  checked={offersPickup}
                  onChange={(event) => setOffersPickup(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-[#2C3E2C] focus:ring-[#2C3E2C]"
                />
                <span className="flex items-center gap-2 text-sm font-medium text-[#2C3E2C]">
                  <Handshake size={16} />
                  Offer Local Pickup / Meetup
                </span>
              </label>

              {offersPickup && (
                <div className="space-y-2">
                  <label htmlFor="pickup-instructions" className="text-xs font-bold uppercase tracking-widest text-[#2C3E2C]">
                    Pickup/Meetup Instructions
                  </label>
                  <textarea
                    id="pickup-instructions"
                    value={pickupInstructions}
                    onChange={(event) => setPickupInstructions(event.target.value)}
                    rows={3}
                    placeholder="Meet at Westfield Monument"
                    className="w-full rounded-xl border border-[#E6E4DC] px-4 py-3 text-sm text-[#2C3E2C] outline-none transition focus:border-[#2C3E2C]"
                  />
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleSaveDesignSettings}
              disabled={savingDesign}
              className="mt-6 inline-flex items-center rounded-xl bg-[#1a2e1a] px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
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

          {shop?.banner_url && (
            <div>
              <p className="mb-2 text-xs uppercase tracking-widest text-gray-400">Current Banner</p>
              <img
                src={shop.banner_url}
                alt="Store banner preview"
                className="h-48 w-full rounded-xl border border-gray-200 object-cover shadow-sm"
              />
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
    </div>
  );
}
