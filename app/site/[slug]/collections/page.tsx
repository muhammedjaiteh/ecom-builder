import Link from 'next/link';
import type { Metadata } from 'next';
import { SITE_CHROMES, type SiteTone } from '@/components/site-templates/chrome';
import { EditorialGridFillers } from '@/components/site-templates/chrome/EditorialChrome';
import { RITUAL_HAIRLINE } from '@/components/site-templates/chrome/RitualChrome';
import CategoryNav, { categoryAnchorId, distinctCategories } from '@/components/site-templates/CategoryNav';
import SiteThemeCascade from '@/components/site-templates/SiteThemeCascade';
import {
  WebsiteConfigSchema,
  siteCollectionsPath,
  siteProductPath,
  type SiteProduct,
  type WebsiteConfig,
} from '@/lib/siteTemplates';
import { siteThemeVars } from '@/lib/siteTheme';
import { loadSite, loadSiteCatalog, requireSite, type SiteCatalogPage } from '../siteData';
import SiteDraftBadge from '../SiteDraftBadge';

// /site/[slug]/collections — the FULL catalog of the seller's site, wrapped in
// the same premium chrome as their home page. Honest server pagination
// (?page=N, 24 per page): the count query drives real page numbers and the
// visible "Showing X–Y of Z" line, and out-of-range pages clamp instead of
// erroring. Same visibility rules and '[site-route]' telemetry as home, via
// the shared cached requireSite.
//
// PASS 3 (presentation): CATEGORY DISCOVERY. When the served page spans two
// or more real product categories, the catalog renders as category GROUPS
// (frequency order, uncategorised pieces last) with a chip strip under the
// heading that anchors to each group — the same anchors the home-page chips
// deep-link to. Below two categories the flat grid is unchanged. Grouping is
// a pure presentation of the already-served page slice: no data-loading or
// pagination change, so a category can continue onto the next page exactly
// as the flat grid would.

// CACHED DATA, DYNAMIC SHELL: force-dynamic stays — this page is inherently
// per-request anyway (searchParams pagination + the owner-draft cookie gate in
// requireSite). The catalog count and every served page slice are cached in
// siteData.ts under `site:{shopId}` with the 300s backstop.
export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadSite(slug);
  if (!data?.website) return { title: 'Sanndikaa Boutique' };

  const parsed = WebsiteConfigSchema.safeParse(data.website.config);
  if (!parsed.success) return { title: data.shop.shop_name ?? 'Sanndikaa Boutique' };

  const { site } = parsed.data;
  return {
    title: `Collection — ${site.seo.title}`,
    description: site.collection_intro || site.seo.description,
    ...(data.isOwnerPreview ? { robots: { index: false, follow: false } } : {}),
  };
}

// ── Tone-styled pagination — real links, no dead buttons ────────────────────
const PAGER_STYLES: Record<SiteTone, { wrap: string; link: string; disabled: string; label: string }> = {
  ritual: {
    wrap: 'mt-14 flex items-center justify-center gap-3 md:mt-16 md:gap-4',
    link: `inline-flex min-h-11 items-center rounded-[var(--site-radius,9999px)] border ${RITUAL_HAIRLINE} px-6 text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--site-text,oklch(21.6%_0.006_56.043))] transition hover:border-[var(--site-accent,#1c1917)] active:scale-95`,
    disabled: `inline-flex min-h-11 items-center rounded-[var(--site-radius,9999px)] border ${RITUAL_HAIRLINE} px-6 text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--site-muted,oklch(55.3%_0.013_58.071))] opacity-50`,
    label: 'text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--site-muted,oklch(55.3%_0.013_58.071))]',
  },
  editorial: {
    wrap: 'flex items-center justify-center gap-3 border-t border-[var(--site-text,#171717)] px-5 py-8 md:gap-4 md:px-10',
    link: 'inline-flex min-h-11 items-center border border-[var(--site-text,#171717)] px-6 text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--site-text,#171717)] transition hover:bg-[var(--site-text,#171717)] hover:text-[var(--site-bg,#F7F5F0)] active:scale-95',
    disabled: 'inline-flex min-h-11 items-center border border-[color-mix(in_srgb,var(--site-text,#171717)_25%,transparent)] px-6 text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--site-muted,oklch(55.6%_0_0))] opacity-60',
    label: 'text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--site-muted,oklch(55.6%_0_0))]',
  },
  neutral: {
    wrap: 'mt-12 flex items-center justify-center gap-3 md:mt-14 md:gap-4',
    link: 'inline-flex min-h-11 items-center rounded-full bg-[var(--site-accent,#f0a500)] px-6 text-[10px] font-black uppercase tracking-[0.2em] text-black transition hover:brightness-110 active:scale-95',
    disabled: 'inline-flex min-h-11 items-center rounded-full border border-white/15 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-white/40',
    label: 'text-[10px] font-black uppercase tracking-[0.25em] text-white/60',
  },
};

