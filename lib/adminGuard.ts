// ─────────────────────────────────────────────────────────────────────────────
// CEO Vault — the ONE admin identity verdict, shared by all three walls:
//
//   Wall 1 (UX)            proxy.ts            — /admin paths fail-closed to
//                                                /dashboard unless verdict.any
//                                                (role OR pinned email). Cheap:
//                                                app_metadata + email ride the
//                                                session; zero extra queries.
//   Wall 2 (AUTHORITATIVE) /api/admin/*        — every route requires
//                                                verdict.strict (role AND
//                                                pinned email) before any
//                                                service-role touch; 403
//                                                otherwise.
//   Wall 3 (HONESTY)       app/admin/page.tsx  — a CEO who passed the email
//                                                wall but lacks the role claim
//                                                sees the one-time setup SQL
//                                                instead of a mysterious 403
//                                                loop.
//
// This module is deliberately PURE (no next/headers, no supabase client): it
// must import cleanly into the edge proxy, node API routes, and the client
// admin page alike.
// ─────────────────────────────────────────────────────────────────────────────

// ⚠️ LOUD MIGRATION NOTE — SET ADMIN_EMAIL IN THE ENVIRONMENT.
// This literal is a FALLBACK ONLY so the CEO is never bricked mid-migration
// (the env var may not exist yet on Vercel / .env.local). The moment
// ADMIN_EMAIL is set in .env.local AND in the Vercel project env, this
// hardcoded value stops mattering. Do not add new references to it.
const FALLBACK_ADMIN_EMAIL = 'muhammedjaiteh419@gmail.com';

/** The pinned admin email: process.env.ADMIN_EMAIL when set, else the
 *  migration fallback above. Normalized for comparison. NOTE: on the client
 *  bundle ADMIN_EMAIL (a server-only env) is always undefined — client code
 *  must therefore only trust `verdict.role`; the email wall is a SERVER
 *  judgment (proxy + API routes). */
export function pinnedAdminEmail(): string {
  return (process.env.ADMIN_EMAIL || FALLBACK_ADMIN_EMAIL).toLowerCase().trim();
}

/** Structural user shape — matches @supabase/supabase-js `User` (server and
 *  browser clients alike) without importing it, keeping this module pure. */
export type AdminUserLike = {
  email?: string | null;
  app_metadata?: { [key: string]: unknown } | null;
} | null | undefined;

export type AdminVerdict = {
  /** app_metadata.role === 'ceo' — the durable claim (survives email changes). */
  role: boolean;
  /** user.email matches ADMIN_EMAIL (env, with migration fallback). */
  emailPinned: boolean;
  /** role AND emailPinned — the authoritative API wall. */
  strict: boolean;
  /** role OR emailPinned — the proxy UX wall (fail-closed redirect otherwise). */
  any: boolean;
};

export function resolveAdmin(user: AdminUserLike): AdminVerdict {
  const role = user?.app_metadata?.role === 'ceo';
  const email = (user?.email ?? '').toLowerCase().trim();
  const emailPinned = email.length > 0 && email === pinnedAdminEmail();
  return { role, emailPinned, strict: role && emailPinned, any: role || emailPinned };
}
