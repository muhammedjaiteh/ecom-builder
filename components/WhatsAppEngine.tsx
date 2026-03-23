'use client';

import { useState } from 'react';
import { MessageCircle, CheckCircle2, Sparkles, Send, Copy } from 'lucide-react';

type Product = {
  id: string;
  name: string;
  price: number;
};

type WhatsAppEngineProps = {
  shopName: string;
  shopSlug: string;
  products: Product[];
};

export default function WhatsAppEngine({ shopName, shopSlug, products }: WhatsAppEngineProps) {
  // By default, select the first 3 products for the broadcast
  const [selectedProducts, setSelectedProducts] = useState<string[]>(
    products.slice(0, 3).map(p => p.id)
  );
  const [copied, setCopied] = useState(false);

  const toggleProduct = (id: string) => {
    if (selectedProducts.includes(id)) {
      setSelectedProducts(selectedProducts.filter(pId => pId !== id));
    } else {
      if (selectedProducts.length >= 5) return; // Cap at 5 so the message isn't too long
      setSelectedProducts([...selectedProducts, id]);
    }
  };

  // 🧠 THE MARKETING BRAIN: Formatting the text for maximum conversion
  const generateMessage = () => {
    const featured = products.filter(p => selectedProducts.includes(p.id));
    
    let msg = `✨ *${shopName}* | _The Discovery Edit_ ✨\n\n`;
    msg += `Shop our latest premium collection directly on Sanndikaa:\n\n`;
    
    featured.forEach(p => {
      msg += `🛍️ *${p.name}*\n`;
      msg += `💎 D${p.price.toLocaleString()}\n`;
      // Assuming your domain is sanndikaa.com (update for local testing if needed)
      msg += `🔗 https://sanndikaa.com/product/${p.id}\n\n`;
    });

    msg += `🌐 *Visit our full boutique:*\n`;
    msg += `https://sanndikaa.com/shop/${shopSlug}\n\n`;
    msg += `_Powered by Sanndikaa District_ 🦅`;

    return msg;
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(generateMessage());
    // Opens WhatsApp with the pre-filled message
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(generateMessage());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm md:p-8">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366]/10 text-[#25D366]">
          <MessageCircle size={24} strokeWidth={2} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">WhatsApp Commerce Engine</h2>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mt-1">One-Click Broadcast Campaign</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        
        {/* LEFT SIDE: Selection Tool */}
        <div>
          <h3 className="mb-4 text-sm font-bold text-gray-900 flex items-center gap-2">
            <Sparkles size={16} className="text-emerald-500" />
            Select up to 5 Products to Feature
          </h3>
          <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto hide-scrollbar pr-2">
            {products.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No products available to broadcast yet.</p>
            ) : (
              products.map((product) => {
                const isSelected = selectedProducts.includes(product.id);
                return (
                  <button
                    key={product.id}
                    onClick={() => toggleProduct(product.id)}
                    className={`flex items-center justify-between rounded-xl border p-3 text-left transition-all ${
                      isSelected 
                        ? 'border-emerald-500 bg-emerald-50/50 shadow-sm' 
                        : 'border-gray-100 bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    <div>
                      <p className={`text-sm font-semibold ${isSelected ? 'text-emerald-900' : 'text-gray-900'}`}>{product.name}</p>
                      <p className={`text-xs font-bold mt-0.5 ${isSelected ? 'text-emerald-600' : 'text-gray-500'}`}>D{product.price.toLocaleString()}</p>
                    </div>
                    {isSelected && <CheckCircle2 size={18} className="text-emerald-500" />}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT SIDE: Live Preview (Luxury UI) */}
        <div className="flex flex-col rounded-2xl bg-gray-50 p-5 ring-1 ring-gray-100">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-400">Message Preview</h3>
          
          {/* Mock WhatsApp Bubble */}
          <div className="relative mb-6 rounded-2xl rounded-tl-none bg-white p-4 shadow-sm ring-1 ring-gray-100">
            <p className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">
              {generateMessage()}
            </p>
          </div>

          <div className="mt-auto grid grid-cols-2 gap-3">
            <button
              onClick={handleCopyText}
              className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 text-xs font-bold uppercase tracking-widest text-gray-700 transition hover:bg-gray-50"
            >
              {copied ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Copy size={16} />}
              {copied ? 'Copied!' : 'Copy Text'}
            </button>
            <button
              onClick={handleWhatsAppShare}
              disabled={selectedProducts.length === 0}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3 text-xs font-bold uppercase tracking-widest text-white shadow-md transition hover:bg-[#20bd5a] disabled:opacity-50"
            >
              <Send size={16} />
              Launch Campaign
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}