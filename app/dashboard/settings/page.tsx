'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, Save, Image as ImageIcon, Store, Lock, Sparkles, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

const THEME_COLORS = [
  { id: 'emerald', hex: '#1a2e1a', name: 'District Emerald' },
  { id: 'midnight', hex: '#0f172a', name: 'Midnight Blue' },
  { id: 'terracotta', hex: '#c2410c', name: 'Terracotta' },
  { id: 'rose', hex: '#f43f5e', name: 'Rose Gold' },
  { id: 'onyx', hex: '#1A1A1A', name: 'Pure Onyx' },
  { id: 'champagne', hex: '#D7C0AE', name: 'Champagne' },
];

const LAYOUTS = [
  { id: 'serrekunda', name: 'The Serrekunda', desc: 'Dense 2-Column Catalog', reqTier: 'standard', level: 1 },
  { id: 'bantaba', name: 'The Bantaba', desc: 'Premium Floating Cards', reqTier: 'pro', level: 2 },
  { id: 'kairaba', name: 'The Kairaba', desc: 'Horizontal List View', reqTier: 'pro', level: 2 },
  { id: 'jollof', name: 'The Jollof', desc: 'Luxury Sneaker/Hype Grid', reqTier: 'flagship', level: 3 },
  { id: 'senegambia', name: 'The Senegambia', desc: 'Massive Editorial Lookbook', reqTier: 'flagship', level: 3 },
];

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  
  // Shop Data States
  const [shopName, setShopName] = useState('');
  const [bio, setBio] = useState('');
  const [themeColor, setThemeColor] = useState('emerald');
  const [storeLayout, setStoreLayout] = useState('serrekunda');
  const [offersDelivery, setOffersDelivery] = useState(false);
  const [offersPickup, setOffersPickup] = useState(false);
  
  // Auth & Tier State
  const [subscriptionTier, setSubscriptionTier] = useState('standard');
  const userLevel = subscriptionTier === 'flagship' ? 3 : subscriptionTier === 'pro' ? 2 : 1;

  // Image Upload States
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSettings() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/login');
      setUserId(user.id);

      const { data: shop } = await supabase.from('shops').select('*').eq('id', user.id).maybeSingle();

      if (shop) {
        setShopName(shop.shop_name || '');
        setBio(shop.bio || '');
        setThemeColor(shop.theme_color || 'emerald');
        setStoreLayout(shop.store_layout || 'serrekunda');
        setOffersDelivery(shop.offers_delivery || false);
        setOffersPickup(shop.offers_pickup || false);
        setLogoPreview(shop.logo_url);
        setBannerPreview(shop.banner_url);
        setSubscriptionTier(shop.subscription_tier || 'standard');
      }
      setLoading(false);
    }
    fetchSettings();
  }, [router, supabase]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'banner') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (type === 'logo') { setLogoFile(file); setLogoPreview(URL.createObjectURL(file)); }
      if (type === 'banner') { setBannerFile(file); setBannerPreview(URL.createObjectURL(file)); }
    }
  };

  const handleLayoutSelect = (layoutId: string, layoutLevel: number) => {
    if (userLevel < layoutLevel) {
      alert("This layout is locked! Upgrade to a higher tier to unlock premium architecture.");
      router.push('/pricing');
      return;
    }
    setStoreLayout(layoutId);
  };

  const handleSave = async () => {
    if (!userId || !shopName.trim()) return alert('Boutique name is required.');
    setSaving(true);

    try {
      let finalLogoUrl = logoPreview;
      let finalBannerUrl = bannerPreview;

      // Upload Logo if changed
      if (logoFile) {
        const logoPath = `${userId}/logo_${Date.now()}`;
        await supabase.storage.from('shops').upload(logoPath, logoFile, { upsert: true });
        finalLogoUrl = supabase.storage.from('shops').getPublicUrl(logoPath).data.publicUrl;
      }

      // Upload Banner if changed
      if (bannerFile) {
        const bannerPath = `${userId}/banner_${Date.now()}`;
        await supabase.storage.from('shops').upload(bannerPath, bannerFile, { upsert: true });
        finalBannerUrl = supabase.storage.from('shops').getPublicUrl(bannerPath).data.publicUrl;
      }

      const { error } = await supabase
        .from('shops')
        .update({
          shop_name: shopName.trim(),
          bio: bio.trim(),
          theme_color: themeColor,
          store_layout: storeLayout,
          offers_delivery: offersDelivery,
          offers_pickup: offersPickup,
          logo_url: finalLogoUrl?.startsWith('blob:') ? null : finalLogoUrl,
          banner_url: finalBannerUrl?.startsWith('blob:') ? null : finalBannerUrl,
        })
        .eq('id', userId);

      if (error) throw error;
      alert('Settings saved successfully!');
      router.push('/dashboard');
    } catch (error: any) {
      alert(error.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#F9F8F6]"><Loader2 className="animate-spin text-gray-900" /></div>;

  return (
    <div className="min-h-screen bg-[#F9F8F6] font-sans text-gray-900 selection:bg-gray-900 selection:text-white pb-24">
      
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 px-4 py-4 md:px-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 transition hover:text-gray-900">
            <ArrowLeft size={16} /> Dashboard
          </Link>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-full bg-[#1a2e1a] px-6 py-2.5 text-[11px] font-bold uppercase tracking-widest text-white shadow-md transition hover:bg-black disabled:opacity-70">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </header>

      {/* MAIN EDITOR */}
      <main className="max-w-5xl mx-auto px-4 py-8 md:px-10">
        
        <div className="mb-8">
          <h1 className="text-3xl font-serif font-bold text-gray-900">Boutique Architecture</h1>
          <p className="text-sm text-gray-500 mt-2">Design your storefront and set your business rules.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* LEFT COLUMN: Brand Identity */}
          <div className="md:col-span-2 space-y-8">
            
            <div className="rounded-[2rem] bg-white p-6 md:p-8 shadow-sm border border-gray-100">
              <h2 className="text-lg font-serif font-bold text-gray-900 mb-6 flex items-center gap-2"><Store size={18} className="text-gray-400" /> Brand Details</h2>
              
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Boutique Name</label>
                  <input type="text" value={shopName} onChange={(e) => setShopName(e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-gray-50/50 px-5 py-4 text-sm font-medium text-gray-900 outline-none transition-all focus:border-gray-900 focus:bg-white" />
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Boutique Bio (Short Description)</label>
                  <textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Luxury footwear and accessories based in Senegambia..." className="w-full rounded-2xl border border-gray-200 bg-gray-50/50 px-5 py-4 text-sm font-medium text-gray-900 outline-none transition-all focus:border-gray-900 focus:bg-white" />
                </div>

                <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* LOGO UPLOAD */}
                  <div>
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Store Logo</label>
                    <label className="relative flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-gray-200 bg-gray-50 hover:bg-gray-100 transition group">
                      {logoPreview ? <img src={logoPreview} className="h-full w-full object-cover" /> : <ImageIcon className="text-gray-300 group-hover:text-gray-500 transition" />}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageSelect(e, 'logo')} />
                    </label>
                  </div>
                  {/* BANNER UPLOAD */}
                  <div>
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Cover Banner</label>
                    <label className="relative flex h-24 w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 hover:bg-gray-100 transition group">
                      {bannerPreview ? <img src={bannerPreview} className="h-full w-full object-cover" /> : <ImageIcon className="text-gray-300 group-hover:text-gray-500 transition" />}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageSelect(e, 'banner')} />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* FULFILLMENT RULES */}
            <div className="rounded-[2rem] bg-white p-6 md:p-8 shadow-sm border border-gray-100">
              <h2 className="text-lg font-serif font-bold text-gray-900 mb-6">Fulfillment Options</h2>
              <div className="flex gap-4">
                <label className={`flex flex-1 cursor-pointer items-center justify-between rounded-2xl border-2 p-4 transition-all ${offersDelivery ? 'border-gray-900 bg-gray-50' : 'border-gray-100 hover:border-gray-200'}`}>
                  <span className="text-sm font-bold text-gray-900">Offer Delivery</span>
                  <input type="checkbox" checked={offersDelivery} onChange={(e) => setOffersDelivery(e.target.checked)} className="h-5 w-5 rounded border-gray-300 accent-gray-900" />
                </label>
                <label className={`flex flex-1 cursor-pointer items-center justify-between rounded-2xl border-2 p-4 transition-all ${offersPickup ? 'border-gray-900 bg-gray-50' : 'border-gray-100 hover:border-gray-200'}`}>
                  <span className="text-sm font-bold text-gray-900">Offer Pickup</span>
                  <input type="checkbox" checked={offersPickup} onChange={(e) => setOffersPickup(e.target.checked)} className="h-5 w-5 rounded border-gray-300 accent-gray-900" />
                </label>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: The Engine (Theme & Layout) */}
          <div className="space-y-8">
            
            {/* THEME COLOR */}
            <div className="rounded-[2rem] bg-white p-6 shadow-sm border border-gray-100">
              <h2 className="text-lg font-serif font-bold text-gray-900 mb-4">Brand Accent</h2>
              <p className="text-xs text-gray-500 mb-4">Select the primary color for your storefront buttons and accents.</p>
              <div className="grid grid-cols-3 gap-3">
                {THEME_COLORS.map(color => (
                  <button
                    key={color.id}
                    onClick={() => setThemeColor(color.id)}
                    className={`relative flex aspect-square flex-col items-center justify-center rounded-2xl border-2 transition-all ${themeColor === color.id ? 'border-gray-900 scale-105 shadow-md' : 'border-transparent hover:scale-105'}`}
                    style={{ backgroundColor: color.hex }}
                  >
                    {themeColor === color.id && <CheckCircle2 className="absolute top-2 right-2 text-white" size={14} />}
                  </button>
                ))}
              </div>
            </div>

            {/* 🚀 THE VIP BOUNCER: STORE LAYOUTS */}
            <div className="rounded-[2rem] bg-white p-6 shadow-sm border border-gray-100">
              <h2 className="text-lg font-serif font-bold text-gray-900 mb-4 flex items-center justify-between">
                <span>Architecture</span>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-gray-500">Tier: {subscriptionTier}</span>
              </h2>
              
              <div className="space-y-3">
                {LAYOUTS.map(layout => {
                  const isLocked = userLevel < layout.level;
                  const isSelected = storeLayout === layout.id;

                  return (
                    <button
                      key={layout.id}
                      onClick={() => handleLayoutSelect(layout.id, layout.level)}
                      className={`group relative w-full flex flex-col items-start rounded-2xl border-2 p-4 text-left transition-all ${
                        isLocked ? 'border-gray-100 bg-gray-50/50 opacity-75 cursor-not-allowed' :
                        isSelected ? 'border-emerald-500 bg-emerald-50/30 shadow-sm' :
                        'border-gray-100 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex w-full items-center justify-between mb-1">
                        <span className={`text-sm font-bold ${isSelected ? 'text-emerald-700' : 'text-gray-900'}`}>{layout.name}</span>
                        {isLocked ? (
                          <Lock size={14} className="text-gray-400" />
                        ) : isSelected ? (
                          <CheckCircle2 size={16} className="text-emerald-500" />
                        ) : null}
                      </div>
                      <span className="text-xs text-gray-500">{layout.desc}</span>

                      {/* Paywall Badges */}
                      {layout.level === 2 && (
                        <span className="mt-2 inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-blue-600">
                          <Sparkles size={10} /> PRO
                        </span>
                      )}
                      {layout.level === 3 && (
                        <span className="mt-2 inline-flex items-center gap-1 rounded bg-yellow-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-yellow-700">
                          <Sparkles size={10} /> FLAGSHIP
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}