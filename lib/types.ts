// Consolidated types for the Sanndikaa platform

export type Product = {
  id: string;
  name: string;
  price: number;
  description?: string | null;
  image_url?: string | null;
  image_urls?: string[] | null;
  colors?: string[] | null;
  sizes?: string[] | null;
  category?: string;
  stock_quantity?: number | null;
  user_id?: string;
  created_at?: string;
};

export type Shop = {
  id: string;
  shop_name: string | null;
  shop_slug: string | null;
  banner_url: string | null;
  logo_url: string | null;
  bio: string | null;
  store_layout: string | null;
  theme_color: string | null;
  offers_delivery: boolean | null;
  offers_pickup: boolean | null;
  pickup_instructions: string | null;
  subscription_tier: string;
  ai_credits: number;
};

export type OrderItem = {
  id?: string;
  quantity: number;
  price?: number;
  variant_details?: string;
  products?: {
    id?: string;
    name: string;
    image_url: string | null;
  };
};

export type Order = {
  id: string;
  shop_id: string;
  total_amount: number;
  status: 'new' | 'processing' | 'shipped' | 'completed' | 'cancelled' | 'pending';
  fulfillment_method?: 'delivery' | 'pickup';
  created_at: string;
  customers: {
    name: string;
    phone_number: string;
    location: string;
  };
  order_items: OrderItem[];
};

export type CustomerCRM = {
  phone: string;
  name: string;
  location: string;
  totalSpent: number;
  orderCount: number;
  lastOrderDate: string;
};

export type CartItem = {
  id: string;
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

export type ProductVariant = {
  variant_name: string;
  variant_value: string;
};
