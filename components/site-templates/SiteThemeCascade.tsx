'use client';

import { useEffect } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// SiteThemeCascade — THE CASCADE GAP FIX (Pillar 4). The Cart drawer and its
// order flow mount in the ROOT layout, OUTSIDE the /site subtree, so the
// chrome wrappers' style-attribute variables never reach them: an on-site
// buyer opened a Sanndikaa-green cart inside a terracotta boutique.
//
// This tiny island mounts ONLY on the real /site pages (home, /collections,
// /products/[id]) — NEVER in the dashboard editor preview or MiniSitePreview,
// which render the same templates but must not leak boutique tokens onto the
// dashboard's document root. While mounted it sets the resolved theme
// variables on document.documentElement so every portal/root-layout surface
// (Cart's primary buttons consume var(--site-primary/--site-accent/
// --site-radius, <their exact historical literals>)) inherits the boutique
// theme; cleanup restores whatever each property held before.
//
// REF-COUNT GUARD: App-Router client navigation can mount the next page's
// island before the previous page's cleanup runs. A module-level registry
// counts active mounts per property and snapshots the ORIGINAL (pre-cascade)
// value once — properties are only restored when the LAST island releases
// them, so an overlap can never wipe the incoming page's tokens.
// ─────────────────────────────────────────────────────────────────────────────

type PropertyClaim = { count: number; original: string };

const claims = new Map<string, PropertyClaim>();

function claimProperty(name: string, value: string) {
  const root = document.documentElement;
  const existing = claims.get(name);
  if (existing) {
    existing.count += 1;
  } else {
    claims.set(name, { count: 1, original: root.style.getPropertyValue(name) });
  }
  root.style.setProperty(name, value);
}

function releaseProperty(name: string) {
  const claim = claims.get(name);
  if (!claim) return;
  claim.count -= 1;
  if (claim.count > 0) return;
  claims.delete(name);
  const root = document.documentElement;
  if (claim.original) {
    root.style.setProperty(name, claim.original);
  } else {
    root.style.removeProperty(name);
  }
}

export default function SiteThemeCascade({ vars }: { vars: Record<string, string> }) {
  useEffect(() => {
    const names = Object.keys(vars);
    for (const name of names) claimProperty(name, vars[name]);
    return () => {
      for (const name of names) releaseProperty(name);
    };
  }, [vars]);

  return null;
}
