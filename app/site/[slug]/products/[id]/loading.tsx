// /site/[slug]/products/[id] loading state — instant PDP skeleton for the
// force-dynamic fetch. Tone-neutral (template unknown pre-read), zero data
// reads, animate-pulse shimmer. Mirrors the Phase 2 PDP anatomy so the real
// page lands without a layout jump: nav strip → breadcrumb → 7/5 split
// (vertical thumb rail + 4:5 frame | purchase column: eyebrow, title, price,
// description, variant pills, stepper, two equal CTAs, fulfillment pane).
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

      <div className="mx-auto max-w-7xl px-5 pb-16 pt-6 md:px-10 md:pb-24 md:pt-10">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-12 animate-pulse rounded-full bg-neutral-200" />
          <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-neutral-100" />
          <div className="h-2.5 w-20 animate-pulse rounded-full bg-neutral-200" />
          <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-neutral-100" />
          <div className="h-2.5 w-28 animate-pulse rounded-full bg-neutral-100" />
        </div>

        <div className="mt-6 grid grid-cols-1 items-start gap-10 md:mt-10 md:grid-cols-12 md:gap-12 lg:gap-16">
          {/* Gallery: vertical rail + tall frame (full-bleed below md) */}
          <div className="animate-pulse md:col-span-7 md:grid md:grid-cols-[4.5rem_minmax(0,1fr)] md:gap-4">
            <div className="hidden md:flex md:flex-col md:gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-[5.5rem] w-[4.5rem] rounded-xl bg-neutral-100" />
              ))}
            </div>
            <div className="-mx-5 md:mx-0">
              <div className="aspect-[4/5] w-full bg-neutral-200 md:rounded-2xl" />
            </div>
            <div className="mt-4 flex gap-3 md:hidden">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-[5.5rem] w-[4.5rem] shrink-0 rounded-xl bg-neutral-100" />
              ))}
            </div>
          </div>

          {/* Purchase column */}
          <div className="animate-pulse md:col-span-5">
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
            {/* CTA row — two equal prominent buttons */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <div className="h-12 flex-1 rounded-full bg-neutral-200" />
              <div className="h-12 flex-1 rounded-full bg-neutral-300" />
            </div>
            {/* Fulfillment pane */}
            <div className="mt-10 rounded-2xl border border-neutral-200 p-5 md:p-6">
              <div className="h-2.5 w-32 rounded-full bg-neutral-200" />
              <div className="mt-4 flex items-start gap-4">
                <div className="h-9 w-9 shrink-0 rounded-full bg-neutral-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-48 rounded-full bg-neutral-200" />
                  <div className="h-2.5 w-56 rounded-full bg-neutral-100" />
                </div>
              </div>
              <div className="mt-5 flex items-start gap-4 border-t border-neutral-200 pt-5">
                <div className="h-9 w-9 shrink-0 rounded-full bg-neutral-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-44 rounded-full bg-neutral-200" />
                  <div className="h-2.5 w-52 rounded-full bg-neutral-100" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