function CatalogPager({ tone, basePath, catalog }: { tone: SiteTone; basePath: string; catalog: SiteCatalogPage }) {
  if (catalog.pageCount <= 1) return null;
  const styles = PAGER_STYLES[tone];
  const pageHref = (page: number) => (page === 1 ? basePath : `${basePath}?page=${page}`);
  return (
    <nav aria-label="Collection pages" className={styles.wrap}>
      {catalog.page > 1 ? (
        <Link href={pageHref(catalog.page - 1)} className={styles.link}>Previous</Link>
      ) : (
        <span aria-disabled className={styles.disabled}>Previous</span>
      )}
      <span className={styles.label}>Page {catalog.page} of {catalog.pageCount}</span>
      {catalog.page < catalog.pageCount ? (
        <Link href={pageHref(catalog.page + 1)} className={styles.link}>Next</Link>
      ) : (
        <span aria-disabled className={styles.disabled}>Next</span>
      )}
    </nav>
  );
}

// ── Category groups (Pass 3) ─────────────────────────────────────────────────

type CategoryGroup = {
  /** null = the uncategorised remainder (rendered last). */
  category: string | null;
  anchor: string | null;
  items: SiteProduct[];
  /** Running offset into the page slice — keeps fallback tile variety stable. */
  offset: number;
};

/** Groups the served page by real category when it spans ≥2; null → flat. */
function groupByCategory(products: SiteProduct[]): { categories: string[]; groups: CategoryGroup[] } | null {
  const categories = distinctCategories(products, 100);
  if (categories.length < 2) return null;
  const groups: CategoryGroup[] = [];
  let offset = 0;
  for (const category of categories) {
    const items = products.filter((p) => p.category?.trim() === category);
    groups.push({ category, anchor: categoryAnchorId(category), items, offset });
    offset += items.length;
  }
  const rest = products.filter((p) => !p.category?.trim());
  if (rest.length > 0) groups.push({ category: null, anchor: null, items: rest, offset });
  return { categories, groups };
}

const countLabel = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// ── Per-template catalog bodies — each speaks its template's design language ─

type CatalogBodyProps = {
  site: WebsiteConfig['site'];
  catalog: SiteCatalogPage;
  basePath: string;
  productHref: (p: SiteProduct) => string;
};

function RitualCatalogBody({ site, catalog, basePath, productHref }: CatalogBodyProps) {
  const { ProductCard, collectionGridClass } = SITE_CHROMES.ritual;
  const grouped = groupByCategory(catalog.products);
  return (
    <section className="mx-auto max-w-7xl px-5 py-10 md:px-10 md:py-20">
      <div className="mx-auto max-w-xl text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-[var(--site-muted,oklch(55.3%_0.013_58.071))]">The Collection</p>
        <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight text-balance text-[var(--site-text,oklch(21.6%_0.006_56.043))] md:mt-4 md:text-6xl">{site.collection_title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--site-muted,oklch(55.3%_0.013_58.071))] md:mt-4 md:text-base">{site.collection_intro}</p>
        {catalog.total > 0 && (
          <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--site-muted,oklch(55.3%_0.013_58.071))]">
            Showing {catalog.from}–{catalog.to} of {catalog.total} {catalog.total === 1 ? 'piece' : 'pieces'}
          </p>
        )}
      </div>

      {grouped && (
        <CategoryNav
          tone="ritual"
          label={null}
          ariaLabel="Browse by category"
          categories={grouped.categories}
          hrefFor={(c) => `#${categoryAnchorId(c)}`}
          className="mt-8 md:[&>div]:justify-center"
        />
      )}

      {catalog.products.length === 0 ? (
        <div className={`mx-auto mt-12 max-w-md rounded-2xl border border-dashed ${RITUAL_HAIRLINE} px-8 py-14 text-center md:mt-16`}>
          <p className="font-serif text-xl font-bold text-[var(--site-text,oklch(21.6%_0.006_56.043))]">The collection is being prepared.</p>
          <p className="mt-3 text-sm leading-relaxed text-[var(--site-muted,oklch(55.3%_0.013_58.071))]">New pieces are on their way — check back soon.</p>
        </div>
      ) : grouped ? (
        grouped.groups.map((g) => (
          <section key={g.anchor ?? 'other'} id={g.anchor ?? undefined} className="mt-10 scroll-mt-24 md:mt-14">
            <div className={`flex items-baseline justify-between gap-4 border-b ${RITUAL_HAIRLINE} pb-3`}>
              <h2 className="font-serif text-xl font-bold tracking-tight text-[var(--site-text,oklch(21.6%_0.006_56.043))] md:text-2xl">{g.category ?? 'More pieces'}</h2>
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--site-muted,oklch(55.3%_0.013_58.071))]">{countLabel(g.items.length, 'piece', 'pieces')}</span>
            </div>
            <div className={`mt-6 ${collectionGridClass}`}>
              {g.items.map((p, i) => (
                <ProductCard key={p.id} product={p} index={g.offset + i} href={productHref(p)} />
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className={`mt-10 md:mt-16 ${collectionGridClass}`}>
          {catalog.products.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} href={productHref(p)} />
          ))}
        </div>
      )}

      <CatalogPager tone="ritual" basePath={basePath} catalog={catalog} />
    </section>
  );
}

