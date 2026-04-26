import { NextResponse } from 'next/server';

// ============================================================
// DEPRECATED — This route has been split into two focused routes:
//   POST /api/ai/remove-bg  → background removal (Step 1)
//   POST /api/ai/generate-bg → background synthesis (Step 2)
//
// The split avoids serverless timeout failures caused by the
// mandatory 7-second inter-step pause for Replicate rate limits.
// ============================================================
export async function POST() {
  return NextResponse.json(
    {
      error:
        'This endpoint is deprecated. Use /api/ai/remove-bg and /api/ai/generate-bg instead.',
    },
    { status: 410 }
  );
}
