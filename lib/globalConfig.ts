import { get } from '@vercel/global-config';

// ═════════════════════════════════════════════════════════════════════════════
// lib/globalConfig.ts — the {custom domain → shop slug} tenant map for BYOD
// custom domains (Step 2 of the multi-tenant plan).
//
// MIGRATION NOTE (2026-08-17): Vercel renamed Edge Config to Global Config.
// @vercel/global-config is the drop-in successor to @vercel/edge-config
// (same version line, same exports: get/getAll/has/digest/createClient). The
// SDK's default client reads GLOBAL_CONFIG and falls back to EDGE_CONFIG on
// its own, and its connection-string parser accepts BOTH
// https://global-config.vercel.com/ecfg…?token=… and the legacy
// https://edge-config.vercel.com/ecfg…?token=… forms — verified against the
// installed package's dist. This module mirrors that env priority so reads
// and writes always agree on which store they target.
//
// EDGE- AND SERVER-SAFE: this module runs inside proxy.ts (Edge runtime) and
// inside route handlers (Node). It must never import Node-only APIs and it
// must NEVER throw on the middleware read path — every failure degrades to
// null so tenant routing falls through to the /api/domains/resolve fallback.
//
// READS  — @vercel/global-config SDK against the GLOBAL_CONFIG connection
//          string, EDGE_CONFIG as transition fallback (ultra-low-latency,
//          replicated to every edge region).
// WRITES — the SDK is read-only by design. Mutations go through the Vercel
//          REST API: PATCH /v1/edge-config/{id}/items with Bearer
//          VERCEL_API_TOKEN (the same token lib/vercelDomains.ts already
//          requires) and a 10s hard deadline. The store id is extracted from
//          the connection string itself (either hostname form) — no extra
//          env var. As of 2026-08-17 the @vercel/global-config README still
//          documents writes via the existing Edge Config Vercel API endpoint
//          and names NO renamed /v1/global-config write path, so we KEEP the
//          proven /v1/edge-config route — same store infrastructure, and the
//          classified no-op on failure protects us either way.
//
// UNCONFIGURED HONESTY: when GLOBAL_CONFIG/EDGE_CONFIG and/or
// VERCEL_API_TOKEN are absent (local dev), reads return null and writes
// return a classified 'not_configured' no-op result. Callers log; nothing
// ever crashes because Global Config is missing.
//
// KEY ENCODING: Global Config keys allow only [A-Za-z0-9_-], so hostnames
// (which always contain dots) are stored as `domain-{host with . → _}`.
// Normalized public hostnames are [a-z0-9.-], so the encoding is collision-
// free in practice; the DB-backed /api/domains/resolve fallback self-heals
// any theoretical miss because Postgres, not Global Config, owns the truth.
// ═════════════════════════════════════════════════════════════════════════════

const VERCEL_API_BASE = 'https://api.vercel.com';
const WRITE_DEADLINE_MS = 10_000;

// Global Config caps keys at 256 chars; `domain-` + encoding stays comfortably
// under it for every real hostname (DNS caps names at 253).
const MAX_HOST_LENGTH = 240;

/** ENV PRIORITY — LOUD AND DELIBERATE: GLOBAL_CONFIG first, EDGE_CONFIG as
 *  the transition fallback. This mirrors the SDK's own default-client
 *  resolution (process.env.GLOBAL_CONFIG ?? process.env.EDGE_CONFIG), so the
 *  read guard below and the write-path id extraction can never disagree with
 *  the SDK about which store is live. Once the Vercel dashboard migration
 *  lands GLOBAL_CONFIG everywhere, EDGE_CONFIG can be deleted with zero code
 *  changes here. */
function connectionString(): string | null {
  return process.env.GLOBAL_CONFIG?.trim() || process.env.EDGE_CONFIG?.trim() || null;
}

// ─── Hostname normalization (shared by proxy.ts and the resolve route) ──────

/**
 * Normalizes a raw Host header / query value into a canonical lowercase
 * hostname: trims, lowercases, strips a :port suffix and any trailing dot.
 * Returns null when the input is empty, too long (>253), an IP-literal
 * bracket form, or fails the DNS hostname shape (labels of [a-z0-9-] with at
 * least one dot — single-label hosts like `localhost` are platform hosts,
 * never tenants). This is the ONLY gate user-supplied host strings pass
 * before reaching the database or Global Config, so the shape check also
 * guarantees no ilike/URL metacharacters survive.
 */
export function normalizeTenantHost(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  let host = raw.trim().toLowerCase();
  if (!host || host.startsWith('[')) return null; // IPv6 literals are never tenants
  host = host.replace(/:\d+$/, '').replace(/\.$/, '');
  if (!host || host.length > 253) return null;
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host)) return null;
  return host;
}

/** `jambaba.gm` → `domain-jambaba_gm` (Global Config keys forbid dots). */
function tenantKey(host: string): string | null {
  const normalized = normalizeTenantHost(host);
  if (!normalized || normalized.length > MAX_HOST_LENGTH) return null;
  return `domain-${normalized.replace(/\./g, '_')}`;
}

// ─── Reads (middleware hot path — NEVER throws) ─────────────────────────────

