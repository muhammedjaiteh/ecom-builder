'use client'; // This tells Next.js this is an interactive component

import { useState } from 'react';

export default function OrderButton({ product, storeId, storePhone }: any) {
  const [loading, setLoading] = useState(false);

  const handleOrder = async () => {
    setLoading(true);

    try {
      // 1. Record the order in your database
      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: storeId,
          product_id: product.id,
          product_name: product.name,
          price_d: product.price_d,
        }),
      });

      // 2. Open WhatsApp with a pre-filled message
      const message = `Hello! I want to order ${product.name} for D${product.price_d}`;
      const whatsappUrl = `https://wa.me/${storePhone}?text=${encodeURIComponent(message)}`;
      
      window.location.href = whatsappUrl;
    } catch (error) {
      alert("Error placing order. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleOrder}
      disabled={loading}
      className="w-full bg-green-500 text-white py-3 rounded-lg font-bold mt-4 active:scale-95 transition-transform"
    >
      {loading ? 'Processing...' : '🛒 Order on WhatsApp'}
    </button>
  );
}