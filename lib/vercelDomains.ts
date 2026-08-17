// ═════════════════════════════════════════════════════════════════════════════
// lib/vercelDomains.ts — Vercel Domains API client for BYOD custom domains.
//
// ⛔⛔⛔ STRICTLY SERVER-ONLY ⛔⛔⛔
// This module reads VERCEL_API_TOKEN — a credential with full control over the
// production Vercel project. It must NEVER be imported from a client component
// ('use client'), a shared hook, or anything that can reach a browser bundle.
// Only route handlers (app/api/**) and server components may import it. A
// runtime tripwire below throws instantly if it ever lands in a client bundle.
//
// Environment (read at CALL time so serverless cold starts and local dev see
// the live process env — mirrors how SUPABASE_SERVICE_ROLE_KEY is consumed):
//   VERCEL_API_TOKEN   — required. Bearer token for api.vercel.com.
//   VERCEL_PROJECT_ID  — required. The Sanndikaa project all shops share.
//   VERCEL_TEAM_ID     — the team scope, sent as the ?teamId= query param on
//                        every call (required in practice for our Pro team;
//                        omitted from requests when unset so a personal-scope
//                        token still works).
//
// LOCAL-DEV HONESTY: when the required env is missing, callers must check
// isDomainAutomationConfigured() and return a classified 503
// 'domain automation not configured' — never crash, never pretend to attach.
//
// Every network call carries a hard 10s deadline (AbortController) and returns
// a discriminated union mirroring lib/transport.ts's classification vocabulary
// ('timeout' → upstream_timeout, network-layer failure → upstream_unreachable,
// HTTP >= 400 → Vercel's own error code/message). Raw upstream bodies and the
// token are never surfaced to callers.
// ═════════════════════════════════════════════════════════════════════════════

if (typeof window !== 'undefined') {
  throw new Error(
    'lib/vercelDomains.ts is server-only (it handles VERCEL_API_TOKEN) and must never be bundled into the client.'
  );
}

const VERCEL_API_BASE = 'https://api.vercel.com';
const UPSTREAM_DEADLINE_MS = 10_000;

/** Vercel's anycast A record for apex domains. */
export const VERCEL_APEX_A_VALUE = '76.76.21.21';
/** Vercel's CNAME target for www/subdomains. */
export const VERCEL_CNAME_VALUE = 'cname.vercel-dns.com';

// ─── Types ───────────────────────────────────────────────────────────────────

/** A TXT ownership challenge from Vercel's verification[] array (e.g. the
 *  _vercel record required when a domain is verified under another account). */
export type VerificationChallenge = {
  type: string;
  domain: string;
  value: string;
  reason?: string;
};

export type DnsRecordType = 'A' | 'CNAME' | 'TXT';

/** One row of DNS instructions, typed and ready for the future Step 3 UI. */
export type DnsRecord = {
  type: DnsRecordType;
  name: string;
  value: string;
  reason?: string;
};

export type AttachDomainResult =
  | {
      ok: true;
      /** true when Vercel answered 409 = the domain was already attached to
       *  THIS project — idempotent success, not an error. */
      alreadyAttached: boolean;
      /** TXT challenges to complete before Vercel will verify the domain
       *  (present when the domain is claimed under another Vercel account). */
      verification: VerificationChallenge[];
    }
  | {
      ok: false;
      /** Vercel's error code ('domain_already_in_use', 'forbidden', …) or our
       *  transport classification ('upstream_timeout' | 'upstream_unreachable'). */
      code: string;
      message: string;
      /** TXT challenges Vercel included on the failure (surfaced verbatim for
       *  the 'domain_already_in_use' ownership-proof path). */
      verification: VerificationChallenge[];
    };

/** Composite verdict from BOTH status endpoints:
 *  /v9/projects/{id}/domains/{domain} (verified + verification[]) and
 *  /v6/domains/{domain}/config (misconfigured). */
export type DomainVerdict = {
  /** false when the project no longer has the domain attached (drift). */
  found: boolean;
  verified: boolean;
  misconfigured: boolean;
  verification: VerificationChallenge[];
};

export type DomainStatusResult =
  | { ok: true; verdict: DomainVerdict }
  | { ok: false; code: string; message: string };

export type RemoveDomainResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

// ─── Env + transport plumbing ────────────────────────────────────────────────

type VercelEnv = { token: string; projectId: string; teamId: string | null };

function readEnv(): VercelEnv | null {
  const token = process.env.VERCEL_API_TOKEN?.trim();
  const projectId = process.env.VERCEL_PROJECT_ID?.trim();
  if (!token || !projectId) return null;
  return { token, projectId, teamId: process.env.VERCEL_TEAM_ID?.trim() || null };
}

