# Sanndikaa Architecture & Rules
- **Framework:** Next.js (App Router), React, Tailwind CSS, Lucide Icons.
- **Database & Auth:** Supabase (Client-side components).
- **Security (Zero-Trust):** All new signups are strictly saved as `subscription_tier: 'pending'`. 
- **Dashboard Lock:** `app/dashboard/layout.tsx` blocks any user with a `pending` status from accessing the app.
- **Checkout:** No automated payment gateways. We use WhatsApp dynamic URL generation for invoices.
- **Rule:** NEVER change the `pending` default in the register route. NEVER bypass the `dashboard/layout.tsx` lock.