'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

// 1. Define what a single item in our cart looks like
export type CartItem = {
  id: string;
  name: string;
  price: number;
  image_url: string;
  shop_id: string; // To make sure they checkout from the same shop
  shop_name: string;
  quantity: number;
};

// 2. Define all the powers our Cart Brain has
type CartContextType = {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  cartTotal: number;
  cartCount: number;
};

// 3. Create the actual Context (The Brain)
const CartContext = createContext<CartContextType | undefined>(undefined);

// 4. Create the Provider (The wrapper that shares the Brain with the app)
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load cart from phone memory (localStorage) when the app starts
  useEffect(() => {
    const savedCart = localStorage.getItem('sanndikaa_cart');
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {
        console.error("Failed to parse cart");
      }
    }
    setIsLoaded(true);
  }, []);

  // Save cart to phone memory whenever it changes
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('sanndikaa_cart', JSON.stringify(cart));
    }
  }, [cart, isLoaded]);

  const addToCart = (newItem: CartItem) => {
    setCart((prevCart) => {
      // Check if the item is already in the cart
      const existingItem = prevCart.find((item) => item.id === newItem.id);
      
      if (existingItem) {
        // If it is, just add 1 to the quantity
        return prevCart.map((item) =>
          item.id === newItem.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      // If it's not, add it to the cart as a new item
      return [...prevCart, { ...newItem, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity < 1) return; // Don't allow negative or zero items
    setCart((prevCart) =>
      prevCart.map((item) => (item.id === id ? { ...item, quantity } : item))
    );
  };

  const clearCart = () => setCart([]);

  // Calculate the total price of everything in the cart
  const cartTotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);
  
  // Calculate how many items total are in the cart
  const cartCount = cart.reduce((count, item) => count + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, cartTotal, cartCount }}
    >
      {children}
    </CartContext.Provider>
  );
}

// 5. Create a custom Hook so any page can easily tap into the Cart Brain
export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}