import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// ─────────────────────────────────────────────────────────────────────────────
// /api/site-revalidate — the tag-bust channel for writes that do NOT pass
// through a server route, so they cannot call revalidateTag themselves:
//
//   OWNER PATH (cookie session): the dashboard edits/deletes products with the
//   browser Supabase client (dashboard/edit/[id], dashboard/products,
//   dashboard home). After a successful write the dashboard fires this
//   endpoint fire-and-forget; the verified session user id IS the shop id
//   (shops are keyed on the owner's auth id), so the caller can only ever
//   bust their own `site:{shopId}` entries.
//
//   BUYER PATH (anonymous, body.shopId): checkout decrements stock via the
//   anon decrement_stock RPC — no cookie, no server route. The shopId is
//   validated against a real shops row before busting, so the worst an abuser
//   can do is expire a cache entry that rebuilds in one query on the next
//   request (the data itself is public). This keeps /site stock badges honest
//   right after a purchase instead of waiting out the 300s backstop.
// ─────────────────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: async () => (await cookies()).getAll(),
          setAll: async (cookiesToSet) => {
            const cookieStore = await cookies();
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    // Owner path — network-verified session, scope locked to the caller's shop.
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      revalidateTag(`site:${user.id}`, 'max');
      return NextResponse.json({ ok: true, scope: 'owner' });
    }

    // Buyer path — validated shopId only.
    const body = await req.json().catch(() => null);
    const shopId = typeof body?.shopId === 'string' ? body.shopId.trim() : '';
    if (!UUID_RE.test(shopId)) {
      return NextResponse.json({ error: 'shopId required.' }, { status: 400 });
    }

    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: shop } = await anon.from('shops').select('id').eq('id', shopId).maybeSingle();
    if (!shop) {
      return NextResponse.json({ error: 'Unknown shop.' }, { status: 404 });
    }

    revalidateTag(`site:${shop.id}`, 'max');
    return NextResponse.json({ ok: true, scope: 'public' });
  } catch (error) {
    console.error('[site-revalidate] fatal:', error);
    return NextResponse.json({ error: 'Failed to revalidate.' }, { status: 500 });
  }
}
