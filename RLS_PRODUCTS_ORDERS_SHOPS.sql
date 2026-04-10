-- STRICT RLS HARDENING: products, shops, orders
-- Run this in Supabase SQL Editor.

begin;

-- 1) Enable RLS
alter table if exists public.products enable row level security;
alter table if exists public.shops enable row level security;
alter table if exists public.orders enable row level security;

-- 2) Drop existing policies for clean re-apply
-- PRODUCTS
DROP POLICY IF EXISTS "products_public_read" ON public.products;
DROP POLICY IF EXISTS "products_owner_insert" ON public.products;
DROP POLICY IF EXISTS "products_owner_update" ON public.products;
DROP POLICY IF EXISTS "products_owner_delete" ON public.products;

-- SHOPS
DROP POLICY IF EXISTS "shops_public_read" ON public.shops;
DROP POLICY IF EXISTS "shops_owner_insert" ON public.shops;
DROP POLICY IF EXISTS "shops_owner_update" ON public.shops;
DROP POLICY IF EXISTS "shops_owner_delete" ON public.shops;

-- ORDERS
DROP POLICY IF EXISTS "orders_owner_read" ON public.orders;
DROP POLICY IF EXISTS "orders_owner_update" ON public.orders;

-- 3) PRODUCTS policies
-- Anyone can read products.
CREATE POLICY "products_public_read"
ON public.products
FOR SELECT
TO anon, authenticated
USING (true);

-- Only authenticated owner can insert own products.
CREATE POLICY "products_owner_insert"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (
  (
    user_id = auth.uid()
  )
  OR
  (
    shop_id = auth.uid()
  )
);

-- Only authenticated owner can update own products.
CREATE POLICY "products_owner_update"
ON public.products
FOR UPDATE
TO authenticated
USING (
  (
    user_id = auth.uid()
  )
  OR
  (
    shop_id = auth.uid()
  )
)
WITH CHECK (
  (
    user_id = auth.uid()
  )
  OR
  (
    shop_id = auth.uid()
  )
);

-- Only authenticated owner can delete own products.
CREATE POLICY "products_owner_delete"
ON public.products
FOR DELETE
TO authenticated
USING (
  (
    user_id = auth.uid()
  )
  OR
  (
    shop_id = auth.uid()
  )
);

-- 4) SHOPS policies
-- Anyone can read shops.
CREATE POLICY "shops_public_read"
ON public.shops
FOR SELECT
TO anon, authenticated
USING (true);

-- Only authenticated owner can insert own shop.
CREATE POLICY "shops_owner_insert"
ON public.shops
FOR INSERT
TO authenticated
WITH CHECK (
  id = auth.uid()
);

-- Only authenticated owner can update own shop.
CREATE POLICY "shops_owner_update"
ON public.shops
FOR UPDATE
TO authenticated
USING (
  id = auth.uid()
)
WITH CHECK (
  id = auth.uid()
);

-- Only authenticated owner can delete own shop.
CREATE POLICY "shops_owner_delete"
ON public.shops
FOR DELETE
TO authenticated
USING (
  id = auth.uid()
);

-- 5) ORDERS policies
-- Only shop owner can read own orders.
CREATE POLICY "orders_owner_read"
ON public.orders
FOR SELECT
TO authenticated
USING (
  shop_id = auth.uid()
);

-- Only shop owner can update own orders.
CREATE POLICY "orders_owner_update"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  shop_id = auth.uid()
)
WITH CHECK (
  shop_id = auth.uid()
);
-- Allow anyone (buyers) to place an order
CREATE POLICY "orders_public_insert"
ON public.orders
FOR INSERT
TO anon, authenticated
WITH CHECK (true);
commit;
