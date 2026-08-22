// /site/[slug]/collections loading state (Phase 6) — instant catalog
// skeleton for the force-dynamic fetch. Tone-neutral (template unknown
// pre-read), zero data reads, animate-pulse shimmer. Mirrors the catalog
// anatomy: nav strip → collection heading + count line → grid of plates →
// pager pill.
export default function SiteCollectionsLoading() {
  return (
    <div className="min-h-screen bg-[#FAF9F7]">
      {/* Nav bar strip */}
      <div className="border-b border-black/5 bg-white/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:px-10">
          <div className="h-4 w-36 animate-pulse rounded-full bg-neutral-200" />
          <div className="flex items-center gap-3">
            <div className="hidden h-3 w-16 animate-pulse rounded-full bg-neutral-200 md:block" />
            <div className="h-9 w-28 animate-pulse rounded-full bg-neutral-200" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 py-14 md:px-10 md:py-20">
        {/* Collection heading */}
        <div className="mx-auto max-w-xl text-center">
          <div className="mx-auto h-3 w-32 animate-pulse rounded-full bg-neutral-200" />
          <div className="mx-auto mt-5 h-9 w-72 max-w-full animate-pulse rounded-lg bg-neutral-200 md:h-12" />
          <div className="mx-auto mt-4 h-3 w-80 max-w-full animate-pulse rounded-full bg-neutral-100" />
          <div className="mx-auto mt-5 h-2.5 w-40 animate-pulse rounded-full bg-neutral-100" />
        </div>

        {/* Grid of plates — matches the 2/3-or-4-column catalog rhythm */}
        <div className="mt-12 grid grid-cols-2 gap-4 md:mt-16 md:grid-cols-4 md:gap-6">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-square rounded-xl bg-neutral-200" />
              <div className="mt-3 h-3 w-3/4 rounded-full bg-neutral-200" />
              <div className="mt-2 h-3 w-1/3 rounded-full bg-neutral-100" />
            </div>
          ))}
        </div>

        {/* Pager pill */}
        <div className="mt-14 flex items-center justify-center gap-4">
          <div className="h-10 w-24 animate-pulse rounded-full bg-neutral-200" />
          <div className="h-3 w-24 animate-pulse rounded-full bg-neutral-100" />
          <div className="h-10 w-24 animate-pulse rounded-full bg-neutral-200" />
        </div>
      </div>
    </div>
  );
}
