// /site/[slug]/products/[id] loading state (Phase 6) — instant PDP skeleton
// for the force-dynamic fetch. Tone-neutral (template unknown pre-read), zero
// data reads, animate-pulse shimmer. Mirrors the PDP anatomy: nav strip →
// breadcrumb → gallery plate + thumbnails | purchase panel (title, price,
// description, variant pills, CTA row, fulfillment facts).
export default function SiteProductLoading() {
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

      <div className="mx-auto max-w-7xl px-5 py-10 md:px-10 md:py-16">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-12 animate-pulse rounded-full bg-neutral-200" />
          <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-neutral-100" />
          <div className="h-2.5 w-20 animate-pulse rounded-full bg-neutral-200" />
          <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-neutral-100" />
          <div className="h-2.5 w-28 animate-pulse rounded-full bg-neutral-100" />
        </div>

        <div className="mt-8 grid grid-cols-1 items-start gap-10 md:mt-12 md:grid-cols-2 md:gap-16">
          {/* Gallery: hero plate + thumbnail rail */}
          <div className="animate-pulse">
            <div className="aspect-[4/5] w-full rounded-2xl bg-neutral-200" />
            <div className="mt-3 flex gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-16 w-16 shrink-0 rounded-lg bg-neutral-100" />
              ))}
            </div>
          </div>

          {/* Purchase panel */}
          <div className="animate-pulse">
            <div className="h-2.5 w-24 rounded-full bg-neutral-200" />
            <div className="mt-4 h-8 w-4/5 rounded-lg bg-neutral-200 md:h-11" />
            <div className="mt-3 h-8 w-1/2 rounded-lg bg-neutral-100 md:h-11" />
            <div className="mt-6 flex items-center gap-4">
              <div className="h-7 w-28 rounded-lg bg-neutral-200" />
              <div className="h-6 w-20 rounded-full bg-neutral-100" />
            </div>
            <div className="my-7 h-px w-16 bg-neutral-200" />
            <div className="space-y-2.5">
              <div className="h-3 w-full max-w-md rounded-full bg-neutral-100" />
              <div className="h-3 w-11/12 max-w-md rounded-full bg-neutral-100" />
              <div className="h-3 w-2/3 max-w-md rounded-full bg-neutral-100" />
            </div>
            {/* Variant pills + stepper */}
            <div className="mt-8 flex flex-wrap gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-9 w-20 rounded-full bg-neutral-100" />
              ))}
            </div>
            <div className="mt-6 h-11 w-36 rounded-full bg-neutral-100" />
            {/* CTA row */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <div className="h-12 w-full rounded-full bg-neutral-200 sm:w-48" />
              <div className="h-12 w-full rounded-full bg-neutral-300 sm:w-56" />
            </div>
            {/* Fulfillment facts */}
            <div className="mt-10 space-y-2.5">
              <div className="h-2.5 w-32 rounded-full bg-neutral-200" />
              <div className="h-3 w-48 rounded-full bg-neutral-100" />
              <div className="h-3 w-44 rounded-full bg-neutral-100" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
