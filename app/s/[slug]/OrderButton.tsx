'use client'; // This tells Next.js this is an interactive component

import { useState } from 'react';

export default function OrderButton({ product, storeId, storePhone }: any) {
  const [loading, setLoading] = useState(false);

  const handleOrder = async () => {
    setLoading(true);

    try {
      // 1. Record the order in your database
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: storeId,
          product_id: product.id,
          product_name: product.name,
          price_d: product.price_d,
        }),
      });

      if (!response.ok) {
        let message = 'Unable to place order right now.';
        try {
          const payload = await response.json();
          if (payload?.error) message = payload.error;
        } catch {
          // Keep default message if response body is not JSON.
        }
        throw new Error(message);
      }

      if (!storePhone) {
        throw new Error('Seller WhatsApp number is not available.');
      }

      // 2. Open WhatsApp with a pre-filled message
      const message = `Hello! I want to order ${product.name} for D${product.price_d}`;
      const whatsappUrl = `https://wa.me/${storePhone}?text=${encodeURIComponent(message)}`;
      
      window.location.href = whatsappUrl;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error placing order. Check your connection.';
      alert(message);
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