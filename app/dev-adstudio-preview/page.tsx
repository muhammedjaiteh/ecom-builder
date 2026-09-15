// TEMPORARY visual-verification page for the Ad Studio compositor.
// Deleted before hand-off — not part of the deliverable.
import AdStudioCanvas from '@/components/ad-studio/AdStudioCanvas';
import { NICHE_PRESETS, composeEditorialCopy, toDisplayTitle, type NicheKey } from '@/lib/adStudio/nichePresets';

type Params = Record<string, string | string[] | undefined>;

export default async function Page({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const img = typeof sp.img === 'string' ? sp.img : '/logo.png';
  const niche = (typeof sp.niche === 'string' && sp.niche in NICHE_PRESETS ? sp.niche : 'LUXURY_BEAUTY') as NicheKey;
  const title = typeof sp.title === 'string' ? sp.title : 'Baobab Oil';
  const variant = typeof sp.v === 'string' ? Number(sp.v) : 0;
  const w1 = typeof sp.w1 === 'string' ? Number(sp.w1) : 480;
  const w2 = typeof sp.w2 === 'string' ? Number(sp.w2) : 380;
  const copy = composeEditorialCopy(NICHE_PRESETS[niche], { productTitle: title, variant });

  return (
    <main className="flex min-h-screen flex-wrap items-start gap-6 bg-mall-bone p-6">
      <div className="shrink-0 outline outline-1 outline-red-500/40" style={{ width: w1 }}>
        <AdStudioCanvas
          imageUrl={img}
          aspectRatio="1:1"
          copy={copy}
          price={1250}
          tenantDomain="https://shop.sanndikaa.gm/"
          productTitle={toDisplayTitle(title)}
          niche={niche}
        />
      </div>
      <div className="shrink-0 outline outline-1 outline-red-500/40" style={{ width: w2 }}>
        <AdStudioCanvas
          imageUrl={img}
          aspectRatio="9:16"
          copy={copy}
          price={1250}
          tenantDomain="shop.sanndikaa.gm"
          productTitle={toDisplayTitle(title)}
          niche={niche}
        />
      </div>
    </main>
  );
}
