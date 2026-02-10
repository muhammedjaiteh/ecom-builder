'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Loader2, Upload, User, Phone, Globe, ArrowLeft, Camera } from 'lucide-react';
import Link from 'next/link';

export default function ShopSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  // Shop Form Data
  const [shopName, setShopName] = useState('');
  const [shopSlug, setShopSlug] = useState('');
  const [phone, setPhone] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const supabase = createClientComponentClient();
  const router = useRouter();

  useEffect(() => {
    async function loadShopData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUser(user);

      // Fetch existing shop details
      const { data: shop } = await supabase
        .from('shops')
        .select('*')
        .eq('id', user.id)
        .single();

      if (shop) {
        setShopName(shop.shop_name || '');
        setShopSlug(shop.shop_slug || '');
        setPhone(shop.phone || '');
        setLogoUrl(shop.logo_url || null);
      }
      setLoading(false);
    }
    loadShopData();
  }, []);

  // 📸 Handle Logo Selection
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  // 💾 Save Changes
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      let finalLogoUrl = logoUrl;

      // 1. Upload New Logo (if selected)
      if (logoFile && user) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `logo-${user.id}-${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('product-images') // We reuse the bucket for simplicity
          .upload(fileName, logoFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);
        
        finalLogoUrl = publicUrl;
      }

      // 2. Update Database
      const { error } = await supabase
        .from('shops')
        .upsert({
          id: user.id,
          shop_name: shopName,
          // shop_slug: shopSlug, // We DON'T update slug to prevent breaking links
          phone: phone,
          logo_url: finalLogoUrl
        });

      if (error) throw error;

      alert('Shop settings updated successfully! 🏪');
      router.refresh();

    } catch (error: any) {
      alert('Error updating settings: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#F9F8F6] flex items-center justify-center">Loading Studio...</div>;

  return (
    <div className="min-h-screen bg-[#F9F8F6] font-sans text-[#2C3E2C] p-6 md:p-12 flex justify-center">
      
      <div className="w-full max-w-2xl">
        <div className="mb-8">
            <Link href="/dashboard" className="flex items-center text-gray-500 hover:text-green-700 mb-4 transition-colors">
            <ArrowLeft size={20} className="mr-2" /> Back to Dashboard
            </Link>
            <h1 className="text-4xl font-serif font-medium">Shop Settings</h1>
            <p className="text-gray-500 mt-2">Manage your brand identity and contact details.</p>
        </div>

        <form onSubmit={handleSave} className="bg-white p-8 rounded-3xl shadow-sm border border-[#E6E4DC] space-y-8">
            
            {/* 📸 LOGO UPLOAD SECTION */}
            <div className="flex flex-col items-center justify-center pb-8 border-b border-[#E6E4DC]">
                <div className="relative group cursor-pointer">
                    <div className="w-32 h-32 rounded-full overflow-hidden bg-[#F9F8F6] border-4 border-white shadow-lg flex items-center justify-center">
                        {preview || logoUrl ? (
                            <img src={preview || logoUrl || ''} alt="Shop Logo" className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-4xl font-serif font-bold text-gray-300">{shopName.charAt(0)}</span>
                        )}
                    </div>
                    
                    {/* Overlay Icon */}
                    <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera className="text-white" size={32} />
                    </div>

                    <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleLogoChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                </div>
                <p className="text-sm font-bold text-gray-400 mt-4 uppercase tracking-wider">Tap to Change Logo</p>
            </div>

            {/* 📝 FORM FIELDS */}
            <div className="space-y-6">
                
                {/* Shop Name */}
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Shop Name</label>
                    <div className="relative">
                        <User className="absolute left-4 top-3.5 text-gray-400" size={20} />
                        <input 
                            type="text" 
                            value={shopName}
                            onChange={(e) => setShopName(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-[#F9F8F6] border-none rounded-xl focus:ring-2 focus:ring-[#2C3E2C] font-serif text-lg text-[#2C3E2C]"
                            placeholder="e.g. Famwise Boutique"
                        />
                    </div>
                </div>

                {/* WhatsApp Phone */}
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">WhatsApp Number</label>
                    <div className="relative">
                        <Phone className="absolute left-4 top-3.5 text-gray-400" size={20} />
                        <input 
                            type="text" 
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-[#F9F8F6] border-none rounded-xl focus:ring-2 focus:ring-[#2C3E2C] font-sans text-lg"
                            placeholder="e.g. 2207470187"
                        />
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Customers will contact you on this number.</p>
                </div>

                {/* Shop Link (Read Only) */}
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Your Shop Link</label>
                    <div className="relative opacity-60">
                        <Globe className="absolute left-4 top-3.5 text-gray-400" size={20} />
                        <input 
                            type="text" 
                            value={`sanndikaa.com/shop/${shopSlug}`}
                            readOnly
                            className="w-full pl-12 pr-4 py-3 bg-gray-100 border-none rounded-xl text-gray-500 cursor-not-allowed"
                        />
                    </div>
                </div>
            </div>

            {/* 💾 SAVE BUTTON */}
            <div className="pt-4">
                <button 
                    type="submit" 
                    disabled={saving}
                    className="w-full bg-[#2C3E2C] hover:bg-black text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-xl active:scale-[0.98]"
                >
                    {saving ? (
                        <>
                            <Loader2 className="animate-spin" size={20} /> Saving...
                        </>
                    ) : (
                        <>
                            <Save size={20} /> Update Shop Profile
                        </>
                    )}
                </button>
            </div>

        </form>
      </div>
    </div>
  );
}