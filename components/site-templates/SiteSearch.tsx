'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { Loader2, Search, WifiOff, X } from 'lucide-react';
import SmartImage from '@/components/SmartImage';
import type { SiteTone } from './chrome';

// ─────────────────────────────────────────────────────────────────────────────
// SiteSearch — the storefront search island, injected into every /site chrome
// nav row (Beta QA UX pass). Scope: THE SHOP'S OWN PRODUCTS ONLY.
//
// DATA PATH (deliberate): a scoped anon browser-client read of the shop's
// catalog — NOT app/api/search. The marketplace route is a Gemini-embedding
// semantic search over the global match_products RPC: it cannot be scoped to
// one shop without changing out-of-repo SQL, costs an embedding round trip per
// query (quota-bound, slow on 2G), and is approximate where a boutique search
// must be exact. Products carry versioned PUBLIC-read RLS (the same anon read
// siteData.ts and SiteCopyEditor already rely on), so one bounded catalog
// fetch on first open + instant local matching is the least-invasive accurate
// option — and the Gambia-honest one: a single request, then every keystroke
// resolves offline-capable from the in-memory index.
//
// MATCHING: tokenized, case-insensitive, over name + category + description.
// Primary results require EVERY token to hit the NAME or CATEGORY (Fix 3:
// description coverage used to promote loose matches — "women dress" hitting
// a cosmetics blurb — into primaries; descriptions now only contribute to
// ranking within a tier and to the any-token fallback pool). Ranking weighs
// name hits > category hits > description hits (name-first is right at shop
// scope: a boutique's categories are near-uniform, its names discriminate).
// Zero primary hits fall back to any-token partial matches, labeled honestly
// as "Related pieces".
//
// EDITOR SAFETY: the Site Editor's preview click-capture blocks every click
// except [role=tab]/[data-carousel-nav] in the capture phase, so the trigger
// is inert inside previews (the CartBagButton contract). data-search-trigger
// marks the node for telemetry/tests.
// ─────────────────────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 250;
const INDEX_LIMIT = 400;
const MAX_RESULTS = 12;

type SearchProduct = {
  id: string;
  name: string;
  price: number | null;
  description: string | null;
  image_url: string | null;
  ad_hero_image_url: string | null;
  category: string | null;
  stock_quantity: number | null;
};

type IndexState = 'idle' | 'loading' | 'ready' | 'offline' | 'error';

type RankedResult = { product: SearchProduct; score: number };

type SearchOutcome = {
  results: SearchProduct[];
  /** True when the list is the honest zero-hit fallback. */
  related: boolean;
};

