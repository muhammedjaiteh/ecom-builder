// /site/[slug] loading state (Phase 6) — instant skeleton while the
// force-dynamic shell resolves requireSite. Tone-neutral premium: the stored
// template_key is unknown before the data read, so the plates use a quiet
// warm-neutral palette that reads as "the boutique is composing" under every
// template. Zero data reads, zero client JS — shimmer is the repo's existing
// animate-pulse idiom. Mirrors the home anatomy: nav strip → full-bleed hero
// → value band → collection grid.
export default function SiteHomeLoading() {
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

      {/* Hero block */}
      <div className="relative h-[62vh] min-h-[420px] w-full animate-pulse bg-gradient-to-br from-neutral-200 via-neutral-100 to-neutral-200">
        <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-7xl px-5 pb-16 md:px-10">
          <div className="h-3 w-40 rounded-full bg-white/70" />
          <div className="mt-5 h-9 w-11/12 max-w-xl rounded-lg bg-white/80 md:h-12" />
          <div className="mt-3 h-9 w-3/5 max-w-md rounded-lg bg-white/70 md:h-12" />
          <div className="mt-7 flex gap-3">
            <div className="h-12 w-40 rounded-full bg-white/90" />
            <div className="hidden h-12 w-44 rounded-full bg-white/50 sm:block" />
          </div>
        </div>
      </div>

      {/* Value-props band */}
      <div className="border-b border-black/5 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-5 py-10 md:grid-cols-3 md:px-10 md:py-12">
          {[0, 1, 2].map((i) => (
            <div key={i} className="animate-pulse text-center">
              <div className="mx-auto h-2.5 w-8 rounded-full bg-neutral-200" />
              <div className="mx-auto mt-4 h-4 w-40 rounded-full bg-neutral-200" />
              <div className="mx-auto mt-3 h-3 w-56 max-w-full rounded-full bg-neutral-100" />
            </div>
          ))}
        </div>
      </div>

      {/* Collection grid of plates */}
      <div className="mx-auto max-w-7xl px-5 py-16 md:px-10 md:py-24">
        <div className="mx-auto h-7 w-64 max-w-full animate-pulse rounded-lg bg-neutral-200 md:h-9" />
        <div className="mx-auto mt-4 h-3 w-80 max-w-full animate-pulse rounded-full bg-neutral-100" />
        <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-square rounded-xl bg-neutral-200" />
              <div className="mt-3 h-3 w-3/4 rounded-full bg-neutral-200" />
              <div className="mt-2 h-3 w-1/3 rounded-full bg-neutral-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