function EditorialCatalogBody({ site, catalog, basePath, productHref }: CatalogBodyProps) {
  const { ProductCard, collectionGridClass } = SITE_CHROMES.editorial;
  const grouped = groupByCategory(catalog.products);
  return (
    <section className="border-b border-[var(--site-text,#171717)]">
      <div className="flex flex-col items-start justify-between gap-4 px-5 py-8 md:flex-row md:items-baseline md:px-10 md:py-14">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[var(--site-accent,#1a2e1a)]">The Collection</p>
          <h1 className="mt-3 font-serif text-3xl font-black tracking-tight text-balance md:text-6xl">{site.collection_title}</h1>
        </div>
        <div className="max-w-md">
          <p className="text-sm leading-relaxed text-[var(--site-muted,oklch(55.6%_0_0))]">{site.collection_intro}</p>
          {catalog.total > 0 && (
            <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--site-muted,oklch(55.6%_0_0))]">
              Showing {catalog.from}–{catalog.to} of {catalog.total} {catalog.total === 1 ? 'piece' : 'pieces'}
            </p>
          )}
        </div>
      </div>

      {grouped && (
        <div className="border-t border-[color-mix(in_srgb,var(--site-text,#171717)_25%,transparent)] px-5 py-4 md:px-10">
          <CategoryNav
            tone="editorial"
            label={null}
            ariaLabel="Browse by category"
            categories={grouped.categories}
            hrefFor={(c) => `#${categoryAnchorId(c)}`}
          />
        </div>
      )}

      {catalog.products.length === 0 ? (
        <div className="border-t border-[var(--site-text,#171717)] px-5 py-20 text-center md:px-10">
          <p className="font-serif text-2xl italic text-[var(--site-text,#171717)]">The collection is being prepared.</p>
          <p className="mt-3 text-sm leading-relaxed text-[var(--site-muted,oklch(55.6%_0_0))]">New pieces are on their way — check back soon.</p>
        </div>
      ) : grouped ? (
        grouped.groups.map((g) => (
          <section key={g.anchor ?? 'other'} id={g.anchor ?? undefined} className="scroll-mt-6">
            <div className="flex items-baseline justify-between gap-4 border-t border-[var(--site-text,#171717)] px-5 py-4 md:px-10">
              <h2 className="font-serif text-xl font-bold tracking-tight md:text-2xl">{g.category ?? 'More pieces'}</h2>
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--site-muted,oklch(55.6%_0_0))]">{countLabel(g.items.length, 'piece', 'pieces')}</span>
            </div>
            <div className={collectionGridClass}>
              {g.items.map((p, i) => (
                <ProductCard key={p.id} product={p} index={g.offset + i} href={productHref(p)} />
              ))}
              {/* Paper plates complete each group's last hairline row. */}
              <EditorialGridFillers itemCount={g.items.length} />
            </div>
          </section>
        ))
      ) : (
        <div className={collectionGridClass}>
          {catalog.products.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} href={productHref(p)} />
          ))}
          {/* Paper plates complete the last hairline row — the gutter
              background never shows through as black voids. */}
          <EditorialGridFillers itemCount={catalog.products.length} />
        </div>
      )}

      <CatalogPager tone="editorial" basePath={basePath} catalog={catalog} />
    </section>
  );
}

