// ─────────────────────────────────────────────────────────────────────────────
// Storefront matrices — shops.theme_matrix vocabulary.
//
// This file is the single client-side source of truth: the Themes page renders 
// THEME_MATRICES and the DB constraint mirrors it.
// ─────────────────────────────────────────────────────────────────────────────

export const THEME_MATRICES = [
  {
    id: 'classic',
    name: 'Classic Boutique',
    desc: 'Legacy layout (Deprecated)',
  },
  {
    id: 'banjul-noir',
    name: 'Banjul Noir (Luxury Dark)',
    desc: 'Forest-dark editorial matrix with gold accents',
  },
  {
    id: 'dakar-minimal',
    name: 'Dakar Minimal (High Fashion)',
    desc: 'Stark, asymmetric brutalist editorial matrix',
  },
  {
    id: 'sahara-tech',
    name: 'Sahara Tech (Industrial)',
    desc: 'Precision grid matrix for electronics and utility',
  }
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

/** 
 * Public path the chosen matrix is served from, for a canonical slug. 
 * THE APEX SWITCHBOARD: All matrices are now seamlessly served through /shop/[slug]
 */
export function themeMatrixPath(matrix: ThemeMatrixId, slug: string): string {
  return `/shop/${slug}`;
}