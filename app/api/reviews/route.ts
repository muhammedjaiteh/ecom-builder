import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHmac, randomUUID } from 'crypto';
import { z } from 'zod';
import { canonicalPhoneKey } from '@/lib/orderFlow';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/reviews — frictionless VERIFIED buyer reviews (no auth account).
//
// Buyers on this platform are NOT auth users: checkout writes
// customers(phone_number) → orders → order_items. Purchase proof is therefore
// a PHONE match, executed entirely server-side with the service role (the
// reviews table + its RLS live out-of-repo — this route is RLS-immune by
// design):
//
//   zod-validate → canonicalPhoneKey() BOTH sides (customers.phone_number is
//   stored RAW) → three PLAIN reads (order_items by product → orders, drop
//   cancelled → customers) — never FK embeds (PGRST201 precedent: the live DB
//   carries multiple relationships between these tables) → a key match proves
//   purchase → HMAC-SHA256 phone hash (pepper: REVIEW_PHONE_PEPPER ?? the
//   service key; the raw phone is NEVER stored) → INSERT with
//   verified_purchase = true → unique-violation 23505 → 409 "already
//   reviewed".
//
// Media (Vercel-body-cap-safe): this route mints ≤4 createSignedUploadUrl
// tokens under review-media/verified/{reviewId}/ — the browser uploads
// straight to storage with uploadToSignedUrl (the token IS the
// authorization; the bucket's authenticated-only INSERT policy is bypassed
// by design), then POST /api/reviews/media confirms what actually landed.
// A text review therefore survives a dead 2G upload (Gambia Standard —
// progressive enhancement).
//
// Impersonation (knowing a buyer's phone lets you post that buyer's ONE
// review for a product they truly bought) is an accepted launch risk; OTP is
// the documented future hardening.
//
// The in-memory IP limiter below is ADVISORY (serverless instances don't
// share it) — the partial unique index on (product_id, reviewer_phone_hash)
// is the real dedupe gate.
// ─────────────────────────────────────────────────────────────────────────────

export const maxDuration = 30;

const MAX_MEDIA_SLOTS = 4;