/**
 * Global Config lookup: hostname → shop slug. Returns null when the store is
 * not configured (GLOBAL_CONFIG and EDGE_CONFIG unset), the host is
 * malformed, the key is absent, or the read fails for ANY reason — the
 * middleware falls back to /api/domains/resolve, so a null here is routing
 * information, not an error.
 */
export async function readTenantSlug(host: string): Promise<string | null> {
  if (!connectionString()) return null;
  const key = tenantKey(host);
  if (!key) return null;
  try {
    const value = await get<string>(key);
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  } catch {
    // Connection-string parse failures, network blips, SDK errors — all of
    // them degrade to "not in Global Config". The middleware path must never
    // pay an exception for a cache miss.
    return null;
  }
}

// ─── Writes (Vercel REST API — the SDK is read-only) ────────────────────────

export type GlobalConfigWriteResult =
  | { ok: true }
  | {
      ok: false;
      /** 'not_configured' | 'invalid_host' | 'upstream_timeout' |
       *  'upstream_unreachable' | 'http_{status}' */
      code: string;
      message: string;
    };

type WriteEnv = { token: string; configId: string; teamId: string | null };

/** Extracts the store id from the connection string. Handles BOTH hostname
 *  forms — https://global-config.vercel.com/<id>?token=… and the legacy
 *  https://edge-config.vercel.com/<id>?token=… — because the id is the first
 *  path segment in either. Null when unset/malformed. No extra env var. */
function readWriteEnv(): WriteEnv | null {
  const token = process.env.VERCEL_API_TOKEN?.trim();
  const connection = connectionString();
  if (!token || !connection) return null;
  let configId: string;
  try {
    configId = new URL(connection).pathname.replace(/^\/+/, '').split('/')[0] ?? '';
  } catch {
    return null;
  }
  if (!configId) return null;
  return { token, configId, teamId: process.env.VERCEL_TEAM_ID?.trim() || null };
}

type GlobalConfigItemOp =
  | { operation: 'upsert'; key: string; value: string }
  | { operation: 'delete'; key: string };

/** PATCH /v1/edge-config/{id}/items with a 10s hard deadline. Classifies
 *  every failure instead of throwing; never logs the token.
 *  ENDPOINT DECISION (2026-08-17): kept on /v1/edge-config — the installed
 *  @vercel/global-config@1.5.1 README documents no /v1/global-config write
 *  path, and the store infrastructure is unchanged by the rename. */
async function patchItems(items: GlobalConfigItemOp[]): Promise<GlobalConfigWriteResult> {
  const env = readWriteEnv();
  if (!env) {
    return {
      ok: false,
      code: 'not_configured',
      message: 'Global Config writes require GLOBAL_CONFIG (or EDGE_CONFIG) and VERCEL_API_TOKEN.',
    };
  }

  const teamQuery = env.teamId ? `?teamId=${encodeURIComponent(env.teamId)}` : '';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WRITE_DEADLINE_MS);
  try {
    let res: Response;
    try {
      res = await fetch(
        `${VERCEL_API_BASE}/v1/edge-config/${encodeURIComponent(env.configId)}/items${teamQuery}`,
        {
          method: 'PATCH',
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${env.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ items }),
          cache: 'no-store',
        }
      );
    } catch (err) {
      if (controller.signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
        return { ok: false, code: 'upstream_timeout', message: 'Global Config write timed out after 10 seconds.' };
      }
      return { ok: false, code: 'upstream_unreachable', message: 'Could not reach the Vercel API for the Global Config write.' };
    }

    if (res.ok) return { ok: true };

    let message = `Global Config write failed with status ${res.status}.`;
    try {
      const body = (await res.json()) as { error?: { message?: string } } | null;
      if (typeof body?.error?.message === 'string' && body.error.message) {
        message = body.error.message.slice(0, 300);
      }
    } catch {
      // Non-JSON error body — the status-based message stands.
    }
    return { ok: false, code: `http_${res.status}`, message };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Writes {domain → slug} into the tenant map. Classified no-op when
 * unconfigured; callers console.error on failure and NEVER let the result
 * affect their own response (domain status must not 500 because Global
 * Config hiccuped).
 */
export async function upsertTenantMapping(domain: string, slug: string): Promise<GlobalConfigWriteResult> {
  const key = tenantKey(domain);
  if (!key) return { ok: false, code: 'invalid_host', message: `Not a mappable hostname: "${domain}".` };
  const cleanSlug = slug.trim();
  if (!cleanSlug) return { ok: false, code: 'invalid_host', message: 'Refusing to map a domain to an empty slug.' };
  return patchItems([{ operation: 'upsert', key, value: cleanSlug }]);
}

/**
 * Removes a domain from the tenant map. A failure here is harmless drift:
 * once the domain is detached from the Vercel project, requests for it never
 * reach this deployment, so a stale mapping can never serve traffic.
 */
export async function removeTenantMapping(domain: string): Promise<GlobalConfigWriteResult> {
  const key = tenantKey(domain);
  if (!key) return { ok: false, code: 'invalid_host', message: `Not a mappable hostname: "${domain}".` };
  return patchItems([{ operation: 'delete', key }]);
}
