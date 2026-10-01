// ─────────────────────────────────────────────────────────────────────────────
// Storefront matrices — shops.theme_matrix vocabulary.
//
// Ships in supabase/migrations/20261001010000_add_theme_matrix_to_shops.sql
// (varchar(32) NOT NULL DEFAULT 'classic', CHECK-constrained to the ids
// below). This file is the single client-side source of truth: the Themes
// page renders THEME_MATRICES and the DB constraint mirrors it — extend both
// together.
//
//   classic      /shop/[slug] ClassicShopPage — theme_color + store_layout
//                keep styling it exactly as before.
//   banjul-noir  BanjulNoirStorefront (components/generator/matrix), the
//                luxury dark matrix served by the /s/[slug] adapter.
// ─────────────────────────────────────────────────────────────────────────────

export const THEME_MATRICES = [
  {
    id: 'classic',
    name: 'Classic Boutique',
    desc: 'Your brand color and boutique layout, served at /shop',
  },
  {
    id: 'banjul-noir',
    name: 'Banjul Noir (Luxury Dark)',
    desc: 'Forest-dark editorial matrix with gold accents, served at /s',
  },
] as const;

export type ThemeMatrixId = (typeof THEME_MATRICES)[number]['id'];

/** Mirrors the column DEFAULT — the value every pre-migration row carries. */
export const DEFAULT_THEME_MATRIX: ThemeMatrixId = 'classic';

export function isThemeMatrixId(value: unknown): value is ThemeMatrixId {
  return THEME_MATRICES.some((matrix) => matrix.id === value);
}

/** Unknown / NULL / pre-migration (column absent) → the default matrix. */
export function normalizeThemeMatrix(value: unknown): ThemeMatrixId {
  return isThemeMatrixId(value) ? value : DEFAULT_THEME_MATRIX;
}

/** Public path the chosen matrix is served from, for a canonical slug. */
export function themeMatrixPath(matrix: ThemeMatrixId, slug: string): string {
  return matrix === 'banjul-noir' ? `/s/${slug}` : `/shop/${slug}?classic=1`;
}