/** Callers gate on this BEFORE any Vercel call: when false, return a
 *  classified 503 'domain automation not configured' (local-dev honesty). */
export function isDomainAutomationConfigured(): boolean {
  return readEnv() !== null;
}

function withTeam(path: string, env: VercelEnv): string {
  if (!env.teamId) return path;
  return `${path}${path.includes('?') ? '&' : '?'}teamId=${encodeURIComponent(env.teamId)}`;
}

type VercelFetchResult =
  | { ok: true; status: number; body: unknown }
  | { ok: false; kind: 'timeout' | 'network' };

/** fetch with a 10s hard deadline; classifies transport failures instead of
 *  throwing (mirror of lib/transport.ts, server-side). Never logs the token. */
async function vercelFetch(env: VercelEnv, path: string, init: RequestInit = {}): Promise<VercelFetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_DEADLINE_MS);
  try {
    let res: Response;
    try {
      res = await fetch(`${VERCEL_API_BASE}${withTeam(path, env)}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${env.token}`,
          'Content-Type': 'application/json',
          ...(init.headers ?? {}),
        },
        cache: 'no-store',
      });
    } catch (err) {
      if (controller.signal.aborted) return { ok: false, kind: 'timeout' };
      if (err instanceof DOMException && err.name === 'AbortError') return { ok: false, kind: 'timeout' };
      return { ok: false, kind: 'network' };
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = undefined; // 204s and non-JSON errors — status alone classifies
    }
    return { ok: true, status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

// ─── Response parsing (defensive — never trust upstream shape) ──────────────

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function parseChallenges(raw: unknown): VerificationChallenge[] {
  if (!Array.isArray(raw)) return [];
  const out: VerificationChallenge[] = [];
  for (const entry of raw) {
    const rec = asRecord(entry);
    if (!rec) continue;
    const { type, domain, value, reason } = rec;
    if (typeof type !== 'string' || typeof domain !== 'string' || typeof value !== 'string') continue;
    out.push({ type, domain, value, ...(typeof reason === 'string' ? { reason } : {}) });
  }
  return out;
}

/** Extracts { code, message, verification } from a Vercel error body without
 *  ever passing the raw body through (message capped, code whitelist-shaped). */
function parseVercelError(status: number, body: unknown): { code: string; message: string; verification: VerificationChallenge[] } {
  const root = asRecord(body);
  const err = asRecord(root?.error);
  const code = typeof err?.code === 'string' && err.code ? err.code : `http_${status}`;
  const rawMessage = typeof err?.message === 'string' && err.message
    ? err.message
    : `Vercel API request failed with status ${status}.`;
  // Challenges may ride on error.verification or the body root depending on
  // the endpoint version — check both, verbatim.
  const verification = parseChallenges(err?.verification ?? root?.verification);
  return { code, message: rawMessage.slice(0, 500), verification };
}

const TRANSPORT_FAILURE = {
  timeout: { code: 'upstream_timeout', message: 'Vercel did not answer within 10 seconds.' },
  network: { code: 'upstream_unreachable', message: 'Could not reach the Vercel API.' },
} as const;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * POST /v10/projects/{PROJECT_ID}/domains — attach a domain to the project.
 *   · 2xx        → attached; body.verification carries TXT challenges when the
 *                  domain is verified under ANOTHER Vercel account.
 *   · 409        → already attached to THIS project = idempotent success.
 *   · other 4xx  → failure with Vercel's error code/message; any TXT
 *                  challenges on the error body are surfaced verbatim
 *                  ('domain_already_in_use' ownership-proof path).
 */
export async function attachDomain(domain: string): Promise<AttachDomainResult> {
  const env = readEnv();
  if (!env) {
    return { ok: false, code: 'not_configured', message: 'Domain automation is not configured.', verification: [] };
  }

  const res = await vercelFetch(env, `/v10/projects/${encodeURIComponent(env.projectId)}/domains`, {
    method: 'POST',
    body: JSON.stringify({ name: domain }),
  });
  if (!res.ok) return { ok: false, ...TRANSPORT_FAILURE[res.kind], verification: [] };

  if (res.status >= 200 && res.status < 300) {
    const root = asRecord(res.body);
    return { ok: true, alreadyAttached: false, verification: parseChallenges(root?.verification) };
  }

  const parsed = parseVercelError(res.status, res.body);
  if (res.status === 409) {
    // Already attached to this project — re-POSTing the same domain must be a
    // no-op, not an error (idempotent re-attach contract).
    return { ok: true, alreadyAttached: true, verification: parsed.verification };
  }
  return { ok: false, ...parsed };
}

/**
 * Composes TWO endpoints into one typed verdict:
 *   GET /v9/projects/{PROJECT_ID}/domains/{domain} → verified + verification[]
 *   GET /v6/domains/{domain}/config                → misconfigured boolean
 * A 404 on the project-domain read means the domain is no longer attached
 * (verdict.found = false) — that is data, not an error. When the config read
 * fails, misconfigured conservatively defaults to true so a domain is never
 * reported 'active' on unknown DNS state.
 */
export async function getDomainStatus(domain: string): Promise<DomainStatusResult> {
  const env = readEnv();
  if (!env) {
    return { ok: false, code: 'not_configured', message: 'Domain automation is not configured.' };
  }

  const encoded = encodeURIComponent(domain);
  const [domainRes, configRes] = await Promise.all([
    vercelFetch(env, `/v9/projects/${encodeURIComponent(env.projectId)}/domains/${encoded}`),
    vercelFetch(env, `/v6/domains/${encoded}/config`),
  ]);

  if (!domainRes.ok) return { ok: false, ...TRANSPORT_FAILURE[domainRes.kind] };
  if (domainRes.status === 404) {
    return { ok: true, verdict: { found: false, verified: false, misconfigured: true, verification: [] } };
  }
  if (domainRes.status >= 400) {
    const parsed = parseVercelError(domainRes.status, domainRes.body);
    return { ok: false, code: parsed.code, message: parsed.message };
  }

  const root = asRecord(domainRes.body);
  const verified = root?.verified === true;
  const verification = parseChallenges(root?.verification);

  let misconfigured = true; // conservative default — see docblock
  if (configRes.ok && configRes.status >= 200 && configRes.status < 300) {
    const cfg = asRecord(configRes.body);
    if (typeof cfg?.misconfigured === 'boolean') misconfigured = cfg.misconfigured;
  }

  return { ok: true, verdict: { found: true, verified, misconfigured, verification } };
}

/**
 * DELETE /v9/projects/{PROJECT_ID}/domains/{domain} — detach from the project.
 * 404 = the domain was never (or is no longer) attached = idempotent success.
 */
export async function removeDomain(domain: string): Promise<RemoveDomainResult> {
  const env = readEnv();
  if (!env) {
    return { ok: false, code: 'not_configured', message: 'Domain automation is not configured.' };
  }

  const res = await vercelFetch(
    env,
    `/v9/projects/${encodeURIComponent(env.projectId)}/domains/${encodeURIComponent(domain)}`,
    { method: 'DELETE' }
  );
  if (!res.ok) return { ok: false, ...TRANSPORT_FAILURE[res.kind] };
  if ((res.status >= 200 && res.status < 300) || res.status === 404) return { ok: true };

  const parsed = parseVercelError(res.status, res.body);
  return { ok: false, code: parsed.code, message: parsed.message };
}

/**
 * PURE — builds the DNS rows a seller must create at their registrar:
 *   · apex (two labels, e.g. maimuna-fashion.com) → A @ 76.76.21.21
 *   · www / any subdomain → CNAME {sub} cname.vercel-dns.com
 *   · every TXT challenge from the verdict, verbatim (name = the full
 *     _vercel.{domain} host Vercel dictates).
 * Apex detection is a label-count heuristic (no public-suffix list — no new
 * deps): multi-part TLD apexes like example.co.uk are shown as CNAME. The
 * /v6/domains/{domain}/config misconfigured flag remains the authority on
 * whether DNS is actually correct; these rows are seller guidance.
 */
export function buildDnsInstructions(
  domain: string,
  verdict?: { verification: VerificationChallenge[] } | null
): DnsRecord[] {
  const records: DnsRecord[] = [];
  const labels = domain.split('.').filter(Boolean);

  if (labels.length === 2) {
    records.push({ type: 'A', name: '@', value: VERCEL_APEX_A_VALUE });
  } else {
    records.push({
      type: 'CNAME',
      name: labels.slice(0, -2).join('.') || 'www',
      value: VERCEL_CNAME_VALUE,
    });
  }

  for (const challenge of verdict?.verification ?? []) {
    if (challenge.type.toUpperCase() !== 'TXT') continue;
    records.push({
      type: 'TXT',
      name: challenge.domain,
      value: challenge.value,
      ...(challenge.reason ? { reason: challenge.reason } : {}),
    });
  }

  return records;
}
