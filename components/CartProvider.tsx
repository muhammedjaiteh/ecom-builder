'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export type CartItem = {
  id: string; // Unique ID (Product ID + Variants) so Size 9 and Size 10 don't overwrite each other
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image_url: string;
  shop_id: string;
  shop_name: string;
  shop_whatsapp: string;
  variant_details: string;
};

type CartContextType = {
  items: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  setIsCartOpen: (isOpen: boolean) => void;
  cartTotal: number;
  cartCount: number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // 1. Load the cart from the browser's memory when the user arrives
  useEffect(() => {
    const savedCart = localStorage.getItem('sanndikaa_cart');
    if (savedCart) {
      try {
        setItems(JSON.parse(savedCart));
      } catch (e) {
        console.error("Failed to parse cart");
      }
    }
    setIsLoaded(true);
  }, []);

  // 2. Save the cart to memory every time they add or remove an item
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('sanndikaa_cart', JSON.stringify(items));
    }
  }, [items, isLoaded]);

  const addToCart = (newItem: CartItem) => {
    setItems((prev) => {
      // Check if this exact item (same product + same size/color) is already in the cart
      const existingItemIndex = prev.findIndex((i) => i.id === newItem.id);
      
      if (existingItemIndex >= 0) {
        // If it exists, just increase the quantity
        const updated = [...prev];
        updated[existingItemIndex].quantity += newItem.quantity;
        return updated;
      }
      // Otherwise, add the new item
      return [...prev, newItem];
    });
    
    // Automatically slide the cart open so they see it worked
    setIsCartOpen(true);
  };

  const removeFromCart = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity < 1) return;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantity } : i)));
  };

  const clearCart = () => setItems([]);

  const cartTotal = items.reduce((total, item) => total + item.price * item.quantity, 0);
  const cartCount = items.reduce((count, item) => count + item.quantity, 0);

  return (
    <CartContext.Provider 
      value={{ 
        items, 
        addToCart, 
        removeFromCart, 
        updateQuantity, 
        clearCart, 
        isCartOpen, 
        setIsCartOpen,
        cartTotal,
        cartCount
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

// A custom hook so any page can instantly access the cart
export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}