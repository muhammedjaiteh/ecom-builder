import { Fragment, type CSSProperties } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// MarketplaceMarquee — the truthful trust ribbon under the marketplace header.
// Structural clone of SiteMarquee (components/site-templates/SiteMarquee.tsx)
// reusing the EXISTING .sndk-marquee* classes and --sndk-marquee-duration var
// from globals.css — zero new CSS: duplicated track (the second group is the
// aria-hidden twin that makes translateX(-50%) loop seamlessly), sr-only
// claim list for assistive tech, and the reduced-motion static twin.
//
// EVERY claim below is feature-verified against the shipped platform:
//   · Direct WhatsApp Checkout      — the checkout IS a WhatsApp handoff
//   · Secure Checkout — 256-bit SSL — TLS on every page, platform-wide
//   · Cash & Wave Accepted          — the payment methods sellers settle in
//   · Curated Independent Boutiques — "Curated" (an editorial fact), NOT
//                                     "Verified" (no verification program
//                                     exists — same integrity class as the
//                                     escrow scrub)
// The old 4-badge strip claimed Free Delivery over D500 (false — delivery is
// per-seller), Buyer Protection (no program), and Easy Returns (no program);
// those claims are deleted, not rephrased.
// ─────────────────────────────────────────────────────────────────────────────

const TRUST_CLAIMS = [
  'Direct WhatsApp Checkout',
  'Secure Checkout — 256-bit SSL',
  'Cash & Wave Accepted',
  'Curated Independent Boutiques',
] as const;

// Same loop math as SiteMarquee: repeat until one group outruns any viewport,
// duration scales with token count so linear speed stays constant.
const MIN_SEQUENCE_TOKENS = 8;
const SECONDS_PER_TOKEN = 5;

export default function MarketplaceMarquee() {
  const sequence: string[] = [];
  while (sequence.length < MIN_SEQUENCE_TOKENS) sequence.push(...TRUST_CLAIMS);

  // Reduced-motion static line: first two claims only (a centered crop of all
  // four would clip mid-word on narrow Gambian handsets — same documented
  // degradation SiteMarquee ships).
  const staticTokens = TRUST_CLAIMS.slice(0, 2);

  const style = { '--sndk-marquee-duration': `${sequence.length * SECONDS_PER_TOKEN}s` } as CSSProperties;

  const tokenClass = 'text-[10px] font-bold uppercase tracking-[0.3em] text-[#1a2e1a]';
  const glyphClass = 'mx-5 text-[10px] text-[#f0a500] md:mx-8';

  const renderGroup = (twin: boolean) => (
    <div
      {...(twin ? { 'data-marquee-twin': '' } : {})}
      className="flex w-max shrink-0 items-center whitespace-nowrap"
    >
      {sequence.map((token, i) => (
        <Fragment key={i}>
          <span className={tokenClass}>{token}</span>
          <span className={glyphClass}>◆</span>
        </Fragment>
      ))}
    </div>
  );

  return (
    <section className="border-b border-black/5 bg-white">
      {/* Screen-reader claim list — the moving ribbon is aria-hidden by
          design, so assistive tech hears each claim exactly once. */}
      <div className="sr-only">
        {TRUST_CLAIMS.map((claim) => (
          <p key={claim}>{claim}</p>
        ))}
      </div>
      <div aria-hidden className="sndk-marquee py-3.5 md:py-4">
        <div className="sndk-marquee-track" style={style}>
          {renderGroup(false)}
          {renderGroup(true)}
        </div>
        {/* Reduced-motion fallback (display toggled in globals.css). */}
        <div className="sndk-marquee-static min-w-0 items-center justify-center px-5">
          {staticTokens.map((token, i) => (
            <Fragment key={token}>
              {i > 0 && <span className={`shrink-0 ${glyphClass}`}>◆</span>}
              <span className={`min-w-0 truncate ${tokenClass}`}>{token}</span>
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
