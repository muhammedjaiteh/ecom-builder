import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/reviews/media { reviewId } — phase two of the buyer review flow.
//
// After the browser uploads photos straight to storage with the signed
// tokens minted by POST /api/reviews, this route CONFIRMS: it LISTS
// review-media/verified/{reviewId}/ (trusting ONLY what actually exists in
// storage — never client-claimed URLs), drops anything over 8MB or with a
// non-image MIME (server-side authority; the client checks are advisory),
// removes the offenders from storage, and writes the surviving public URLs
// onto the review row via the service role.
//
// Scope guard: only reviews minted by the buyer pipeline
// (reviewer_phone_hash IS NOT NULL) are touched — replaying a dashboard
// seller-mode review id here would otherwise overwrite its media_urls with
// the (empty) contents of a storage prefix it never used.
//
// Idempotent + abuse-safe: uploads into the prefix require a signed token
// scoped to an exact path, and re-running simply re-syncs the row to what
// storage holds.
// ─────────────────────────────────────────────────────────────────────────────

export const maxDuration = 30;

const MAX_MEDIA_URLS = 4;
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB
// image/* minus SVG (scriptable) — the buyer form captures photos only.
const ALLOWED_MIME_PREFIX = 'image/';
const BLOCKED_MIMES = new Set(['image/svg+xml']);

const MediaConfirmSchema = z.object({
  reviewId: z.uuid(),
});

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = MediaConfirmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'A valid reviewId is required.' }, { status: 400 });
    }
    const { reviewId } = parsed.data;

    const admin = getAdmin();

    const { data: review, error: readError } = await admin
      .from('reviews')
      .select('id, reviewer_phone_hash')
      .eq('id', reviewId)
      .maybeSingle();
    if (readError) {
      console.error('[reviews/media] review read failed:', readError);
      return NextResponse.json({ error: 'Could not attach your photos right now. Please retry.' }, { status: 500 });
    }
    if (!review || !review.reviewer_phone_hash) {
      // Missing row OR a dashboard/legacy review outside this pipeline.
      return NextResponse.json({ error: 'Review not found.' }, { status: 404 });
    }

    const prefix = `verified/${reviewId}`;
    const { data: objects, error: listError } = await admin.storage
      .from('review-media')
      .list(prefix, { limit: 20 });
    if (listError) {
      console.error('[reviews/media] storage list failed:', listError);
      return NextResponse.json({ error: 'Could not attach your photos right now. Please retry.' }, { status: 500 });
    }

    const surviving: string[] = [];
    const rejectedPaths: string[] = [];
    for (const obj of objects ?? []) {
      if (!obj.name) continue;
      const path = `${prefix}/${obj.name}`;
      const meta = (obj.metadata ?? {}) as { size?: number; mimetype?: string };
      const size = typeof meta.size === 'number' ? meta.size : Number.MAX_SAFE_INTEGER;
      const mime = (meta.mimetype ?? '').toLowerCase();
      const isAllowed =
        size <= MAX_FILE_BYTES &&
        mime.startsWith(ALLOWED_MIME_PREFIX) &&
        !BLOCKED_MIMES.has(mime) &&
        surviving.length < MAX_MEDIA_URLS;
      if (isAllowed) {
        surviving.push(admin.storage.from('review-media').getPublicUrl(path).data.publicUrl);
      } else {
        rejectedPaths.push(path);
      }
    }

    if (rejectedPaths.length > 0) {
      // Best-effort cleanup — a lingering oversized object must not block the
      // confirmation of the photos that DID pass.
      const { error: removeError } = await admin.storage.from('review-media').remove(rejectedPaths);
      if (removeError) console.error('[reviews/media] rejected-file cleanup failed:', removeError);
    }

    const { error: updateError } = await admin
      .from('reviews')
      .update({ media_urls: surviving })
      .eq('id', reviewId);
    if (updateError) {
      console.error('[reviews/media] media_urls update failed:', updateError);
      return NextResponse.json({ error: 'Your photos uploaded but could not be attached. Please retry.' }, { status: 500 });
    }

    return NextResponse.json({ mediaUrls: surviving, rejected: rejectedPaths.length });
  } catch (error) {
    console.error('[reviews/media] fatal:', error);
    return NextResponse.json({ error: 'Could not attach your photos right now. Please retry.' }, { status: 500 });
  }
}
