'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, Upload, X, Image as ImageIcon, Plus, Package, Sparkles, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

const CATEGORIES = ['Fashion', 'Sneakers', 'Beauty & Wellness', 'Home & Artisan', 'Tech Accessories', 'Food & Culinary'];

export default function AddProductPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // 🚀 AI Subscription States
  const [subscriptionTier, setSubscriptionTier] = useState('standard');
  const [aiCredits, setAiCredits] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Form States
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [stockQuantity, setStockQuantity] = useState('0');
  
  // Media & Variant States
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [colorInput, setColorInput] = useState('');
  const [sizes, setSizes] = useState<string[]>([]);
  const [sizeInput, setSizeInput] = useState('');

  useEffect(() => {
    async function fetchUserData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUserId(user.id);

      // Fetch their subscription tier and credits
      const { data: shop } = await supabase
        .from('shops')
        .select('subscription_tier, ai_credits')
        .eq('id', user.id)
        .single();

      if (shop) {
        setSubscriptionTier(shop.subscription_tier || 'standard');
        setAiCredits(shop.ai_credits || 0);
      }
    }
    fetchUserData();
  }, [router, supabase]);

  // Handle Images & Variants
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setImageFiles((prev) => [...prev, ...filesArray]);
      setImagePreviews((prev) => [...prev, ...filesArray.map(f => URL.createObjectURL(f))]);
    }
  };
  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };
  const addColor = () => { if (colorInput.trim() && !colors.includes(colorInput.trim())) { setColors([...colors, colorInput.trim()]); setColorInput(''); } };
  const removeColor = (colorToRemove: string) => setColors(colors.filter(c => c !== colorToRemove));
  const addSize = () => { if (sizeInput.trim() && !sizes.includes(sizeInput.trim())) { setSizes([...sizes, sizeInput.trim()]); setSizeInput(''); } };
  const removeSize = (sizeToRemove: string) => setSizes(sizes.filter(s => s !== sizeToRemove));

  // 🚀 THE AI ENGINE WITH CREDIT METERING
  const handleGenerateDescription = async () => {
    if (!name) {
      alert("Please enter a Product Name first so the AI knows what to write about!");
      return;
    }

    setAiError(null);
    setIsGenerating(true);

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: `${name} in the ${category} category` }),
      });

      const data = await response.json();

      // Handle 403 credit exhaustion error
      if (response.status === 403) {
        setAiError(data.error || 'AI Credit limit reached. Please upgrade to Advanced for unlimited access.');
        return;
      }

      if (!response.ok) {
        setAiError(data.error || 'Failed to generate description. Please try again.');
        return;
      }

      if (data.description) {
        setDescription(data.description);

        // Update local credits state instantly (no page refresh needed)
        if (data.creditsRemaining !== null && data.creditsRemaining !== undefined) {
          setAiCredits(data.creditsRemaining);
        }
      }
    } catch (error) {
      console.error('AI generation error:', error);
      setAiError('Failed to connect to AI service. Please check your connection and try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // 🚀 THE BULLETPROOF UPLOAD ENGINE
  const handlePublish = async () => {
    if (!name || !price || imageFiles.length === 0) return alert('Please provide a name, price, and at least one image.');
    if (!userId) return;
    setLoading(true);

    try {
      // 1. Get the actual shop_id linked to this user
      const { data: shop } = await supabase.from('shops').select('id').eq('id', userId).single();
      if (!shop) throw new Error("Shop not found. Please contact support.");

      // 2. Upload all images to the 'products' bucket
      const imageUrls: string[] = [];
      for (const file of imageFiles) {
        const fileExt = file.name.split('.').pop();
        const filePath = `${shop.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage.from('products').upload(filePath, file);
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(filePath);
        imageUrls.push(publicUrl);
      }

      // 3. Save to Database
      const { error: insertError } = await supabase.from('products').insert({
        user_id: userId, 
        name: name.trim(), 
        price: parseFloat(price), 
        description: description.trim(),
        category: category, 
        image_url: imageUrls[0], 
        image_urls: imageUrls, 
        colors: colors.length > 0 ? colors : null, 
        sizes: sizes.length > 0 ? sizes : null,
        stock_quantity: parseInt(stockQuantity) || 0
      });

      if (insertError) throw insertError;
      
      // 4. Trigger VIP Success Screen
      setSuccess(true);
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);

    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Failed to publish product. Please check your connection.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F8F6] font-sans text-gray-900 selection:bg-gray-900 selection:text-white pb-24">
      
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 px-4 py-4 md:px-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 transition hover:text-gray-900">
            <ArrowLeft size={16} /> Cancel
          </Link>
          {!success && (
            <button onClick={handlePublish} disabled={loading} className="flex items-center gap-2 rounded-full bg-[#1a2e1a] px-6 py-2.5 text-[11px] font-bold uppercase tracking-widest text-white shadow-md transition hover:bg-black disabled:opacity-70">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={14} />}
              {loading ? 'Publishing...' : 'Publish Product'}
            </button>
          )}
        </div>
      </header>

      {/* MAIN EDITOR */}
      <main className="max-w-4xl mx-auto px-4 py-8 md:px-10">
        
        {success ? (
          <div className="mt-10 rounded-[2rem] border border-emerald-200 bg-emerald-50 p-16 text-center shadow-sm animate-in zoom-in duration-300">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 size={40} />
            </div>
            <h2 className="text-3xl font-serif font-bold text-emerald-900">Masterpiece Added</h2>
            <p className="mt-3 text-emerald-700 font-medium">Your product is now live in the District. Returning to command center...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 animate-in fade-in duration-500">
            
            {/* LEFT COLUMN: Main Info */}
            <div className="md:col-span-2 space-y-6 md:space-y-8">
              <div className="rounded-[2rem] bg-white p-6 md:p-8 shadow-sm border border-gray-100">
                <h2 className="text-lg font-serif font-bold text-gray-900 mb-6 flex items-center gap-2"><Package size={18} className="text-gray-400" /> Basic Details</h2>
                
                <div className="space-y-5">
                  <div>
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Product Name</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Midnight Leather Boots" className="w-full rounded-2xl border border-gray-200 bg-gray-50/50 px-5 py-4 text-sm font-medium text-gray-900 outline-none transition-all focus:border-gray-900 focus:bg-white focus:ring-1 focus:ring-gray-900" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Price (GMD)</label>
                      <div className="relative">
                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">D</span>
                        <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" className="w-full rounded-2xl border border-gray-200 bg-gray-50/50 pl-10 pr-5 py-4 text-sm font-medium text-gray-900 outline-none transition-all focus:border-gray-900 focus:bg-white focus:ring-1 focus:ring-gray-900" />
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Category</label>
                      <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full appearance-none rounded-2xl border border-gray-200 bg-gray-50/50 px-5 py-4 text-sm font-medium text-gray-900 outline-none transition-all focus:border-gray-900 focus:bg-white focus:ring-1 focus:ring-gray-900">
                        {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Stock Quantity</label>
                    <input type="number" value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value)} placeholder="0" min="0" className="w-full rounded-2xl border border-gray-200 bg-gray-50/50 px-5 py-4 text-sm font-medium text-gray-900 outline-none transition-all focus:border-gray-900 focus:bg-white focus:ring-1 focus:ring-gray-900" />
                    <p className="mt-1 text-[9px] text-gray-400">How many units are available for sale?</p>
                  </div>

                  {/* 🚀 AI DESCRIPTION BOX - ENHANCED */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500">Description</label>
                      
                      <div className="flex items-center gap-3">
                        {['starter', 'pro'].includes(subscriptionTier) && (
                          <span className={`text-[9px] font-bold uppercase tracking-widest ${
                            aiCredits <= 0 ? 'text-red-500' : 'text-gray-400'
                          }`}>
                            ✨ {aiCredits} Credits Left
                          </span>
                        )}
                        {['advanced', 'flagship'].includes(subscriptionTier) && (
                          <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-600">
                            ✨ Unlimited AI
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={handleGenerateDescription}
                          disabled={isGenerating || !name}
                          className="group relative flex items-center gap-1.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white shadow-md transition hover:opacity-90 disabled:opacity-50"
                        >
                          {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                          {isGenerating ? 'Writing...' : 'Write with AI'}
                        </button>
                      </div>
                    </div>
                    
                    {aiError && (
                      <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 flex items-start gap-3 animate-in slide-in-from-top duration-300">
                        <div className="flex-shrink-0 mt-0.5">
                          <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-red-900">{aiError}</p>
                          {aiError.includes('limit reached') && (
                            <Link href="/pricing" className="mt-2 inline-block text-xs font-bold text-red-600 hover:text-red-700 underline">
                              Upgrade to Advanced for Unlimited AI →
                            </Link>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setAiError(null)}
                          className="flex-shrink-0 text-red-400 hover:text-red-500 transition"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                    
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} placeholder="Describe the product, material, and fit..." className="w-full rounded-2xl border border-gray-200 bg-gray-50/50 px-5 py-4 text-sm font-medium text-gray-900 outline-none transition-all focus:border-purple-500 focus:bg-white focus:ring-1 focus:ring-purple-500" />
                  </div>
                </div>
              </div>

              {/* Media Upload Card */}
              <div className="rounded-[2rem] bg-white p-6 md:p-8 shadow-sm border border-gray-100">
                <h2 className="text-lg font-serif font-bold text-gray-900 mb-6 flex items-center gap-2"><ImageIcon size={18} className="text-gray-400" /> Media Gallery</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {imagePreviews.map((src, idx) => (
                    <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden bg-gray-50 border border-gray-200 group">
                      <img src={src} className="w-full h-full object-cover" />
                      <button onClick={() => removeImage(idx)} className="absolute top-2 right-2 h-7 w-7 flex items-center justify-center rounded-full bg-white/90 text-red-500 opacity-0 group-hover:opacity-100 transition shadow-sm"><X size={14} /></button>
                    </div>
                  ))}
                  <label className="relative aspect-square rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 hover:border-gray-300 transition group">
                    <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center shadow-sm text-gray-400 group-hover:text-gray-900 transition"><Plus size={20} /></div>
                    <span className="mt-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Add Image</span>
                    <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageChange} />
                  </label>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Variants */}
            <div className="space-y-6 md:space-y-8">
              <div className="rounded-[2rem] bg-white p-6 shadow-sm border border-gray-100">
                <h2 className="text-lg font-serif font-bold text-gray-900 mb-6">Variants</h2>
                <div className="mb-6">
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Available Colors</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {colors.map(color => <span key={color} className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 pl-3 pr-1.5 py-1 text-xs font-bold text-gray-700">{color}<button onClick={() => removeColor(color)} className="rounded-full p-1 hover:bg-gray-200 text-gray-400 hover:text-red-500"><X size={12} /></button></span>)}
                  </div>
                  <div className="flex gap-2">
                    <input type="text" value={colorInput} onChange={(e) => setColorInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addColor())} placeholder="e.g. Midnight Black" className="flex-1 rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-xs font-medium outline-none focus:border-gray-900 focus:bg-white" />
                    <button type="button" onClick={addColor} className="rounded-xl bg-gray-100 px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-200">Add</button>
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-50">
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Available Sizes</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {sizes.map(size => <span key={size} className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 pl-3 pr-1.5 py-1 text-xs font-bold text-gray-700">{size}<button onClick={() => removeSize(size)} className="rounded-full p-1 hover:bg-gray-200 text-gray-400 hover:text-red-500"><X size={12} /></button></span>)}
                  </div>
                  <div className="flex gap-2">
                    <input type="text" value={sizeInput} onChange={(e) => setSizeInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSize())} placeholder="e.g. XL, 42" className="flex-1 rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-xs font-medium outline-none focus:border-gray-900 focus:bg-white" />
                    <button type="button" onClick={addSize} className="rounded-xl bg-gray-100 px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-200">Add</button>
                  </div>
                </div>
              </div>
              
              <div className="rounded-[2rem] bg-gradient-to-br from-purple-50 to-indigo-50 p-6 border border-purple-100 shadow-sm">
                <h3 className="text-sm font-bold text-purple-900 mb-2 flex items-center gap-2"><Sparkles size={16} /> District PRO</h3>
                <p className="text-xs text-purple-700 leading-relaxed mb-4">
                  You currently have <b>{aiCredits} free AI credits</b> remaining. Upgrade to District PRO for unlimited AI copywriting and image enhancement.
                </p>
                <Link href="/dashboard/settings" className="inline-block rounded-full bg-purple-600 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white shadow-md hover:bg-purple-700 transition hover:-translate-y-0.5">
                  Upgrade Now
                </Link>
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}