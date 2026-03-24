'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, Save, Store, Image as ImageIcon, Camera, Palette, LayoutTemplate, Truck, MapPin, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

const THEMES = [
  { id: 'emerald', name: 'Emerald', hex: 'bg-[#1a2e1a]' },
  { id: 'midnight', name: 'Midnight', hex: 'bg-slate-900' },
  { id: 'terracotta', name: 'Terracotta', hex: 'bg-orange-700' },
  { id: 'ocean', name: 'Ocean', hex: 'bg-blue-600' },
  { id: 'rose', name: 'Rose', hex: 'bg-rose-500' },
  { id: 'champagne', name: 'Champagne', hex: 'bg-[#D7C0AE]' },
  { id: 'onyx', name: 'Onyx', hex: 'bg-[#1A1A1A]' },
];

const LAYOUTS = [
  { id: 'bantaba', name: 'The Bantaba', desc: 'Airy, premium floating cards' },
  { id: 'senegambia', name: 'The Senegambia', desc: 'Massive editorial lookbook' },
  { id: 'kairaba', name: 'The Kairaba', desc: 'Horizontal list view' },
  { id: 'jollof', name: 'The Jollof', desc: 'Dynamic sneakerhead hype drops' },
  { id: 'serrekunda', name: 'The Serrekunda', desc: 'Dense, fast catalog grid' },
];

