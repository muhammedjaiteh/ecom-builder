'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { toPng } from 'html-to-image';
import { Download, Palette, Type, ArrowLeft, Instagram, Sparkles } from 'lucide-react';
import Link from 'next/link';

// 🎨 HIGH-END THEME ENGINE
// We include 'overlay: null' for themes that don't need it to keep TypeScript happy.
const THEMES = {
  minimal: {
    name: 'Studio White',
    desc: 'Clean, Apple-style minimalism.',
    wrapper: 'bg-white',
    textMain: 'text-gray-900',
    textSub: 'text-gray-500',
    priceTag: 'text-6xl font-black tracking-tighter text-black',
    accent: 'bg-black text-white',
    font: 'font-sans',
    overlay: null
  },
  organic: {
    name: 'Earth & Sage',
    desc: 'Soft, natural, trustworthy.',
    wrapper: 'bg-[#F2F0E9]', // Cream
    textMain: 'text-[#2C3E2C]', // Dark Green
    textSub: 'text-[#5F6F5F]',
    priceTag: 'text-5xl font-bold text-[#2C3E2C] border-2 border-[#2C3E2C] rounded-full px-6 py-2 inline-block',
    accent: 'bg-[#2C3E2C] text-[#F2F0E9]',
    font: 'font-serif',
    overlay: null
  },
  hype: {
    name: 'Street Bold',
    desc: 'High energy, high contrast.',
    wrapper: 'bg-[#FAFAFA]', 
    textMain: 'text-black',
    textSub: 'text-gray-600',
    // Uses a CSS pattern for background
    overlay: 'bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]',
    priceTag: 'text-6xl font-black bg-yellow-400 px-4 transform -rotate-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]',
    accent: 'bg-black text-white shadow-[4px_4px_0px_0px_rgba(250,204,21,1)]',
    font: 'font-sans uppercase'
  },
  glass: {
    name: 'Frosty Glass',
    desc: 'Modern, blurred, gradients.',
    wrapper: 'bg-gradient-to-br from-purple-900 via-blue-900 to-teal-800',
    textMain: 'text-white',
    textSub: 'text-blue-100',
    priceTag: 'text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-white',
    accent: 'bg-white/20 backdrop-blur-md border border-white/30 text-white',
    font: 'font-sans',
    overlay: null
  }
};

