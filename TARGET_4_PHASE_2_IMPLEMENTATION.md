# TARGET #4 — PHASE 2: INVENTORY/STOCK MANAGEMENT
## Complete Code Updates for Production

---

## ✅ COMPLETED IN CODEBASE

### 1. `app/dashboard/add/page.tsx`
- ✅ Added `const [stockQuantity, setStockQuantity] = useState('0');` to form states (line 31)
- ✅ Updated DB insert to include `stock_quantity: parseInt(stockQuantity) || 0` (line 165)

**Status:** 2/3 complete - Just need to add the UI field

---

## 🔧 MANUAL UPDATES NEEDED (Copy-Paste Ready)

### UPDATE 1: Add Stock Quantity Input Field to Add Page
**File:** `app/dashboard/add/page.tsx`  
**Location:** After the Category select (around line 240), BEFORE the `{/* 🚀 AI DESCRIPTION BOX - ENHANCED */}` comment

**COPY-PASTE THIS:**
```jsx
<div>
  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Stock Quantity</label>
  <input 
    type="number" 
    value={stockQuantity} 
    onChange={(e) => setStockQuantity(e.target.value)} 
    placeholder="0" 
    min="0" 
    className="w-full rounded-2xl border border-gray-200 bg-gray-50/50 px-5 py-4 text-sm font-medium text-gray-900 outline-none transition-all focus:border-gray-900 focus:bg-white focus:ring-1 focus:ring-gray-900" 
  />
  <p className="mt-1 text-[9px] text-gray-400">How many units are available for sale?</p>
</div>
```

---

### UPDATE 2: Edit Product Page Stock Field
**File:** `app/dashboard/edit/[id]/page.tsx`

**STEP 2A:** Add state after line 73 (after `setStatus`)
```typescript
const [stockQuantity, setStockQuantity] = useState('0');
```

**STEP 2B:** In useEffect that fetches product (around line 120), after `setStatus(...)`, add:
```typescript
setStockQuantity(productData.stock_quantity ? String(productData.stock_quantity) : '0');
```

**STEP 2C:** In the update function, inside the object being updated (find where you update name, price, etc.), add:
```typescript
stock_quantity: parseInt(stockQuantity) || 0,
```

**STEP 2D:** In the form UI, add this input field (place it near Price/Category fields):
```jsx
<div>
  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Stock Quantity</label>
  <input 
    type="number" 
    value={stockQuantity} 
    onChange={(e) => setStockQuantity(e.target.value)} 
    placeholder="0" 
    min="0"
    className="w-full rounded-2xl border border-gray-200 bg-gray-50/50 px-5 py-4 text-sm font-medium text-gray-900 outline-none transition-all focus:border-gray-900 focus:bg-white focus:ring-1 focus:ring-gray-900" 
  />
  <p className="mt-1 text-[9px] text-gray-400">How many units available?</p>
</div>
```

---

### UPDATE 3: Product Detail Page - Out of Stock Display
**File:** `app/product/[id]/ProductClient.tsx`

**STEP 3A:** Update the Product type (lines 23-34), add this line:
```typescript
stock_quantity?: number | null;
```

**STEP 3B:** In the query (around line 35-39), add `stock_quantity` to the select:
```typescript
.select(`*, shops (id, phone, shop_name, shop_slug, logo_url, offers_delivery, offers_pickup), stock_quantity`)
```

**STEP 3C:** Add this state after `const [copied, setCopied]`:
```typescript
const [isOutOfStock, setIsOutOfStock] = useState(false);
```

**STEP 3D:** Add this useEffect after the product loading useEffect:
```typescript
useEffect(() => {
  if (product?.stock_quantity !== undefined && product?.stock_quantity !== null) {
    setIsOutOfStock(product.stock_quantity === 0);
  }
}, [product]);
```

**STEP 3E:** REPLACE the entire "🟢 THE FIXED BUTTON" section (lines 150-162) with this:

```jsx
{/* Out of Stock vs Available */}
{isOutOfStock ? (
  <div className="pt-4">
    <div className="w-full rounded-full bg-red-50 border-2 border-red-200 py-4 px-6 text-center">
      <p className="text-sm font-bold text-red-700 uppercase tracking-wider">Out of Stock</p>
      <p className="text-xs text-red-600 mt-1">Check back soon for restocks!</p>
    </div>
  </div>
) : (
  <>
    {/* Fulfillment Method Selection */}
    {(shopSettings?.offers_delivery || shopSettings?.offers_pickup) && (
      <div className="pt-2 pb-4">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Fulfillment Method</p>
        <div className="flex gap-3">
          {shopSettings?.offers_delivery && (
            <button
              onClick={() => setFulfillmentMethod('delivery')}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg font-bold text-xs transition-all uppercase tracking-wider ${
                fulfillmentMethod === 'delivery'
                  ? 'bg-[#2C3E2C] text-white shadow-lg'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Truck size={16} /> Delivery
            </button>
          )}
          {shopSettings?.offers_pickup && (
            <button
              onClick={() => setFulfillmentMethod('pickup')}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg font-bold text-xs transition-all uppercase tracking-wider ${
                fulfillmentMethod === 'pickup'
                  ? 'bg-[#2C3E2C] text-white shadow-lg'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <HomeIcon size={16} /> Pickup
            </button>
          )}
        </div>
      </div>
    )}

    {/* 🟢 THE FIXED BUTTON (No more stretching) */}
    <div className="pt-4">
      <button 
        onClick={() => setShowTerminal(true)} 
        className="w-full md:w-auto bg-[#2C3E2C] hover:bg-[#1a2e1a] text-white py-4 px-10 rounded-full font-bold text-sm tracking-widest uppercase flex items-center justify-center gap-3 shadow-xl hover:shadow-2xl transition-all transform active:scale-95"
      >
        <Phone size={18} /> 
        <span>Order via WhatsApp</span>
      </button>
      <p className="text-[10px] text-gray-400 mt-4 text-center md:text-left flex items-center justify-center md:justify-start gap-1">
        <ShieldCheck size={12} /> Secure Transaction
      </p>
    </div>
  </>
)}
```

---

## 📋 SUMMARY OF ALL CHANGES

| File | Change | Status |
|------|--------|--------|
| `app/dashboard/add/page.tsx` | Add state + DB insert + UI field | 2/3 auto ✓, 1/3 manual |
| `app/dashboard/edit/[id]/page.tsx` | Add state + fetch + save + UI | Manual |
| `app/product/[id]/ProductClient.tsx` | Add type + query + UI + logic | Manual |
| Database (`products` table) | ALTER TABLE ADD stock_quantity | ✅ Done |

---

## 🧪 TEST FLOW

1. Go to `/dashboard/add`
2. Fill in product details
3. **Set Stock Quantity to 5**
4. Publish
5. Go to product page → See "Order via WhatsApp" ✅
6. Go back to edit
7. **Change stock to 0**
8. Save
9. Refresh product page → See "Out of Stock" ❌
10. Edit again, set stock to 10
11. Refresh → See checkout button again ✅

---

## 🎯 END STATE

**Buyers cannot checkout when:**
- `stock_quantity === 0` (button disabled, "Out of Stock" shown)

**Buyers CAN checkout when:**
- `stock_quantity > 0` (button enabled, can select fulfillment + order)

**No automatic stock reduction** (seller manually updates stock for now)

