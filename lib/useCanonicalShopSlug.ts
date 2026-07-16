'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Canonical /site slug for client-side link minting (Law 2: safe URL slugs).
//
// /site links are minted ONLY from a slug that is already canonical
// (lowercase, hyphenated) in the DB. Slugifying a legacy value client-side
// could collide with ANOTHER shop's canonical slug and open the wrong
// storefront — so legacy rows yield null until the server-side write-repair
// round-trips the slug this shop verifiably owns. Same contract
// WebsiteGeneratorStudio enforces internally; this hook shares it with the
// Online Store surfaces (Pages, Navigation).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { slugify } from '@/lib/slugify';

/**
 * @param rawSlug  shops.shop_slug as stored (may be legacy: spaces/uppercase).
 * @param enabled  gate for the repair call — pass the tier check; the
 *                 repair-slug endpoint is tier-gated like the studio itself.
 * @returns the canonical slug safe to mint /site links with, or null while
 *          the slug is legacy and un-repaired.
 */
export function useCanonicalShopSlug(rawSlug: string | null, enabled: boolean): string | null {
  const [slug, setSlug] = useState<string | null>(rawSlug);

  // The shop row loads asynchronously in every consumer — adopt the stored
  // value once it arrives.
  useEffect(() => { setSlug(rawSlug); }, [rawSlug]);

  const canonical = slug && slug === slugify(slug) ? slug : null;

  // Write-repair a legacy slug on mount (server resolves collisions with a
  // deterministic suffix and returns the canonical slug we mint links with).
  useEffect(() => {
    if (!enabled || canonical) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/ai/generate-website', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ step: 'repair-slug' }),
        });
        const data = await res.json();
        if (!cancelled && res.ok && typeof data.shop_slug === 'string' && data.shop_slug) {
          setSlug(data.shop_slug);
        }
      } catch {
        // Non-fatal: the /site route's verified fallback still resolves
        // legacy slugs; we simply don't mint a link until repair succeeds.
      }
    })();
    return () => { cancelled = true; };
  }, [enabled, canonical]);

  return canonical;
}
