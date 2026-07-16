// Draft-preview badge shared by every /site page (home, collections, product
// detail). Rendered only for the network-verified owner of an unpublished
// site — anonymous visitors never reach a page that shows it.
export default function SiteDraftBadge() {
  return (
    <div className="fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#1a2e1a] px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-2xl ring-1 ring-white/15">
      <span className="h-1.5 w-1.5 rounded-full bg-[#f0a500]" />
      Draft Preview — only you can see this
    </div>
  );
}
