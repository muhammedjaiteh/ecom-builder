import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { resolveAdmin } from '@/lib/adminGuard';
import { readTenantSlug } from '@/lib/globalConfig';
import { slugify } from '@/lib/slugify';

const PROTECTED_PREFIXES = ['/dashboard', '/admin'];

// ═════════════════════════════════════════════════════════════════════════════
// TENANT ROUTING (BYOD custom domains — Step 2)
//
// Tenancy is decided FIRST, on the Host header alone, before ANY Supabase
// session work: a buyer on a seller's custom domain must never pay the
// cookie-refresh cost, and no session cookie is ever exercised on a tenant
// host. Canonical hosts fall through to the exact pre-existing behavior.
//
// Decision tree for an unknown host:
//   1. /api/domains/resolve + /manifest.webmanifest → pass through untouched
//      (the resolve route must not recurse through this middleware; the PWA
//      manifest is linked by the root layout on every page).
//   2. host → slug: Global Config read (never throws), else ONE 5s fetch to
//      {origin}/api/domains/resolve?host= (CDN-cached, DB-backed).
//   3. No slug → rewrite to /domain-not-connected (branded page — never a
//      redirect, never a blank error).
//   4. '/', /collections*, /products* → rewrite to /site/{slug}{path}{search}
//      (URL bar unchanged; nested paths + query preserved).
//   5. Storefront /api allowlist → pass through. EVIDENCE-BASED and currently
//      EMPTY: the entire checkout runs browser → Supabase directly —
//      components/Cart.tsx (customers/orders/order_items inserts +
//      decrement_stock RPC via createBrowserClient) and lib/orderFlow.ts
//      recordLead (leads insert) — plus wa.me deep links. No storefront
//      surface calls a same-origin /api route (/api/create-order has zero
//      call sites in the repo).
//   6. /site/{OWN slug}/… → redirect to the SAME host with the prefix
//      stripped: the templates mint /site/{slug}/… links
//      (lib/siteTemplates.ts siteBasePath), so without this every nav click
//      would eject the buyer off the custom domain.
//   7. Everything else — /dashboard, /login, /register, /admin, /site/{other
//      shop} (cross-tenant snooping), all non-allowlisted /api/* — →
//      redirect to the canonical host.
//
// Static assets never reach this code: the matcher below excludes
// _next/static, _next/image, favicon.ico and media extensions, so tenant
// hosts serve optimized images through the same untouched exclusions.
// ═════════════════════════════════════════════════════════════════════════════

const CANONICAL_HOSTS = new Set(['sanndikaa.com', 'www.sanndikaa.com', 'localhost', '127.0.0.1', '::1', '[::1]']);
const TENANT_PAGE_PREFIXES = ['/collections', '/products'];
// Same-origin /api routes the storefront actually calls (see tree item 5).
const TENANT_API_ALLOWLIST: string[] = [];
const RESOLVE_DEADLINE_MS = 5_000;
const FALLBACK_CANONICAL_ORIGIN = 'https://sanndikaa.com';

/** Host header → lowercase hostname: strips :port and any trailing dot.
 *  Bracketed IPv6 literals keep their brackets ([::1]:3000 → [::1]). */
function normalizeHost(raw: string | null): string {
  const host = (raw ?? '').trim().toLowerCase();
  if (!host) return '';
  if (host.startsWith('[')) return host.replace(/^(\[[^\]]*\]).*$/, '$1');
  return host.replace(/:\d+$/, '').replace(/\.$/, '');
}

function isCanonicalHost(host: string): boolean {
  // A missing Host header fails into canonical behavior — never into tenant
  // routing, which would burn lookups on garbage.
  if (!host) return true;
  if (CANONICAL_HOSTS.has(host)) return true;
  if (host === 'vercel.app' || host.endsWith('.vercel.app')) return true;
  if (host.endsWith('.localhost')) return true;
  // Whatever the deployment says it is canonically served from is also ours.
  for (const envUrl of [process.env.PUBLIC_APP_URL, process.env.NEXT_PUBLIC_APP_URL]) {
    if (!envUrl) continue;
    try {
      if (new URL(envUrl).hostname.toLowerCase() === host) return true;
    } catch {
      // Malformed env URL — the static list still decides.
    }
  }
  return false;
}

