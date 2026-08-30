import { redirect } from 'next/navigation';
import { loadSite } from '@/app/site/[slug]/siteData';
import { resolveStorefrontPath } from '@/lib/storefrontUrl';
import { slugify } from '@/lib/slugify';
import ClassicShopPage from './ClassicShopPage';

// ─────────────────────────────────────────────────────────────────────────────
// /shop/[slug] — SERVER BRIDGE (Pillar 1). The classic boutique used to be the
// dead end for shops whose paid /site storefront was live: every old share,
// marketplace crawl, or bookmark kept landing on the classic page. This server
// page upgrades the visit — LOOP-SAFE BY CONSTRUCTION:
//
//   THE PREDICATE (the EXACT /site serve predicate, evaluated through the SAME
//   code path requireSite uses):
//     · loadSite(slug) — the same cached slug→shop resolution the /site router
//       runs (canonical slugify + verified legacy fallback), so the shop this
//       bridge judges is BY IDENTITY the shop /site/{canonicalSlug} would
//       resolve (minted canonical === the resolution key === the same winner).
//     · resolveStorefrontPath — mirrors requireSite verbatim:
//       status === 'published' AND WebsiteConfigSchema.safeParse(config).success
//       (anything weaker loops: siteData.ts bounces /site → /shop on a
//       missing/unpublished/invalid config).
//
//   WHY NO LOOP IS POSSIBLE: a redirect fires only when the predicate holds
//   for the SAME row requireSite will read (shared Data Cache entries, same
//   tags). If /site still bounces (racing unpublish, transient read failure),
//   its /shop redirect re-runs this bridge against the SAME degraded cache —
//   the predicate now fails and the classic page renders. Every hop strictly
//   consumes the serve predicate; there is no third state.
//
//   · Starter/Pro sellers (no published AI site): predicate fails → the
//     classic boutique renders byte-identically. It is their only storefront.
//   · Custom-domain-active shops: resolveStorefrontPath tier 1 → 307 to
//     https://{domain}.
//   · Owner drafts: loadSite hands the owner their draft row, but the
//     predicate reads status — a draft NEVER redirects (the classic page and
//     the dashboard preview stay the owner's draft-era surfaces).
//   · ?classic=1 — the deliberate escape the site chromes' "View classic
//     boutique" footer links carry. Without it the documented escape would
//     bounce straight back to /site, functionally deleting the contract.
//
// 307 (redirect() default — never permanent): publish state changes, and a
// cached 308 would strand a shop that unpublishes.
// ─────────────────────────────────────────────────────────────────────────────

// Publish state is per-request truth: the bridge must never be captured by the
// full route cache (the underlying reads ride siteData's tagged Data Cache).
export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ShopBridgePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const wantsClassic = sp?.classic === '1';

  if (!wantsClassic) {
    // Any resolution failure degrades to the classic page — the bridge is an
    // upgrade path, never a gate. loadSite already swallows transient DB
    // failures into honest nulls; this catch is belt-and-suspenders.
    const data = await loadSite(slug).catch((error) => {
      console.error(`[shop-bridge] slug=${slug} loadSite failed — serving classic:`, error instanceof Error ? error.message : error);
      return null;
    });

    if (data?.website) {
      const path = resolveStorefrontPath({
        rawSlug: data.shop.shop_slug,
        canonicalSlug: slugify(data.shop.shop_slug) || null,
        website: {
          status: data.website.status,
          config: data.website.config,
          custom_domain: data.website.custom_domain ?? null,
          domain_status: data.website.domain_status ?? null,
        },
      });
      // Only the UPGRADE tiers redirect (custom domain / published /site).
      // A /shop path or null means the classic page IS the best storefront.
      if (path && !path.startsWith('/shop')) {
        console.log(`[shop-bridge] slug=${slug} shop=${data.shop.id} → 307:${path}`);
        redirect(path);
      }
    }
  }

  return <ClassicShopPage slug={slug} />;
}