const ReviewPayloadSchema = z.object({
  productId: z.uuid(),
  phone: z.string().trim().min(5).max(32),
  reviewerName: z.string().trim().min(2).max(80),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(3).max(2000),
  mediaCount: z.number().int().min(0).max(MAX_MEDIA_SLOTS).optional(),
});

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ── Advisory IP limiter (module-scope; the unique index is the real gate) ──
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_POSTS = 5;
const rateBuckets = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.windowStart > RATE_WINDOW_MS) {
    rateBuckets.set(ip, { count: 1, windowStart: now });
    // Opportunistic sweep so the map never grows unbounded on a long-lived
    // instance (Blind Spot Protocol: no silent memory leak).
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

/** PostgREST .in() with hundreds of uuids overruns URL limits — chunk reads. */
function chunk<T>(values: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
  return out;
}

const NO_MATCH_MESSAGE =
  'We could not find an order for this product under that phone number. Reviews here are verified purchases only — use the exact number you ordered with on WhatsApp.';

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
    const parsed = ReviewPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Please fill in your name, the phone number you ordered with, a rating, and your review.' },
        { status: 400 }
      );
    }
    const { productId, phone, reviewerName, rating, comment } = parsed.data;
    const mediaCount = parsed.data.mediaCount ?? 0;

    const phoneKey = canonicalPhoneKey(phone);
    if (!phoneKey) {
      return NextResponse.json(
        { error: 'That phone number does not look valid. Enter the number you ordered with.' },
        { status: 400 }
      );
    }

    const admin = getAdmin();

    // ── Purchase verification: three PLAIN reads, never FK embeds ──────────
    const { data: items, error: itemsError } = await admin
      .from('order_items')
      .select('order_id')
      .eq('product_id', productId)
      .limit(1000);
    if (itemsError) {
      console.error('[reviews] order_items read failed:', itemsError);
      return NextResponse.json({ error: 'Could not verify your purchase right now. Please try again.' }, { status: 500 });
    }

    const orderIds = [...new Set((items ?? []).map((i) => i.order_id as string).filter(Boolean))];
    if (orderIds.length === 0) {
      return NextResponse.json({ error: NO_MATCH_MESSAGE }, { status: 403 });
    }

    const customerIds = new Set<string>();
    for (const ids of chunk(orderIds, 100)) {
      const { data: orders, error: ordersError } = await admin
        .from('orders')
        .select('id, customer_id, status')
        .in('id', ids);
      if (ordersError) {
        console.error('[reviews] orders read failed:', ordersError);
        return NextResponse.json({ error: 'Could not verify your purchase right now. Please try again.' }, { status: 500 });
      }
      for (const order of orders ?? []) {
        // Cancelled orders never earn a review (terminal FLAKE state).
        if ((order.status ?? '').toLowerCase() === 'cancelled') continue;
        if (order.customer_id) customerIds.add(order.customer_id as string);
      }
    }
    if (customerIds.size === 0) {
      return NextResponse.json({ error: NO_MATCH_MESSAGE }, { status: 403 });
    }

    let matched = false;
    for (const ids of chunk([...customerIds], 100)) {
      const { data: customers, error: customersError } = await admin
        .from('customers')
        .select('id, phone_number')
        .in('id', ids);
      if (customersError) {
        console.error('[reviews] customers read failed:', customersError);
        return NextResponse.json({ error: 'Could not verify your purchase right now. Please try again.' }, { status: 500 });
      }
      // customers.phone_number is stored RAW ('+220 747 0187' vs '7470187') —
      // canonicalPhoneKey on BOTH sides is the one phone brain.
      if ((customers ?? []).some((c) => canonicalPhoneKey(c.phone_number as string | null) === phoneKey)) {
        matched = true;
        break;
      }
    }
    if (!matched) {
      return NextResponse.json({ error: NO_MATCH_MESSAGE }, { status: 403 });
    }

    // ── Verified: hash the phone (raw never stored) and insert ─────────────
    // Rotating REVIEW_PHONE_PEPPER (or the service key when the pepper is
    // unset) resets review dedupe — documented in sql/reviews-launch.sql.
    const pepper = process.env.REVIEW_PHONE_PEPPER ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const reviewerPhoneHash = createHmac('sha256', pepper).update(phoneKey).digest('hex');

    const { data: review, error: insertError } = await admin
      .from('reviews')
      .insert({
        product_id: productId,
        buyer_id: null,
        rating,
        comment,
        is_external: false,
        external_author: null,
        verified_purchase: true,
        reviewer_name: reviewerName,
        reviewer_phone_hash: reviewerPhoneHash,
        media_urls: [],
      })
      .select()
      .single();

    if (insertError || !review) {
      if (insertError?.code === '23505') {
        return NextResponse.json(
          { error: 'You have already reviewed this product with this phone number.' },
          { status: 409 }
        );
      }
      console.error('[reviews] insert failed:', insertError);
      return NextResponse.json(
        { error: 'Your review could not be saved. Please try again. (If this keeps happening, the review schema update may not have been applied.)' },
        { status: 500 }
      );
    }

    // ── Mint signed-upload tokens for the photo phase (≤4) ─────────────────
    // Token minting failure NEVER fails the review — the text is already
    // posted (progressive enhancement).
    const uploads: { path: string; token: string }[] = [];
    for (let i = 0; i < Math.min(mediaCount, MAX_MEDIA_SLOTS); i++) {
      const path = `verified/${review.id}/photo-${i + 1}-${randomUUID().slice(0, 8)}`;
      const { data: signed, error: signError } = await admin.storage
        .from('review-media')
        .createSignedUploadUrl(path);
      if (signError || !signed) {
        console.error('[reviews] signed upload URL failed:', signError);
        break;
      }
      uploads.push({ path: signed.path, token: signed.token });
    }

    return NextResponse.json({ review, uploads }, { status: 201 });
  } catch (error) {
    console.error('[reviews] fatal:', error);
    return NextResponse.json({ error: 'Failed to submit your review. Please try again.' }, { status: 500 });
  }
}