/** Marketing/dashboard traffic on tenant hosts goes home to this origin. */
function canonicalOrigin(): string {
  for (const envUrl of [process.env.PUBLIC_APP_URL, process.env.NEXT_PUBLIC_APP_URL]) {
    if (!envUrl) continue;
    try {
      return new URL(envUrl).origin;
    } catch {
      // Malformed env URL — fall through to the hard default.
    }
  }
  return FALLBACK_CANONICAL_ORIGIN;
}

/** ONE DB-backed fallback lookup when Global Config misses: 5s hard deadline,
 *  catch-to-null. The route pass-through in the tenant handler guarantees
 *  this sub-request cannot recurse through tenant resolution. */
async function resolveSlugViaApi(request: NextRequest, host: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RESOLVE_DEADLINE_MS);
  try {
    const res = await fetch(
      `${request.nextUrl.origin}/api/domains/resolve?host=${encodeURIComponent(host)}`,
      { signal: controller.signal }
    );
    if (!res.ok) return null;
    const body = (await res.json().catch(() => null)) as { slug?: unknown } | null;
    return typeof body?.slug === 'string' && body.slug ? body.slug : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

async function handleTenantRequest(request: NextRequest, host: string): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;

  // 1. Recursion-safe pass-throughs (see decision tree).
  if (pathname === '/api/domains/resolve' || pathname === '/manifest.webmanifest') {
    return NextResponse.next();
  }

  // 2. Host → slug: Global Config first, DB-backed resolve as fallback.
  let slug = await readTenantSlug(host);
  if (!slug) slug = await resolveSlugViaApi(request, host);

  // 3. Unknown domain → branded explainer, served in place (no redirect).
  if (!slug) {
    return NextResponse.rewrite(new URL('/domain-not-connected', request.url));
  }

  // 4. Storefront pages → internal rewrite; the URL bar keeps the custom domain.
  const isStorefrontPath =
    pathname === '/' ||
    TENANT_PAGE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (isStorefrontPath) {
    const target = new URL(`/site/${slug}${pathname === '/' ? '' : pathname}`, request.url);
    target.search = search;
    return NextResponse.rewrite(target);
  }

  // 5. Storefront API allowlist (currently empty — evidence at the top).
  if (TENANT_API_ALLOWLIST.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return NextResponse.next();
  }

  // 6. /site/{slug}/… links minted by the templates: keep the buyer on the
  //    custom domain when the slug is THIS tenant's; any other slug falls
  //    through to the canonical redirect (cross-tenant snooping wall).
  if (pathname === '/site' || pathname.startsWith('/site/')) {
    const segments = pathname.split('/'); // ['', 'site', slug?, ...rest]
    const pathSlug = slugify(decodeSegment(segments[2] ?? ''));
    if (pathSlug && pathSlug === slugify(slug)) {
      const rest = segments.slice(3).join('/');
      const target = new URL(rest ? `/${rest}` : '/', request.url);
      target.search = search;
      return NextResponse.redirect(target);
    }
  }

  // 7. Everything else belongs to the platform, not the storefront.
  const canonical = new URL(canonicalOrigin());
  canonical.pathname = pathname;
  canonical.search = search;
  return NextResponse.redirect(canonical);
}

export async function proxy(request: NextRequest) {
  // Tenancy first: custom-domain traffic never touches Supabase auth below.
  const host = normalizeHost(request.headers.get('host'));
  if (!isCanonicalHost(host)) {
    return handleTenantRequest(request, host);
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  // CEO Vault — Wall 1 (UX, fail-closed): /admin is CEO-only. Redirect any
  // signed-in non-admin to their dashboard unless role-OR-pinned-email passes
  // (lib/adminGuard.ts). Cheap by design: app_metadata and email ride the
  // session — no extra queries. The AUTHORITATIVE wall (role AND email) lives
  // in every /api/admin/* route; this one only shapes navigation.
  if (user && pathname.startsWith('/admin')) {
    const verdict = resolveAdmin(user);
    if (!verdict.any) {
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = '/dashboard';
      return NextResponse.redirect(dashboardUrl);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