export default function CustomizeShopPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [shopId, setShopId] = useState<string | null>(null);
  
  // States
  const [bio, setBio] = useState('');
  const [themeColor, setThemeColor] = useState('emerald');
  const [storeLayout, setStoreLayout] = useState('bantaba');
  const [offersDelivery, setOffersDelivery] = useState(false);
  const [offersPickup, setOffersPickup] = useState(false);
  
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [uploadingImage, setUploadingImage] = useState<'logo' | 'banner' | null>(null);

  useEffect(() => {
    async function loadShopData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUserId(user.id);

      const { data: shop } = await supabase.from('shops').select('*').eq('id', user.id).single();
      if (shop) {
        setShopId(shop.id);
        setBio(shop.bio || '');
        setThemeColor(shop.theme_color || 'emerald');
        setStoreLayout(shop.store_layout || 'bantaba');
        setOffersDelivery(shop.offers_delivery || false);
        setOffersPickup(shop.offers_pickup || false);
        setLogoUrl(shop.logo_url || null);
        setBannerUrl(shop.banner_url || null);
      }
      setLoading(false);
    }
    loadShopData();
  }, [router, supabase]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'banner') => {
    const file = e.target.files?.[0];
    if (!file || !shopId) return;

    setUploadingImage(type);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${shopId}/${type}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage.from('brand').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('brand').getPublicUrl(filePath);
      
      if (type === 'logo') setLogoUrl(publicUrl);
      if (type === 'banner') setBannerUrl(publicUrl);
    } catch (error) {
      alert(`Failed to upload ${type}. Please try again.`);
    } finally {
      setUploadingImage(null);
    }
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);

    try {
      const { error } = await supabase.from('shops').update({
        bio: bio.trim(),
        theme_color: themeColor,
        store_layout: storeLayout,
        offers_delivery: offersDelivery,
        offers_pickup: offersPickup,
        logo_url: logoUrl,
        banner_url: bannerUrl,
      }).eq('id', userId);

      if (error) throw error;

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      alert("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#F9F8F6]"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;

  return (
    <div className="min-h-screen bg-[#F9F8F6] font-sans text-gray-900 selection:bg-gray-900 selection:text-white pb-24">
      
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 px-4 py-4 md:px-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 transition hover:text-gray-900">
            <ArrowLeft size={16} /> Dashboard
          </Link>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-full bg-[#1a2e1a] px-6 py-2.5 text-[11px] font-bold uppercase tracking-widest text-white shadow-md transition hover:bg-black disabled:opacity-70">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </header>

      {/* SUCCESS TOAST */}
      <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ${success ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
        <div className="bg-emerald-600 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
          <CheckCircle2 size={16} /> Boutique Updated
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-8 md:px-10 mt-4">
        <div className="mb-10">
          <h1 className="text-3xl font-serif font-bold text-gray-900">Brand Identity</h1>
          <p className="mt-2 text-sm text-gray-500">Design your storefront. Choose your colors, layout, and upload your high-resolution assets.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* LEFT COLUMN: VISUALS & BIO */}
          <div className="md:col-span-2 space-y-8">
            
            {/* 1. IMAGES CARD */}
            <div className="rounded-[2rem] bg-white p-6 md:p-8 shadow-sm border border-gray-100">
              <h2 className="text-lg font-serif font-bold text-gray-900 mb-6 flex items-center gap-2"><ImageIcon size={18} className="text-gray-400" /> Visual Assets</h2>
              
              {/* Banner Upload */}
              <div className="mb-8">
                <label className="mb-3 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Store Banner (Landscape)</label>
                <div className="relative h-32 md:h-48 w-full overflow-hidden rounded-[1.5rem] border-2 border-dashed border-gray-200 bg-gray-50 group">
                  {bannerUrl ? (
                    <img src={bannerUrl} alt="Banner" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center text-gray-400">
                      <ImageIcon size={32} className="mb-2 opacity-50" />
                      <span className="text-xs font-medium">Upload Banner Image</span>
                    </div>
                  )}
                  <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition cursor-pointer">
                    <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest text-gray-900">
                      {uploadingImage === 'banner' ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />} 
                      {uploadingImage === 'banner' ? 'Uploading...' : 'Change Banner'}
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'banner')} disabled={uploadingImage !== null} />
                  </label>
                </div>
              </div>

              {/* Logo Upload */}
              <div>
                <label className="mb-3 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Brand Logo (Square)</label>
                <div className="flex items-center gap-6">
                  <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-dashed border-gray-200 bg-gray-50 group shrink-0">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-gray-400"><Store size={24} className="opacity-50" /></div>
                    )}
                    <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition cursor-pointer rounded-full">
                      {uploadingImage === 'logo' ? <Loader2 size={16} className="text-white animate-spin" /> : <Camera size={16} className="text-white" />}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'logo')} disabled={uploadingImage !== null} />
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed max-w-sm">
                    Upload a high-resolution version of your logo. This appears on the District homepage and at the top of your boutique.
                  </p>
                </div>
              </div>
            </div>

            {/* 2. BIO & LOGISTICS CARD */}
            <div className="rounded-[2rem] bg-white p-6 md:p-8 shadow-sm border border-gray-100">
              <h2 className="text-lg font-serif font-bold text-gray-900 mb-6 flex items-center gap-2"><Store size={18} className="text-gray-400" /> Store Details</h2>
              
              <div className="mb-8">
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Boutique Biography</label>
                <textarea 
                  value={bio} 
                  onChange={(e) => setBio(e.target.value)} 
                  rows={4} 
                  placeholder="Tell the story of your brand. What makes your products special?" 
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50/50 px-5 py-4 text-sm font-medium text-gray-900 outline-none transition-all focus:border-gray-900 focus:bg-white focus:ring-1 focus:ring-gray-900 resize-none" 
                />
              </div>

              <div>
                <label className="mb-4 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Fulfillment Options</label>
                <div className="flex flex-col sm:flex-row gap-4">
                  <button onClick={() => setOffersDelivery(!offersDelivery)} className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-4 text-xs font-bold uppercase tracking-widest transition ${offersDelivery ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>
                    <Truck size={16} /> Delivery {offersDelivery ? 'Enabled' : 'Disabled'}
                  </button>
                  <button onClick={() => setOffersPickup(!offersPickup)} className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-4 text-xs font-bold uppercase tracking-widest transition ${offersPickup ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>
                    <MapPin size={16} /> Pickup {offersPickup ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: THEME & LAYOUT */}
          <div className="space-y-8">
            
            {/* 3. THEME CARD */}
            <div className="rounded-[2rem] bg-white p-6 shadow-sm border border-gray-100">
              <h2 className="text-lg font-serif font-bold text-gray-900 mb-6 flex items-center gap-2"><Palette size={18} className="text-gray-400" /> Brand Color</h2>
              <div className="grid grid-cols-4 gap-3">
                {THEMES.map((theme) => (
                  <button 
                    key={theme.id} 
                    onClick={() => setThemeColor(theme.id)}
                    className="flex flex-col items-center gap-2 group"
                  >
                    <div className={`h-10 w-10 rounded-full ${theme.hex} flex items-center justify-center transition-transform ${themeColor === theme.id ? 'ring-2 ring-gray-900 ring-offset-2 scale-110' : 'hover:scale-110 shadow-sm border border-gray-200'}`}>
                      {themeColor === theme.id && <CheckCircle2 size={16} className="text-white opacity-90" />}
                    </div>
                    <span className={`text-[9px] font-bold uppercase tracking-widest ${themeColor === theme.id ? 'text-gray-900' : 'text-gray-400 group-hover:text-gray-600'}`}>
                      {theme.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 4. LAYOUT CARD */}
            <div className="rounded-[2rem] bg-white p-6 shadow-sm border border-gray-100">
              <h2 className="text-lg font-serif font-bold text-gray-900 mb-6 flex items-center gap-2"><LayoutTemplate size={18} className="text-gray-400" /> Boutique Layout</h2>
              <div className="space-y-3">
                {LAYOUTS.map((layout) => (
                  <button 
                    key={layout.id} 
                    onClick={() => setStoreLayout(layout.id)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border text-left transition-all ${storeLayout === layout.id ? 'border-gray-900 bg-gray-900 text-white shadow-md' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'}`}
                  >
                    <div>
                      <h4 className={`text-sm font-bold ${storeLayout === layout.id ? 'text-white' : 'text-gray-900'}`}>{layout.name}</h4>
                      <p className={`text-[10px] uppercase tracking-widest mt-1 ${storeLayout === layout.id ? 'text-gray-300' : 'text-gray-500'}`}>{layout.desc}</p>
                    </div>
                    {storeLayout === layout.id && <CheckCircle2 size={18} className="text-white" />}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}