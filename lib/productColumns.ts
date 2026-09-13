// ─────────────────────────────────────────────────────────────────────────────
// Optional product columns — pack-not-yet-run resilience (Gambia Standard §3).
//
// New products columns ship as founder-run, additive SQL packs applied by
// hand in the Supabase SQL editor (sql/*.sql). Until a pack has run, an
// explicit `.select('…, compare_at_price')` fails with PostgreSQL 42703
// (undefined_column) — and every read path THROWS on error, which would
// render the mall and the boutique sites EMPTY over a missing "nice to have"
// column. selectWithOptionalColumns tries the full column list first and, on
// 42703 ONLY, re-issues the exact same query without the optional columns.
// Once the pack has run the first attempt succeeds and the fallback never
// fires; before it has run, each uncached read pays one cheap failed
// round-trip and the surface degrades to "no sale shown".
// ─────────────────────────────────────────────────────────────────────────────

/** products.compare_at_price — sql/compare-at-price.sql. */
export const COMPARE_AT_COLUMN = 'compare_at_price';

export type ColumnError = { code?: string | null; message?: string | null };

/** The narrowed response callers consume: `data` typed by the caller's `T`. */
export type OptionalColumnsResult<T> = { data: T | null; error: ColumnError | null };

/** PostgreSQL 42703 (undefined_column) is the ONLY signature we degrade on;
 *  every other failure (RLS, network, syntax) surfaces exactly as before. */
export function isUndefinedColumnError(error: ColumnError | null | undefined): boolean {
  if (!error) return false;
  if (error.code === '42703') return true;
  return /column .* does not exist/i.test(error.message ?? '');
}

/**
 * Runs `query(columns)` with `base + optional` columns, falling back to `base`
 * alone when — and only when — the failure is an undefined column.
 * `query` must build a FRESH PostgREST builder each call (builders are
 * single-use), e.g. `(cols) => supabase.from('products').select(cols).limit(96)`.
 * `T` is the caller's row shape (`Product[]`, `SitePdpProduct`, …) — the
 * select string is dynamic, so PostgREST cannot infer it.
 */
export async function selectWithOptionalColumns<T = unknown>(
  baseColumns: string,
  optionalColumns: readonly string[],
  query: (columns: string) => PromiseLike<{ data: unknown; error: ColumnError | null }>,
  label = 'products',
): Promise<OptionalColumnsResult<T>> {
  const run = async (columns: string) => (await query(columns)) as OptionalColumnsResult<T>;
  if (optionalColumns.length === 0) return run(baseColumns);
  const first = await run(`${baseColumns}, ${optionalColumns.join(', ')}`);
  if (!first.error || !isUndefinedColumnError(first.error)) return first;
  console.warn(
    `[${label}] optional column(s) ${optionalColumns.join(', ')} missing — run sql/compare-at-price.sql. Degrading to base columns.`,
  );
  return run(baseColumns);
}
