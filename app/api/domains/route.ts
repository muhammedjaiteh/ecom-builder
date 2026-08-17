import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import {
  attachDomain,
  buildDnsInstructions,
  getDomainStatus,
  isDomainAutomationConfigured,
  removeDomain,
  type DomainVerdict,
  type VerificationChallenge,
} from '@/lib/vercelDomains';
import { removeTenantMapping, upsertTenantMapping } from '@/lib/globalConfig';
import { slugifyWithFallback } from '@/lib/slugify';

// ─────────────────────────────────────────────────────────────────────────────
// BYOD custom-domain API — owner-authed, tier-gated, service-role writes.
// Storage: shop_websites.custom_domain + shop_websites.domain_status
// (sql/provisioning.sql SECTION 9 — lower(custom_domain) unique index).
//
//   POST   {domain} → normalize + validation gauntlet → attachDomain →
//                     persist → { domain, status, records }
//   GET             → status state machine for the shop's domain:
//                     not_connected | pending_txt | awaiting_dns | active
//   DELETE          → removeDomain (idempotent) → clear columns →
//                     { status: 'not_connected' }
//
// Every error is classified JSON { error, code } with a correct HTTP status.
// The Vercel token and raw upstream bodies never leave lib/vercelDomains.ts.
// ─────────────────────────────────────────────────────────────────────────────

// Tier gate — same value as WEBSITE_TIERS in app/api/websites/publish/route.ts
// (custom domains ride on the generated website, so the gates must agree).
// SINGLE-CONSTANT SWITCH: if the founder later restricts BYOD to
// flagship-only, change this ONE array to ['flagship'] — nothing else moves.
const DOMAIN_TIERS = ['advanced', 'flagship'];

type DomainState = 'not_connected' | 'pending_txt' | 'awaiting_dns' | 'active';
const DOMAIN_STATES: DomainState[] = ['not_connected', 'pending_txt', 'awaiting_dns', 'active'];

// Module-level 30s status memo, keyed by domain — spares Vercel API quota when
// a dashboard polls GET. PER-LAMBDA CAVEAT: on serverless each warm instance
// holds its own Map, so this is best-effort dampening (a cold start or a
// second instance re-fetches). That is acceptable: it bounds the worst case at
// one Vercel round-trip per instance per 30s, never staleness beyond 30s.
const STATUS_MEMO_TTL_MS = 30_000;
const statusMemo = new Map<string, { at: number; verdict: DomainVerdict }>();

type OwnerGate =
  | { ok: true; shop: { id: string } }
  | { ok: false; response: NextResponse };

// Exact auth + tier pattern from app/api/websites/publish/route.ts: verified
// cookie session → shops row keyed on the user id → tier gate.
async function requireOwner(): Promise<OwnerGate> {
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized.', code: 'unauthorized' }, { status: 401 }),
    };
  }

  const { data: shop } = await supabase
    .from('shops')
    .select('id, subscription_tier')
    .eq('id', user.id)
    .single();

  if (!shop) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Shop profile not found.', code: 'no_shop' }, { status: 404 }),
    };
  }

  const tier = (shop.subscription_tier ?? '').toLowerCase().trim();
  if (!DOMAIN_TIERS.includes(tier)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Custom domains are an Advanced-tier feature.', code: 'tier_gate' },
        { status: 403 }
      ),
    };
  }

  return { ok: true, shop: { id: shop.id } };
}

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Global Config tenant map (Step 2): publish {domain → canonical shop slug} so
 * proxy.ts routes the custom domain without a DB round trip. NEVER throws and
 * never influences the caller's response — a domain status must not 500
 * because Global Config hiccuped. Misses self-heal via /api/domains/resolve's
 * backfill on first traffic.
 */
async function publishTenantMapping(
  admin: ReturnType<typeof getAdmin>,
  shopId: string,
  domain: string
): Promise<void> {
  try {
    const { data: shopRow, error } = await admin
      .from('shops')
      .select('id, shop_slug, shop_name')
      .eq('id', shopId)
      .maybeSingle();
    if (error || !shopRow) {
      console.error(`[domains] tenant-map slug read failed for shop ${shopId}:`, error ?? 'row missing');
      return;
    }
    // Canonical, Law-2-safe slug — same computation as repairShopSlug, and the
    // exact form the /site router resolves (legacy raw values slugify here and
    // findShopBySlug's verified fallback matches them).
    const slug = slugifyWithFallback(shopRow.shop_slug || shopRow.shop_name, shopRow.id);
    const result = await upsertTenantMapping(domain, slug);
    if (!result.ok) {
      if (result.code !== 'not_configured') {
        console.error(`[domains] Global Config upsert failed for ${domain}: ${result.code} ${result.message}`);
      }
      return;
    }
    console.log(`[domains] Global Config mapped ${domain} → ${slug}`);
  } catch (err) {
    console.error(`[domains] tenant-map publish crashed for ${domain}:`, err);
  }
}