export default function PremiumAdStudio() {
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // 🎛️ CONTROLS
  const [currentTheme, setCurrentTheme] = useState<keyof typeof THEMES>('minimal');
  const [headline, setHeadline] = useState('BACK IN STOCK');
  const [showPrice, setShowPrice] = useState(true);

  const params = useParams();
  const supabase = createClientComponentClient();
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadData() {
      const { data } = await supabase.from('products').select('*').eq('id', params.id).single();
      if (data) setProduct(data);
      setLoading(false);
    }
    loadData();
  }, [params]);

  const handleDownload = async () => {
    if (cardRef.current) {
      const dataUrl = await toPng(cardRef.current, { quality: 1.0, pixelRatio: 3 });
      const link = document.createElement('a');
      link.download = `sanndikaa-post-${currentTheme}.png`;
      link.href = dataUrl;
      link.click();
    }
  };

  if (loading || !product) return <div className="p-20 text-center">Loading Studio...</div>;

  const t = THEMES[currentTheme];

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 font-sans flex flex-col items-center">
      
      {/* 🔙 Navigation */}
      <div className="w-full max-w-7xl mb-6 flex justify-between items-center">
        <Link href="/dashboard" className="flex items-center text-gray-500 hover:text-black transition-colors">
          <ArrowLeft size={20} className="mr-2" /> Back to Dashboard
        </Link>
        <div className="text-sm font-bold text-gray-400 uppercase tracking-widest hidden md:block">Sanndikaa Studio</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full max-w-7xl">
        
        {/* 🎛️ LEFT PANEL: CONTROLS */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm space-y-6">
            
            {/* Theme Grid */}
            <div>
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Palette size={16} /> Select Aesthetic
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {Object.entries(THEMES).map(([key, theme]) => (
                  <button
                    key={key}
                    onClick={() => setCurrentTheme(key as any)}
                    className={`p-4 rounded-xl text-left transition-all flex items-center justify-between group ${
                      currentTheme === key 
                        ? 'bg-gray-900 text-white shadow-lg scale-[1.02]' 
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-sm">{theme.name}</div>
                      <div className={`text-xs ${currentTheme === key ? 'text-gray-400' : 'text-gray-400'}`}>{theme.desc}</div>
                    </div>
                    {currentTheme === key && <Sparkles size={16} className="text-yellow-400" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Text Controls */}
            <div>
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Type size={16} /> Customize
              </h3>
              <input 
                type="text" 
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                className="w-full p-4 bg-gray-50 rounded-xl border-2 border-transparent focus:border-gray-900 focus:outline-none font-bold text-gray-900 text-lg transition-all"
                placeholder="Write a hook..."
              />
              <div className="mt-4 flex items-center gap-3 cursor-pointer" onClick={() => setShowPrice(!showPrice)}>
                <div className={`w-12 h-6 rounded-full p-1 transition-colors ${showPrice ? 'bg-green-500' : 'bg-gray-200'}`}>
                  <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${showPrice ? 'translate-x-6' : 'translate-x-0'}`} />
                </div>
                <span className="text-sm font-medium text-gray-600">Show Price</span>
              </div>
            </div>

            {/* Download */}
            <button 
              onClick={handleDownload}
              className="w-full py-5 bg-black text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl"
            >
              <Download size={22} /> Download Poster
            </button>

          </div>
        </div>

        {/* 🎨 RIGHT PANEL: THE CANVAS */}
        <div className="lg:col-span-8 bg-[#E5E5E5] rounded-3xl p-8 md:p-12 flex items-center justify-center border border-gray-200 overflow-hidden relative">
          
          {/* Background Grid Pattern */}
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

          {/* ✨ THE ACTUAL CARD ✨ */}
          <div 
            ref={cardRef}
            className={`
              relative w-[400px] h-[700px] shadow-2xl overflow-hidden flex flex-col justify-between p-8
              transition-all duration-500
              ${t.wrapper} ${t.font}
            `}
          >
            {/* Optional Overlay Pattern */}
            {t.overlay && <div className={`absolute inset-0 opacity-10 ${t.overlay} pointer-events-none`}></div>}

            {/* HEADER */}
            <div className="flex justify-between items-start z-10 relative">
              <div className="flex items-center gap-2 opacity-80">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${t.accent}`}>S</div>
                <span className={`text-xs font-bold tracking-[0.2em] uppercase ${t.textMain}`}>Sanndikaa</span>
              </div>
            </div>

            {/* CENTER CONTENT */}
            <div className="flex-1 flex flex-col justify-center items-center z-10 relative my-8">
               
               {/* 📦 THE VISUAL */}
               <div className="relative group w-full aspect-square flex items-center justify-center mb-8">
                  {currentTheme === 'glass' && <div className="absolute w-48 h-48 bg-cyan-400 rounded-full blur-[80px] opacity-40 animate-pulse"></div>}
                  {currentTheme === 'hype' && <div className="absolute w-full h-full border-4 border-black translate-x-2 translate-y-2"></div>}
                  
                  <div className={`
                    w-full h-full flex flex-col items-center justify-center rounded-3xl
                    ${currentTheme === 'hype' ? 'bg-white border-4 border-black' : 'bg-transparent'}
                    ${currentTheme === 'organic' ? 'bg-[#E6E4DC] rounded-full' : ''}
                  `}>
                     <span className="text-9xl filter drop-shadow-2xl transform group-hover:scale-110 transition-transform duration-500">📦</span>
                     {currentTheme === 'hype' && <span className="absolute bottom-4 bg-black text-white text-xs px-2 font-bold uppercase">Fresh Drop</span>}
                  </div>
               </div>

               {/* TEXT DETAILS */}
               <div className="text-center space-y-4">
                  <h1 className={`text-4xl leading-tight ${t.textMain} ${currentTheme === 'minimal' ? 'font-black tracking-tighter' : 'font-bold'}`}>
                    {product.name}
                  </h1>
                  
                  <p className={`text-lg italic ${t.textSub}`}>
                    {headline}
                  </p>

                  {showPrice && (
                    <div className="mt-4">
                      <span className={`${t.priceTag}`}>D{product.price}</span>
                    </div>
                  )}
               </div>
            </div>

            {/* FOOTER */}
            <div className="z-10 relative">
               <div className={`
                 p-4 rounded-xl flex items-center justify-between
                 ${t.accent}
               `}>
                  <span className="text-xs font-bold tracking-wider uppercase flex items-center gap-2">
                     <Instagram size={14} /> Link in Bio
                  </span>
                  <span className="text-xs opacity-80">Sanndikaa.com</span>
               </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}