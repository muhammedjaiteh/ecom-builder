'use client';

import type { SupabaseClient, User } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// dashboardAuth — the ONE auth gate every dashboard UI surface resolves
// through (B2: non-evicting offline auth).
//
// THE BUG THIS KILLS: every dashboard page (and the layout, re-fired per
// pathname) called supabase.auth.getUser() — a NETWORK round trip — and
// treated ANY falsy result as logged-out. On a dead radio (Gambia Standard:
// 2G, tunnels, airplane mode) the fetch failed, `user` came back null, and a
// seller with a perfectly valid local session was hard-redirected to /login
// mid-navigation.
//
// THE CONTRACT:
//   1. Resolve the session LOCALLY first (supabase.auth.getSession() reads
//      storage — no network when the token is unexpired).
//   2. Network-verify with getUser(), but CLASSIFY the failure:
//        · genuine no-session / definitive rejection (revoked, invalid,
//          401/403 verdicts)                → 'unauthenticated' → redirect.
//        · transport failure (AuthRetryableFetchError, fetch TypeError,
//          navigator.onLine === false) WITH a local session present
//                                           → authenticated-offline: return
//                                             the cached user, NEVER redirect.
//
// CLASSIFICATION MATRIX (session × network → outcome):
//   no local session   × any network state  → unauthenticated (redirect)
//   local session      × verify OK          → authenticated, verified: true
//   local session      × transport failure  → authenticated, verified: false
//   local session      × definitive reject  → unauthenticated (redirect)
//
// SCOPE: UI gating ONLY. Every server API route (websites/*, domains,
// products, orders…) keeps its own cookie-verified auth.getUser() — a forged
// or expired session can render cached dashboard chrome offline but can never
// read or write anything through the APIs.
// ─────────────────────────────────────────────────────────────────────────────

export type DashboardAuthResult =
  | {
      status: 'authenticated';
      user: User;
      /** false = offline/transport failure with a local session — the cached
       *  user is being trusted for UI gating until the network returns. */
      verified: boolean;
    }
  | { status: 'unauthenticated' };

/** Transport-class auth failure: retryable by definition — it says nothing
 *  about whether the session is valid. supabase-js throws/returns
 *  AuthRetryableFetchError (status 0) for network-layer failures; raw fetch
 *  rejects with TypeError on DNS/socket errors. */
function isAuthTransportFailure(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (!error || typeof error !== 'object') return false;
  const err = error as { name?: unknown; status?: unknown; message?: unknown };
  if (err.name === 'AuthRetryableFetchError') return true;
  if (error instanceof TypeError) return true;
  if (err.status === 0) return true;
  const message = typeof err.message === 'string' ? err.message.toLowerCase() : '';
  return (
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('load failed') ||
    message.includes('fetch failed')
  );
}

export async function resolveDashboardUser(
  supabase: SupabaseClient
): Promise<DashboardAuthResult> {
  // 1. LOCAL truth — storage read; only refreshes over the network when the
  //    access token has expired, and that refresh failing is itself classified
  //    below via the getUser() attempt.
  let localUser: User | null = null;
  try {
    const { data } = await supabase.auth.getSession();
    localUser = data.session?.user ?? null;
  } catch (error) {
    // getSession threw (storage corruption or a failed mid-call refresh) —
    // no local user emerges either way; classification continues below.
    console.error('[dashboard-auth] getSession failed:', error instanceof Error ? error.message : error);
  }

  if (!localUser) {
    // No locally stored session at all: this is the genuine logged-out state
    // (or a signed-out device) — redirecting to /login is correct and does
    // not need the network to confirm it.
    return { status: 'unauthenticated' };
  }

  // 2. NETWORK verification — best-effort, classified.
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (user) {
      return { status: 'authenticated', user, verified: true };
    }
    if (error && isAuthTransportFailure(error)) {
      // Offline / dead socket with a real local session: authenticated-offline.
      return { status: 'authenticated', user: localUser, verified: false };
    }
    // Definitive server verdict (revoked/invalid token): honest logout.
    return { status: 'unauthenticated' };
  } catch (error) {
    if (isAuthTransportFailure(error)) {
      return { status: 'authenticated', user: localUser, verified: false };
    }
    console.error('[dashboard-auth] getUser failed non-retryably:', error instanceof Error ? error.message : error);
    return { status: 'unauthenticated' };
  }
}