function notConfiguredResponse(): NextResponse {
  // Local-dev honesty: without VERCEL_API_TOKEN / VERCEL_PROJECT_ID (+
  // VERCEL_TEAM_ID for team scope) we refuse to pretend — classified 503.
  return NextResponse.json(
    { error: 'Domain automation is not configured on this server.', code: 'not_configured' },
    { status: 503 }
  );
}

function upstreamFailureResponse(code: string, message: string): NextResponse {
  const status = code === 'upstream_timeout' ? 504 : 502;
  return NextResponse.json({ error: message, code }, { status });
}

// ─── Domain normalization + rejection gauntlet ───────────────────────────────

const OWN_HOSTS = ['sanndikaa.com', 'www.sanndikaa.com', 'localhost'];

function reservedHosts(): Set<string> {
  const hosts = new Set(OWN_HOSTS);
  // Whatever the deployment says it is canonically served from is also ours.
  for (const envUrl of [process.env.PUBLIC_APP_URL, process.env.NEXT_PUBLIC_APP_URL]) {
    if (!envUrl) continue;
    try {
      hosts.add(new URL(envUrl).hostname.toLowerCase());
    } catch {
      // Malformed env URL — ignore; the static list still protects us.
    }
  }
  return hosts;
}

type NormalizeResult =
  | { ok: true; domain: string }
  | { ok: false; error: string };

function normalizeDomain(raw: unknown): NormalizeResult {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { ok: false, error: 'Provide a domain, e.g. shop.example.com.' };
  }

  // Strip any scheme the seller pasted, then let the URL parser strip
  // path/port/credentials AND punycode IDN labels in one move.
  const stripped = raw.trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  let hostname: string;
  try {
    hostname = new URL(`http://${stripped}`).hostname;
  } catch {
    return { ok: false, error: 'That does not look like a valid domain name.' };
  }
  hostname = hostname.replace(/\.$/, ''); // trailing-dot FQDN form

  if (!hostname || !hostname.includes('.')) {
    return { ok: false, error: 'Enter a full domain with its extension, e.g. shop.example.com.' };
  }
  if (hostname.length > 253) {
    return { ok: false, error: 'Domain names cannot exceed 253 characters.' };
  }
  // IP literals: IPv4 dotted quad, or the bracketed IPv6 form URL produces.
  if (hostname.startsWith('[') || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return { ok: false, error: 'IP addresses cannot be connected — use a domain name.' };
  }
  if (
    reservedHosts().has(hostname) ||
    hostname === 'vercel.app' ||
    hostname.endsWith('.vercel.app') ||
    hostname.endsWith('.sanndikaa.com') ||
    hostname.endsWith('.localhost')
  ) {
    return { ok: false, error: 'That domain belongs to the Sanndikaa platform and cannot be claimed.' };
  }

  return { ok: true, domain: hostname };
}

/** Escapes ilike metacharacters so the claim check is an exact
 *  case-insensitive equality, never a pattern match. */
function escapeIlike(value: string): string {
  return value.replace(/([\\%_])/g, '\\$1');
}

function txtOnlyRecords(verification: VerificationChallenge[]) {
  return verification
    .filter((c) => c.type.toUpperCase() === 'TXT')
    .map((c) => ({ type: 'TXT' as const, name: c.domain, value: c.value, ...(c.reason ? { reason: c.reason } : {}) }));
}