function NeutralCatalogBody({ site, catalog, basePath, productHref }: CatalogBodyProps) {
  const { ProductCard, collectionGridClass } = SITE_CHROMES.vitality;
  const grouped = groupByCategory(catalog.products);
  return (
    <section className="mx-auto max-w-7xl px-5 py-10 md:px-10 md:py-20">
      <h1 className="text-3xl font-black uppercase tracking-tighter text-balance break-words md:text-6xl">{site.collection_title}</h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/65">{site.collection_intro}</p>
      {catalog.total > 0 && (
        <p className="mt-4 text-[10px] font-black uppercase tracking-[0.25em] text-[var(--site-accent,#f0a500)]">
          Showing {catalog.from}–{catalog.to} of {catalog.total} {catalog.total === 1 ? 'product' : 'products'}
        </p>
      )}

      {grouped && (
        <CategoryNav
          tone="neutral"
          label={null}
          ariaLabel="Browse by category"
          categories={grouped.categories}
          hrefFor={(c) => `#${categoryAnchorId(c)}`}
          className="mt-7"
        />
      )}

      {catalog.products.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-white/15 px-8 py-14 text-center">
          <p className="text-xl font-black uppercase tracking-tight">The lineup is being prepared.</p>
          <p className="mt-3 text-sm leading-relaxed text-white/65">New products are on their way — check back soon.</p>
        </div>
      ) : grouped ? (
        grouped.groups.map((g) => (
          <section key={g.anchor ?? 'other'} id={g.anchor ?? undefined} className="mt-10 scroll-mt-24 md:mt-12">
            <div className="flex items-baseline justify-between gap-4 border-b border-white/10 pb-3">
              <h2 className="text-xl font-black uppercase tracking-tight md:text-2xl">{g.category ?? 'More products'}</h2>
              <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.25em] text-white/60">{countLabel(g.items.length, 'product', 'products')}</span>
            </div>
            <div className={`mt-5 ${collectionGridClass}`}>
              {g.items.map((p, i) => (
                <ProductCard key={p.id} product={p} index={g.offset + i} href={productHref(p)} />
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className={`mt-10 md:mt-12 ${collectionGridClass}`}>
          {catalog.products.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} href={productHref(p)} />
          ))}
        </div>
      )}

      <CatalogPager tone="neutral" basePath={basePath} catalog={catalog} />
    </section>
  );
}

const CATALOG_BODIES: Record<SiteTone, (props: CatalogBodyProps) => React.ReactElement> = {
  ritual: RitualCatalogBody,
  editorial: EditorialCatalogBody,
  neutral: NeutralCatalogBody,
};

export default async function SiteCollectionsPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const site = await requireSite(slug, 'collections');

  const sp = await searchParams;
  const requestedPage = Math.max(1, Math.floor(Number(sp?.page)) || 1);
  const catalog = await loadSiteCatalog(site.shop.id, requestedPage);
  if (catalog.page !== requestedPage) {
    console.log(`[site-route] slug=${slug} route=collections page=${requestedPage} clamped=${catalog.page} of=${catalog.pageCount}`);
  }

  const entry = SITE_CHROMES[site.config.template_key] ?? SITE_CHROMES.vitality;
  const { Chrome, tone } = entry;
  const Body = CATALOG_BODIES[tone];

  // requireSite resolved this shop BY slug, so a canonical collections path
  // always exists here; the slug-derived fallback is belt-and-suspenders only.
  const basePath = siteCollectionsPath(site.shop) ?? `/site/${slug}/collections`;
  const productHref = (p: SiteProduct) => siteProductPath(site.shop, p.id) ?? `/product/${p.id}`;

  // Cascade gap (Pillar 4): mirror the theme onto document.documentElement so
  // the root-layout Cart drawer wears the boutique tokens on this page too.
  const themeVars = siteThemeVars(site.config);

  return (
    <>
      {themeVars && <SiteThemeCascade vars={themeVars} />}
      {site.isDraftPreview && <SiteDraftBadge />}
      <Chrome shop={site.shop} config={site.config} active="collections">
        <Body site={site.config.site} catalog={catalog} basePath={basePath} productHref={productHref} />
      </Chrome>
    </>
  );
}
