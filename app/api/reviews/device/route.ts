import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/reviews/device — a review from a buyer this DEVICE recognises
// (lib/purchaseMemory: localStorage, written on every WhatsApp order handoff).
//
// WHY A ROUTE: sql/iron-dome-security.sql (P0-3) removes every anon write to
// reviews — the previous direct INSERT with is_verified = true let ANY visitor
// mint "Verified Buyer" rows for ANY product. This is now the single door for
// the device path, and it is HONEST about what it can prove: device memory is
// a client-side fact the server cannot check, so the row is minted UNVERIFIED —
//   is_verified = false · verified_purchase = false · is_external = false
//   buyer_id = NULL · reviewer_phone_hash = NULL · media_urls = []
// components/ReviewList.tsx renders it as "Buyer". The trust marks are minted
// ONLY by POST /api/reviews (server-side phone → order match).
//
// shop_id is read from the PRODUCT row (service role), never from the client,
// so a poisoned shopId cannot attach a review to another shop.
// Advisory IP limiter as in /api/reviews (serverless instances don't share it).
// ─────────────────────────────────────────────────────────────────────────────

export const maxDuration = 15;

const DevicePayloadSchema = z.object({
  productId: z.uuid(),
  reviewerName: z.string().trim().min(2).max(80),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(3).max(2000),
});

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_POSTS = 5;
const rateBuckets = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.windowStart > RATE_WINDOW_MS) {
    rateBuckets.set(ip, { count: 1, windowStart: now });
    if (rateBuckets.size > 5000) {
      for (const [key, b] of rateBuckets) {
        if (now - b.windowStart > RATE_WINDOW_MS) rateBuckets.delete(key);
      }
    }
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_MAX_POSTS;
}

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function POST(req: Request) {
  try {
    const ip = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many review attempts. Please wait a few minutes and try again.' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = DevicePayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Please add your name, a rating, and your review.' },
        { status: 400 }
      );
    }
    const { productId, reviewerName, rating, comment } = parsed.data;

    const admin = getAdmin();

    const { data: product, error: productError } = await admin
      .from('products')
      .select('id, shop_id')
      .eq('id', productId)
      .maybeSingle();
    if (productError) {
      console.error('[reviews/device] product read failed:', productError);
      return NextResponse.json({ error: 'Could not save your review right now. Please try again.' }, { status: 500 });
    }
    if (!product) {
      return NextResponse.json({ error: 'This product is no longer available.' }, { status: 404 });
    }

    const { data: review, error: insertError } = await admin
      .from('reviews')
      .insert({
        product_id: productId,
        shop_id: product.shop_id ?? null,
        buyer_id: null,
        rating,
        comment,
        reviewer_name: reviewerName,
        is_verified: false,
        is_external: false,
        external_author: null,
        verified_purchase: false,
        reviewer_phone_hash: null,
        media_urls: [],
      })
      .select('id')
      .single();

    if (insertError || !review) {
      console.error('[reviews/device] insert failed:', insertError);
      return NextResponse.json(
        { error: 'Your review could not be saved. Please try again. (If this keeps happening, the review schema update may not have been applied.)' },
        { status: 500 }
      );
    }

    return NextResponse.json({ review: { id: review.id } }, { status: 201 });
  } catch (error) {
    console.error('[reviews/device] fatal:', error);
    return NextResponse.json({ error: 'Failed to submit your review. Please try again.' }, { status: 500 });
  }
}
