import Link from 'next/link';
import type { Metadata } from 'next';
import { SITE_CHROMES, type SiteTone } from '@/components/site-templates/chrome';
import {
  WebsiteConfigSchema,
  siteCollectionsPath,
  siteProductPath,
  type SiteProduct,
  type WebsiteConfig,
} from '@/lib/siteTemplates';
import { loadSite, loadSiteCatalog, requireSite, type SiteCatalogPage } from '../siteData';
import SiteDraftBadge from '../SiteDraftBadge';

// /site/[slug]/collections — the FULL catalog of the seller's site, wrapped in
// the same premium chrome as their home page. Honest server pagination
// (?page=N, 24 per page): the count query drives real page numbers and the
// visible "Showing X–Y of Z" line, and out-of-range pages clamp instead of
// erroring. Same visibility rules and '[site-route]' telemetry as home, via
// the shared cached requireSite.

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
    wrap: 'mt-16 flex items-center justify-center gap-4',
    link: 'rounded-full border border-stone-300 px-7 py-3 text-[10px] font-bold uppercase tracking-[0.25em] text-stone-900 transition hover:border-stone-900 active:scale-95',
    disabled: 'rounded-full border border-stone-200 px-7 py-3 text-[10px] font-bold uppercase tracking-[0.25em] text-stone-300',
    label: 'text-[10px] font-bold uppercase tracking-[0.3em] text-stone-400',
  },
  editorial: {
    wrap: 'flex items-center justify-center gap-4 border-t border-neutral-900 px-5 py-8 md:px-10',
    link: 'border border-neutral-900 px-7 py-3 text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-900 transition hover:bg-neutral-900 hover:text-[#F7F5F0] active:scale-95',
    disabled: 'border border-neutral-300 px-7 py-3 text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-300',
    label: 'text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-500',
  },
  neutral: {
    wrap: 'mt-14 flex items-center justify-center gap-4',
    link: 'rounded-full bg-[#f0a500] px-7 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-black transition hover:bg-amber-400 active:scale-95',
    disabled: 'rounded-full border border-white/15 px-7 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/25',
    label: 'text-[10px] font-black uppercase tracking-[0.25em] text-white/50',
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

// ── Per-template catalog bodies — each speaks its template's design language ─

type CatalogBodyProps = {
  site: WebsiteConfig['site'];
  catalog: SiteCatalogPage;
  basePath: string;
  productHref: (p: SiteProduct) => string;
};

function RitualCatalogBody({ site, catalog, basePath, productHref }: CatalogBodyProps) {
  const { ProductCard, collectionGridClass } = SITE_CHROMES.ritual;
  return (
    <section className="mx-auto max-w-7xl px-5 py-16 md:px-10 md:py-24">
      <div className="mx-auto max-w-xl text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-stone-400">The Collection</p>
        <h1 className="mt-4 font-serif text-4xl font-bold tracking-tight text-stone-900 md:text-6xl">{site.collection_title}</h1>
        <p className="mt-4 text-sm leading-relaxed text-stone-500 md:text-base">{site.collection_intro}</p>
        {catalog.total > 0 && (
          <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.3em] text-stone-400">
            Showing {catalog.from}–{catalog.to} of {catalog.total} {catalog.total === 1 ? 'piece' : 'pieces'}
          </p>
        )}
      </div>

      {catalog.products.length === 0 ? (
        <div className="mx-auto mt-16 max-w-md rounded-2xl border border-dashed border-stone-300 px-8 py-14 text-center">
          <p className="font-serif text-xl font-bold text-stone-900">The collection is being prepared.</p>
          <p className="mt-3 text-sm leading-relaxed text-stone-500">New pieces are on their way — check back soon.</p>
        </div>
      ) : (
        <div className={`mt-12 md:mt-16 ${collectionGridClass}`}>
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
  return (
    <section className="border-b border-neutral-900">
      <div className="flex flex-col items-start justify-between gap-4 px-5 py-10 md:flex-row md:items-baseline md:px-10 md:py-14">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#1a2e1a]">The Complete Edit</p>
          <h1 className="mt-3 font-serif text-4xl font-black tracking-tight md:text-6xl">{site.collection_title}</h1>
        </div>
        <div className="max-w-md">
          <p className="text-sm leading-relaxed text-neutral-500">{site.collection_intro}</p>
          {catalog.total > 0 && (
            <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-400">
              Showing {catalog.from}–{catalog.to} of {catalog.total} {catalog.total === 1 ? 'piece' : 'pieces'}
            </p>
          )}
        </div>
      </div>

      {catalog.products.length === 0 ? (
        <div className="border-t border-neutral-900 px-5 py-20 text-center md:px-10">
          <p className="font-serif text-2xl italic text-neutral-900">The collection is being prepared.</p>
          <p className="mt-3 text-sm leading-relaxed text-neutral-500">New pieces are on their way — check back soon.</p>
        </div>
      ) : (
        <div className={collectionGridClass}>
          {catalog.products.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} href={productHref(p)} />
          ))}
        </div>
      )}

      <CatalogPager tone="editorial" basePath={basePath} catalog={catalog} />
    </section>
  );
}

function NeutralCatalogBody({ site, catalog, basePath, productHref }: CatalogBodyProps) {
  const { ProductCard, collectionGridClass } = SITE_CHROMES.vitality;
  return (
    <section className="mx-auto max-w-7xl px-5 py-16 md:px-10 md:py-20">
      <h1 className="text-4xl font-black uppercase tracking-tighter md:text-6xl">{site.collection_title}</h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/60">{site.collection_intro}</p>
      {catalog.total > 0 && (
        <p className="mt-5 text-[10px] font-black uppercase tracking-[0.25em] text-[#f0a500]">
          Showing {catalog.from}–{catalog.to} of {catalog.total} {catalog.total === 1 ? 'product' : 'products'}
        </p>
      )}

      {catalog.products.length === 0 ? (
        <div className="mt-14 rounded-2xl border border-dashed border-white/15 px-8 py-14 text-center">
          <p className="text-xl font-black uppercase tracking-tight">The lineup is being prepared.</p>
          <p className="mt-3 text-sm leading-relaxed text-white/60">New products are on their way — check back soon.</p>
        </div>
      ) : (
        <div className={`mt-12 ${collectionGridClass}`}>
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

  return (
    <>
      {site.isDraftPreview && <SiteDraftBadge />}
      <Chrome shop={site.shop} config={site.config} active="collections">
        <Body site={site.config.site} catalog={catalog} basePath={basePath} productHref={productHref} />
      </Chrome>
    </>
  );
}
