'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Package, DollarSign, TrendingUp, Plus, Edit, Trash2, ExternalLink, BarChart3, Eye, Image as ImageIcon, Upload } from 'lucide-react';
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

  // 📊 ANALYTICS STATES
  const [totalLeads, setTotalLeads] = useState(0);
  const [potentialRevenue, setPotentialRevenue] = useState(0);
  const [topProduct, setTopProduct] = useState('None');

  const supabase = createClientComponentClient();
  const router = useRouter();

  useEffect(() => {
    async function loadDashboard() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUserId(user.id);

      // 1. Get Shop Details
      const { data: shopData } = await supabase
        .from('shops')
        .select('id, shop_name, shop_slug, banner_url')
        .eq('id', user.id)
        .single();
      setShop(shopData as Shop | null);

      // 2. Get Products
      const { data: productData } = await supabase
        .from('products')
        .select('id, image_url, name, price, category')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setProducts((productData as Product[]) || []);

      // 3. Get LEADS (The Analytics Engine) 📈
      const { data: leadsData } = await supabase
        .from('leads')
        .select('product_price, product_name')
        .eq('seller_id', user.id);

      const leads = (leadsData as Lead[]) || [];
      setTotalLeads(leads.length);

      // Calculate Revenue
      const revenue = leads.reduce((acc, lead) => acc + (lead.product_price || 0), 0);
      setPotentialRevenue(revenue);

      // Find Top Product
      if (leads.length > 0) {
        const counts: Record<string, number> = {};
        leads.forEach((lead) => { counts[lead.product_name] = (counts[lead.product_name] || 0) + 1; });
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

    const { error: uploadError } = await supabase.storage
      .from('banners')
      .upload(filePath, file, { upsert: false });

    if (uploadError) {
      alert('Error uploading banner. Please try again.');
      setUploadingBanner(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from('banners')
      .getPublicUrl(filePath);

    const bannerUrl = publicUrlData.publicUrl;

    const { error: updateError } = await supabase
      .from('shops')
      .update({ banner_url: bannerUrl })
      .eq('id', userId);

    if (updateError) {
      alert('Banner uploaded but failed to save to your shop profile.');
      setUploadingBanner(false);
      return;
    }

    setShop((prev) => (prev ? { ...prev, banner_url: bannerUrl } : prev));
    setUploadingBanner(false);
    event.target.value = '';
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) alert('Error deleting');
    else window.location.reload();
  };

  if (loading) return <div className="min-h-screen bg-[#F9F8F6] p-8 font-serif animate-pulse">Loading Command Center...</div>;

  return (
    <div className="min-h-screen bg-[#F9F8F6] font-sans text-[#2C3E2C] p-6 md:p-10">

      {/* 🟢 HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-[#1a2e1a]">Dashboard</h1>
          <p className="text-gray-500 text-sm">Welcome back, <span className="font-bold">{shop?.shop_name || 'Partner'}</span>.</p>
        </div>
        <div className="flex gap-3">
           <Link href={`/shop/${shop?.shop_slug}`} target="_blank" className="px-6 py-3 bg-white border border-[#E6E4DC] hover:border-[#2C3E2C] rounded-xl font-bold flex items-center gap-2 transition-all text-xs uppercase tracking-widest">
              <Eye size={16} /> View Shop
           </Link>
           <Link href="/dashboard/add-product" className="px-6 py-3 bg-[#2C3E2C] hover:bg-black text-white rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all text-xs uppercase tracking-widest">
              <Plus size={16} /> Add Product
           </Link>
        </div>
      </div>

      {/* 📊 ANALYTICS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-[#1a2e1a] text-white p-6 rounded-3xl shadow-xl relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10"></div>
           <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2 opacity-70">
                 <BarChart3 size={18} />
                 <span className="text-[10px] font-bold uppercase tracking-widest">Customer Interest</span>
              </div>
              <div className="text-5xl font-serif font-medium mb-1">{totalLeads}</div>
              <p className="text-xs opacity-60">People clicked &quot;Order&quot;</p>
           </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#E6E4DC] group hover:border-[#2C3E2C] transition-colors">
           <div className="flex items-center gap-2 mb-2 text-green-700">
              <DollarSign size={18} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Potential Revenue</span>
           </div>
           <div className="text-4xl font-serif font-medium text-[#2C3E2C] mb-1">D{potentialRevenue.toLocaleString()}</div>
           <p className="text-xs text-gray-400">Value of interested leads</p>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#E6E4DC] group hover:border-[#2C3E2C] transition-colors">
           <div className="flex items-center gap-2 mb-2 text-orange-600">
              <TrendingUp size={18} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Top Product</span>
           </div>
           <div className="text-2xl font-serif font-bold text-[#2C3E2C] mb-1 truncate line-clamp-1" title={topProduct}>
             {topProduct}
           </div>
           <p className="text-xs text-gray-400">Most requested item</p>
        </div>
      </div>

      {/* 🖼️ STORE APPEARANCE */}
      <div className="bg-white rounded-3xl border border-[#E6E4DC] shadow-sm overflow-hidden mb-12">
        <div className="p-6 border-b border-gray-100 flex items-center gap-2 bg-gray-50/50">
          <ImageIcon size={18} className="text-[#2C3E2C]" />
          <h3 className="font-bold text-[#2C3E2C]">Store Appearance</h3>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-500">Upload a custom banner to personalize your storefront.</p>

          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#E6E4DC] hover:border-[#2C3E2C] cursor-pointer transition-colors text-sm font-semibold">
            <Upload size={16} />
            {uploadingBanner ? 'Uploading banner...' : 'Upload Store Banner'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleBannerUpload}
              disabled={uploadingBanner}
            />
          </label>

          {shop?.banner_url && (
            <div>
              <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">Current Banner</p>
              <img
                src={shop.banner_url}
                alt="Store banner preview"
                className="w-full h-48 object-cover rounded-xl border border-gray-200 shadow-sm"
              />
            </div>
          )}
        </div>
      </div>

      {/* 📦 INVENTORY LIST */}
      <div className="bg-white rounded-3xl border border-[#E6E4DC] shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
           <h3 className="font-bold text-[#2C3E2C]">Active Inventory</h3>
           <span className="bg-[#2C3E2C] text-white text-xs px-2 py-1 rounded-md font-bold">{products.length} Items</span>
        </div>

        {products.length === 0 ? (
           <div className="p-12 text-center">
              <Package size={48} className="mx-auto text-gray-200 mb-4" />
              <p className="text-gray-400 mb-4">You have not listed any products yet.</p>
           </div>
        ) : (
           <div className="divide-y divide-gray-100">
              {products.map((product) => (
                 <div key={product.id} className="p-4 md:p-6 flex items-center justify-between group hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4 md:gap-6">
                       <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                          {product.image_url && <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />}
                       </div>
                       <div>
                          <h4 className="font-bold text-lg text-[#2C3E2C]">{product.name}</h4>
                          <p className="text-sm text-gray-500">D{product.price} • <span className="text-green-600 font-bold text-xs uppercase">{product.category}</span></p>
                       </div>
                    </div>

                    <div className="flex items-center gap-2 md:gap-4">
                       <Link href={`/product/${product.id}`} target="_blank" className="p-2 text-gray-400 hover:text-[#2C3E2C] hover:bg-white rounded-full transition-all" title="View">
                          <ExternalLink size={18} />
                       </Link>
                       <Link href={`/dashboard/edit/${product.id}`} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all" title="Edit">
                          <Edit size={18} />
                       </Link>
                       <button onClick={() => handleDelete(product.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all" title="Delete">
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
