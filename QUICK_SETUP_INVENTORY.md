# 🚀 Quick Setup: Inventory Deduction

## What Was Done
✅ **Implemented inventory deduction** in `components/Cart.tsx` when customers place orders

## The Updated Function

**File:** `components/Cart.tsx`  
**Function:** `handleProcessCheckout()` (lines 101-107)

```typescript
// 🚀 INVENTORY DEDUCTION: Decrement stock for each product
for (const item of shopData.items) {
  await supabase.rpc('decrement_stock', {
    product_id_param: item.productId,
    quantity_param: item.quantity,
  });
}
```

**Execution Order:**
1. Customer data inserted → ✓
2. Order created → ✓
3. Order items inserted → ✓
4. **→ Stock decremented (NEW)**
5. Cart cleared & WhatsApp opened

## What You Need to Do

### ⚠️ CRITICAL: Create RPC Function in Supabase

**Location:** `INVENTORY_DEDUCTION_RPC.sql` (in project root)

**Steps:**
1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **SQL Editor**
4. Click **New Query**
5. Copy contents of `INVENTORY_DEDUCTION_RPC.sql`
6. Paste into SQL Editor
7. Click **RUN**

**SQL Summary:**
- Creates function: `decrement_stock(product_id_param, quantity_param)`
- Uses `GREATEST(0, ...)` to prevent negative stock
- Error-safe: Logs warnings but doesn't break orders

---

## Features

| Feature | Status |
|---------|--------|
| Inventory decrements on order | ✅ Implemented |
| Stock never goes below 0 | ✅ Built in |
| Handles NULL stock values | ✅ Handled |
| Non-breaking (errors don't fail orders) | ✅ Try-catch wrapper |
| WhatsApp flow unchanged | ✅ No changes |
| Payment logic untouched | ✅ No changes |
| UI unchanged | ✅ No changes |

---

## Test It

1. Create/edit product with stock: **10 units**
2. Add to cart: **3 units**
3. Checkout → Complete order
4. Check Supabase `products` table
5. Verify stock: **10 - 3 = 7 units** ✓

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Function not found error | Verify `decrement_stock()` RPC was created in Supabase |
| Stock still shows old value | Wait a moment for update, refresh browser |
| Order fails on checkout | Check browser console for RPC errors |

---

## Documentation

- **Full Implementation Details:** `INVENTORY_DEDUCTION_IMPLEMENTATION.md`
- **SQL Function:** `INVENTORY_DEDUCTION_RPC.sql`
- **Modified File:** `components/Cart.tsx` (lines 101-107)

---

**Status:** ✅ Ready for production (after RPC is created)