// ─── POST — connect a domain ─────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const gate = await requireOwner();
    if (!gate.ok) return gate.response;
    const shop = gate.shop;

    const body = await req.json().catch(() => null);
    const normalized = normalizeDomain((body as { domain?: unknown } | null)?.domain);
    if (!normalized.ok) {
      return NextResponse.json({ error: normalized.error, code: 'invalid_domain' }, { status: 400 });
    }
    const domain = normalized.domain;

    const admin = getAdmin();

    // Cross-shop claim check BEFORE any Vercel call: all shops share ONE
    // Vercel project, so the project-level attach cannot arbitrate ownership —
    // the database row is the source of truth for which shop owns a hostname.
    const { data: claimants, error: claimError } = await admin
      .from('shop_websites')
      .select('shop_id')
      .ilike('custom_domain', escapeIlike(domain))
      .neq('shop_id', shop.id)
      .limit(1);

    if (claimError) {
      console.error('[domains] claim check failed:', claimError);
      return NextResponse.json({ error: 'Failed to verify domain availability.', code: 'db_error' }, { status: 500 });
    }
    if (claimants && claimants.length > 0) {
      return NextResponse.json(
        { error: 'This domain is already connected to another Sanndikaa shop.', code: 'domain_taken' },
        { status: 409 }
      );
    }

    // A domain must have a website to point at.
    const { data: siteRow, error: siteError } = await admin
      .from('shop_websites')
      .select('shop_id, custom_domain, domain_status')
      .eq('shop_id', shop.id)
      .maybeSingle();

    if (siteError) {
      console.error('[domains] website read failed:', siteError);
      return NextResponse.json({ error: 'Failed to load your website.', code: 'db_error' }, { status: 500 });
    }
    if (!siteRow) {
      return NextResponse.json(
        { error: 'Generate your website first, then connect a domain.', code: 'no_website' },
        { status: 404 }
      );
    }

    // Same-shop re-POST of the SAME domain = idempotent re-attach (falls
    // through to attachDomain, whose 409 handling makes it a no-op). A
    // DIFFERENT domain while one is connected requires an explicit DELETE
    // first — silent replacement would orphan the old attachment on Vercel.
    const currentDomain = (siteRow.custom_domain ?? '').toLowerCase();
    if (currentDomain && currentDomain !== domain) {
      return NextResponse.json(
        { error: 'A different domain is already connected. Disconnect it before adding a new one.', code: 'domain_conflict' },
        { status: 409 }
      );
    }

    if (!isDomainAutomationConfigured()) return notConfiguredResponse();

    const attach = await attachDomain(domain);
    if (!attach.ok) {
      if (attach.code === 'upstream_timeout' || attach.code === 'upstream_unreachable') {
        return upstreamFailureResponse(attach.code, attach.message);
      }
      if (attach.code === 'domain_already_in_use') {
        // Claimed under another Vercel account — surface the TXT _vercel
        // ownership challenge verbatim so the seller can prove control.
        return NextResponse.json(
          {
            error: 'This domain is in use by another Vercel account. Add the TXT record below to prove ownership, then try again.',
            code: attach.code,
            records: txtOnlyRecords(attach.verification),
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: attach.message, code: attach.code }, { status: 502 });
    }

    const status: DomainState = attach.verification.length > 0 ? 'pending_txt' : 'awaiting_dns';

    const { error: writeError } = await admin
      .from('shop_websites')
      .update({ custom_domain: domain, domain_status: status })
      .eq('shop_id', shop.id);

    if (writeError) {
      // 23505 = the lower(custom_domain) unique index — another shop claimed
      // the hostname between our check and this write. Do NOT detach it from
      // the Vercel project: the project is shared, so the domain now serves
      // the winning shop.
      if ((writeError as { code?: string }).code === '23505') {
        return NextResponse.json(
          { error: 'This domain is already connected to another Sanndikaa shop.', code: 'domain_taken' },
          { status: 409 }
        );
      }
      console.error('[domains] persist failed:', writeError);
      return NextResponse.json({ error: 'Failed to save your domain.', code: 'db_error' }, { status: 500 });
    }

    statusMemo.delete(domain); // a fresh attach invalidates any memoized verdict

    console.log(`[domains] Shop ${shop.id} attached ${domain} → ${status}`);
    return NextResponse.json({
      domain,
      status,
      records: buildDnsInstructions(domain, { verification: attach.verification }),
    });
  } catch (error) {
    console.error('[domains] POST fatal:', error);
    return NextResponse.json({ error: 'Failed to connect your domain.', code: 'internal' }, { status: 500 });
  }
}

// ─── GET — status state machine ──────────────────────────────────────────────
//
//   not_connected — no custom_domain on the row (or no row).       [no Vercel call]
//   pending_txt   — attached, unverified, TXT challenges pending.  [/v9 + /v6]
//   awaiting_dns  — verified but DNS misconfigured (A/CNAME not    [/v9 + /v6]
//                   pointed yet), or unverified with no challenges.
//   active        — verified AND correctly configured.             [/v9 + /v6]