function tokenize(query: string): string[] {
  return query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function fieldHits(field: string | null, tokens: string[]): number {
  if (!field) return 0;
  const value = field.toLowerCase();
  return tokens.reduce((n, t) => (value.includes(t) ? n + 1 : n), 0);
}

/** Ranked match: name > category > description; all-token NAME/CATEGORY hits
 *  are primary (Fix 3 — description coverage never mints a primary), any-token
 *  hits across all three fields form the "Related pieces" fallback. */
function matchProducts(index: SearchProduct[], query: string): SearchOutcome {
  const tokens = tokenize(query);
  if (tokens.length === 0) return { results: [], related: false };

  const primary: RankedResult[] = [];
  const partial: RankedResult[] = [];

  for (const product of index) {
    const nameHits = fieldHits(product.name, tokens);
    const catHits = fieldHits(product.category, tokens);
    const descHits = fieldHits(product.description, tokens);
    const totalHits = nameHits + catHits + descHits;
    if (totalHits === 0) continue;

    const score = nameHits * 100 + catHits * 10 + descHits;
    // Primary discipline: every token must land in the name or the category.
    // A description-only hit can never promote a product past this gate — it
    // stays in the honestly-labeled "Related pieces" pool below.
    const tokensCovered = tokens.every(
      (t) =>
        product.name.toLowerCase().includes(t) ||
        (product.category ?? '').toLowerCase().includes(t)
    );
    (tokensCovered ? primary : partial).push({ product, score });
  }

  const byScore = (a: RankedResult, b: RankedResult) =>
    b.score - a.score || a.product.name.localeCompare(b.product.name);

  if (primary.length > 0) {
    return { results: primary.sort(byScore).slice(0, MAX_RESULTS).map((r) => r.product), related: false };
  }
  return { results: partial.sort(byScore).slice(0, MAX_RESULTS).map((r) => r.product), related: true };
}

function stockBadge(stock: number | null): { label: string; tone: 'out' | 'low' } | null {
  if (stock == null) return null;
  if (stock <= 0) return { label: 'Sold Out', tone: 'out' };
  if (stock <= 5) return { label: `Only ${stock} left`, tone: 'low' };
  return null;
}

function priceLabel(p: number | null) {
  return p == null ? '' : `D${Number(p).toLocaleString()}`;
}

// ── Tone dialects ────────────────────────────────────────────────────────────

type SearchStyles = {
  trigger: string;
  panel: string;
  inputRow: string;
  input: string;
  close: string;
  sectionLabel: string;
  row: string;
  plate: string;
  plateInitial: string;
  name: string;
  price: string;
  badgeOut: string;
  badgeLow: string;
  muted: string;
  retry: string;
};

const SEARCH_STYLES: Record<SiteTone, SearchStyles> = {
  ritual: {
    trigger:
      'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-stone-600 transition hover:bg-stone-200/60 hover:text-stone-900 active:scale-95',
    panel: 'bg-[#FBFAF7] text-stone-900 shadow-2xl ring-1 ring-stone-200 md:rounded-b-3xl',
    inputRow: 'border-b border-stone-200',
    input: 'placeholder:text-stone-400',
    close: 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-200/60 hover:text-stone-900 active:scale-95',
    sectionLabel: 'text-[10px] font-bold uppercase tracking-[0.3em] text-stone-400',
    row: 'flex min-h-[64px] items-center gap-4 rounded-2xl px-3 py-2.5 transition hover:bg-stone-100 active:bg-stone-100',
    plate: 'relative h-14 w-12 shrink-0 overflow-hidden rounded-xl bg-stone-100 ring-1 ring-stone-200',
    plateInitial: 'flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-200 via-stone-100 to-stone-300 font-serif text-lg italic text-stone-400/70',
    name: 'truncate text-sm font-medium text-stone-800',
    price: 'shrink-0 text-sm text-stone-500',
    badgeOut: 'rounded-full bg-stone-900/90 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white',
    badgeLow: 'rounded-full bg-white px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-700 ring-1 ring-amber-200',
    muted: 'text-sm leading-relaxed text-stone-500',
    retry: 'mt-4 inline-flex min-h-11 items-center rounded-full border border-stone-300 px-6 text-[10px] font-bold uppercase tracking-[0.25em] text-stone-900 transition hover:border-stone-900 active:scale-95',
  },
  editorial: {
    trigger:
      'relative flex h-11 w-11 shrink-0 items-center justify-center border border-neutral-900 bg-[#F7F5F0] text-neutral-900 transition hover:bg-neutral-900 hover:text-[#F7F5F0] active:scale-95',
    panel: 'border-b border-neutral-900 bg-[#F7F5F0] text-neutral-900 shadow-2xl',
    inputRow: 'border-b border-neutral-900',
    input: 'placeholder:text-neutral-400',
    close: 'flex h-11 w-11 shrink-0 items-center justify-center border border-neutral-900 text-neutral-900 transition hover:bg-neutral-900 hover:text-[#F7F5F0] active:scale-95',
    sectionLabel: 'text-[10px] font-bold uppercase tracking-[0.35em] text-neutral-500',
    row: 'flex min-h-[64px] items-center gap-4 border-b border-neutral-200 px-3 py-2.5 transition hover:bg-neutral-900/5 active:bg-neutral-900/5',
    plate: 'relative h-14 w-12 shrink-0 overflow-hidden border border-neutral-300',
    plateInitial: 'flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-200 via-[#EDEAE2] to-neutral-300 font-serif text-lg italic text-neutral-400/60',
    name: 'truncate font-serif text-sm italic text-neutral-900',
    price: 'shrink-0 text-[11px] text-neutral-500',
    badgeOut: 'bg-neutral-900 px-2.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.2em] text-white',
    badgeLow: 'bg-[#F7F5F0] px-2.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.2em] text-amber-800 ring-1 ring-neutral-900',
    muted: 'text-sm leading-relaxed text-neutral-500',
    retry: 'mt-4 inline-flex min-h-11 items-center border border-neutral-900 px-6 text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-900 transition hover:bg-neutral-900 hover:text-[#F7F5F0] active:scale-95',
  },
  neutral: {
    trigger:
      'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white active:scale-95',
    panel: 'bg-[#111] text-white shadow-2xl ring-1 ring-white/10 md:rounded-b-3xl',
    inputRow: 'border-b border-white/10',
    input: 'placeholder:text-white/30',
    close: 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white active:scale-95',
    sectionLabel: 'text-[10px] font-black uppercase tracking-[0.25em] text-white/40',
    row: 'flex min-h-[64px] items-center gap-4 rounded-2xl px-3 py-2.5 transition hover:bg-white/5 active:bg-white/5',
    plate: 'relative h-14 w-12 shrink-0 overflow-hidden rounded-xl bg-black ring-1 ring-white/15',
    plateInitial: 'flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1c1c1c] via-[#141414] to-[#242424] text-lg font-black uppercase text-white/20',
    name: 'truncate text-sm font-black uppercase tracking-tight text-white',
    price: 'shrink-0 text-sm font-black text-[#f0a500]',
    badgeOut: 'rounded-sm bg-white px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-black',
    badgeLow: 'rounded-sm bg-[#f0a500] px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-black',
    muted: 'text-sm leading-relaxed text-white/50',
    retry: 'mt-4 inline-flex min-h-11 items-center rounded-full bg-[#f0a500] px-6 text-[10px] font-black uppercase tracking-[0.2em] text-black transition hover:bg-amber-400 active:scale-95',
  },
};

type SiteSearchProps = {
  /** Shop id (auth-user id) — scopes the catalog read. */
  shopId: string;
  tone: SiteTone;
  /** Canonical /site/{slug} base; null in slugless previews. */
  basePath: string | null;
  shopName?: string | null;
};

export default function SiteSearch({ shopId, tone, basePath, shopName }: SiteSearchProps) {
  const styles = SEARCH_STYLES[tone];
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [index, setIndex] = useState<SearchProduct[] | null>(null);
  const [indexState, setIndexState] = useState<IndexState>('idle');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const productHref = useCallback(
    (id: string) => (basePath ? `${basePath}/products/${id}` : `/product/${id}`),
    [basePath]
  );

  // One bounded catalog fetch per session — subsequent keystrokes match the
  // in-memory index (works even if connectivity drops after loading).
  const loadIndex = useCallback(async () => {
    setIndexState('loading');
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, description, image_url, ad_hero_image_url, category, stock_quantity')
        .or(`shop_id.eq.${shopId},user_id.eq.${shopId}`)
        .order('created_at', { ascending: false })
        .limit(INDEX_LIMIT);
      if (error) throw new Error(error.message);
      setIndex((data ?? []) as SearchProduct[]);
      setIndexState('ready');
    } catch {
      setIndex(null);
      setIndexState(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error');
    }
  }, [shopId]);

  // Open: focus the field, fetch the index once, lock body scroll (mobile
  // full-sheet), and close on Escape.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    if (index === null && indexState !== 'loading') void loadIndex();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, index, indexState, loadIndex]);

  // Restore focus to the trigger when the overlay closes (keyboard flow).
  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  }, []);

  // Debounce — matching is local, but the settle keeps the result list calm.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const outcome = useMemo<SearchOutcome>(() => {
    if (!index || !debounced.trim()) return { results: [], related: false };
    return matchProducts(index, debounced);
  }, [index, debounced]);

  const hasQuery = debounced.trim().length > 0;

  const handleInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      listRef.current?.querySelector<HTMLAnchorElement>('a')?.focus();
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-search-trigger
        aria-label={`Search ${shopName ?? 'the boutique'}`}
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={styles.trigger}
      >
        <Search size={19} strokeWidth={tone === 'neutral' ? 2 : 1.5} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[80]">
          {/* Backdrop — click closes (desktop dropdown + mobile sheet). */}
          <div aria-hidden onClick={close} className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search products"
            className={`absolute inset-x-0 top-0 flex h-full flex-col md:mx-auto md:h-auto md:max-h-[80vh] md:max-w-3xl ${styles.panel}`}
          >
            {/* Inline search row — the nav expands into the field. */}
            <div className={`flex items-center gap-3 px-4 py-3 md:px-6 ${styles.inputRow}`}>
              <Search size={18} className="shrink-0 opacity-50" aria-hidden />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder={`Search ${shopName ?? 'the collection'}…`}
                aria-label="Search products"
                enterKeyHint="search"
                className={`min-h-11 w-full min-w-0 flex-1 bg-transparent text-base outline-none ${styles.input}`}
              />
              <button type="button" onClick={close} aria-label="Close search" className={styles.close}>
                <X size={18} />
              </button>
            </div>

            {/* Results / states */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 md:px-5">
              {indexState === 'loading' && (
                <div className="flex items-center gap-3 px-3 py-6">
                  <Loader2 size={16} className="animate-spin opacity-60" aria-hidden />
                  <p className={styles.muted}>Loading the collection…</p>
                </div>
              )}

              {(indexState === 'offline' || indexState === 'error') && (
                <div className="px-3 py-6 text-center">
                  {indexState === 'offline' ? (
                    <>
                      <WifiOff size={20} className="mx-auto opacity-50" aria-hidden />
                      <p className={`mt-3 ${styles.muted}`}>
                        You appear to be offline — search needs a connection to load the collection.
                      </p>
                    </>
                  ) : (
                    <p className={styles.muted}>The collection could not be loaded. Please try again.</p>
                  )}
                  <button type="button" onClick={() => void loadIndex()} className={styles.retry}>
                    Try again
                  </button>
                </div>
              )}

              {indexState === 'ready' && !hasQuery && (
                <p className={`px-3 py-6 ${styles.muted}`}>
                  Type to search {index?.length === 1 ? 'the piece' : `${index?.length ?? 0} pieces`} by name, category, or description.
                </p>
              )}

              {indexState === 'ready' && hasQuery && outcome.results.length === 0 && (
                <p className={`px-3 py-6 ${styles.muted}`}>
                  Nothing in the collection matches &ldquo;{debounced.trim()}&rdquo;.
                </p>
              )}

              {indexState === 'ready' && outcome.results.length > 0 && (
                <>
                  <p className={`px-3 pb-2 ${styles.sectionLabel}`}>
                    {outcome.related ? 'Related pieces' : `Results (${outcome.results.length})`}
                  </p>
                  <ul ref={listRef} className={tone === 'editorial' ? 'border-t border-neutral-200' : 'space-y-1'}>
                    {outcome.results.map((p) => {
                      const badge = stockBadge(p.stock_quantity);
                      const plateSrc = p.ad_hero_image_url ?? p.image_url;
                      return (
                        <li key={p.id}>
                          <Link href={productHref(p.id)} onClick={() => setOpen(false)} className={styles.row}>
                            <span className={styles.plate}>
                              {plateSrc ? (
                                <SmartImage
                                  src={plateSrc}
                                  alt=""
                                  fill
                                  sizes="48px"
                                  blurTone="none"
                                  className="object-cover"
                                />
                              ) : (
                                <span className={styles.plateInitial}>{p.name.charAt(0).toUpperCase()}</span>
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={`block ${styles.name}`}>{p.name}</span>
                              {badge && (
                                <span className={`mt-1 inline-block ${badge.tone === 'out' ? styles.badgeOut : styles.badgeLow}`}>
                                  {badge.label}
                                </span>
                              )}
                            </span>
                            <span className={styles.price}>{priceLabel(p.price)}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