export async function GET() {
  try {
    const gate = await requireOwner();
    if (!gate.ok) return gate.response;
    const shop = gate.shop;

    const admin = getAdmin();
    const { data: row, error: readError } = await admin
      .from('shop_websites')
      .select('custom_domain, domain_status')
      .eq('shop_id', shop.id)
      .maybeSingle();

    if (readError) {
      console.error('[domains] GET read failed:', readError);
      return NextResponse.json({ error: 'Failed to load your domain.', code: 'db_error' }, { status: 500 });
    }
    if (!row?.custom_domain) {
      return NextResponse.json({ status: 'not_connected' as DomainState });
    }

    const domain = row.custom_domain.toLowerCase();
    if (!isDomainAutomationConfigured()) return notConfiguredResponse();

    let verdict: DomainVerdict;
    const memo = statusMemo.get(domain);
    if (memo && Date.now() - memo.at < STATUS_MEMO_TTL_MS) {
      verdict = memo.verdict;
    } else {
      const statusResult = await getDomainStatus(domain);
      if (!statusResult.ok) {
        if (statusResult.code === 'upstream_timeout' || statusResult.code === 'upstream_unreachable') {
          return upstreamFailureResponse(statusResult.code, statusResult.message);
        }
        return NextResponse.json({ error: statusResult.message, code: statusResult.code }, { status: 502 });
      }
      verdict = statusResult.verdict;
      statusMemo.set(domain, { at: Date.now(), verdict });
    }

    let status: DomainState;
    if (!verdict.found) {
      // Drift: the row holds a domain the Vercel project no longer has
      // (manual dashboard removal). Report the last persisted state honestly
      // rather than inventing one; re-attach healing is a later-step concern.
      status = DOMAIN_STATES.includes(row.domain_status as DomainState)
        ? (row.domain_status as DomainState)
        : 'awaiting_dns';
    } else if (!verdict.verified) {
      status = verdict.verification.length > 0 ? 'pending_txt' : 'awaiting_dns';
    } else if (verdict.misconfigured) {
      status = 'awaiting_dns';
    } else {
      status = 'active';
    }

    if (status !== row.domain_status) {
      const { error: persistError } = await admin
        .from('shop_websites')
        .update({ domain_status: status })
        .eq('shop_id', shop.id);
      if (persistError) {
        // Non-fatal: the response is still correct; the next poll re-persists.
        console.error('[domains] status persist failed:', persistError);
      }
    }

    // The flip INTO 'active' publishes the tenant routing entry. Only on the
    // transition — steady-state polls must not pay a Vercel write per poll
    // (the resolve endpoint's backfill covers any missed/failed flip).
    if (status === 'active' && row.domain_status !== 'active') {
      await publishTenantMapping(admin, shop.id, domain);
    }

    return NextResponse.json({
      domain,
      status,
      records: buildDnsInstructions(domain, verdict),
    });
  } catch (error) {
    console.error('[domains] GET fatal:', error);
    return NextResponse.json({ error: 'Failed to load your domain.', code: 'internal' }, { status: 500 });
  }
}

// ─── DELETE — disconnect ─────────────────────────────────────────────────────

export async function DELETE() {
  try {
    const gate = await requireOwner();
    if (!gate.ok) return gate.response;
    const shop = gate.shop;

    const admin = getAdmin();
    const { data: row, error: readError } = await admin
      .from('shop_websites')
      .select('custom_domain')
      .eq('shop_id', shop.id)
      .maybeSingle();

    if (readError) {
      console.error('[domains] DELETE read failed:', readError);
      return NextResponse.json({ error: 'Failed to load your domain.', code: 'db_error' }, { status: 500 });
    }
    if (!row?.custom_domain) {
      // Nothing connected — DELETE is idempotent.
      return NextResponse.json({ status: 'not_connected' as DomainState });
    }

    const domain = row.custom_domain.toLowerCase();
    // Rows can only exist where POST succeeded, i.e. on configured envs — so
    // a 503 here never strands a real attachment.
    if (!isDomainAutomationConfigured()) return notConfiguredResponse();

    const removal = await removeDomain(domain);
    if (!removal.ok) {
      // Do NOT clear the columns on failure — that would orphan the Vercel
      // attachment with no owner able to release it.
      if (removal.code === 'upstream_timeout' || removal.code === 'upstream_unreachable') {
        return upstreamFailureResponse(removal.code, removal.message);
      }
      return NextResponse.json({ error: removal.message, code: removal.code }, { status: 502 });
    }

    const { error: clearError } = await admin
      .from('shop_websites')
      .update({ custom_domain: null, domain_status: null })
      .eq('shop_id', shop.id);

    if (clearError) {
      console.error('[domains] clear failed:', clearError);
      return NextResponse.json({ error: 'Failed to disconnect your domain.', code: 'db_error' }, { status: 500 });
    }

    statusMemo.delete(domain);

    // Global Config tenant map (Step 2): drop the routing entry. Failure is
    // harmless drift — the domain is already detached from the Vercel
    // project, so its traffic can no longer reach this deployment anyway.
    try {
      const removal = await removeTenantMapping(domain);
      if (!removal.ok && removal.code !== 'not_configured') {
        console.error(`[domains] Global Config removal failed for ${domain}: ${removal.code} ${removal.message}`);
      }
    } catch (err) {
      console.error(`[domains] Global Config removal crashed for ${domain}:`, err);
    }

    console.log(`[domains] Shop ${shop.id} disconnected ${domain}`);
    return NextResponse.json({ status: 'not_connected' as DomainState });
  } catch (error) {
    console.error('[domains] DELETE fatal:', error);
    return NextResponse.json({ error: 'Failed to disconnect your domain.', code: 'internal' }, { status: 500 });
  }
}
