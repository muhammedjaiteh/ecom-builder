// ─────────────────────────────────────────────────────────────────────────────
// Dalasi formatting — the ONE place a price becomes a label.
//
// The Gambian dalasi renders as a bare "D" prefix (D1,250 — never "GMD",
// never a space). Grouping is PINNED to en-GM (English, The Gambia: standard
// three-digit international commas → D1,000,000), with en-US as the fallback
// on engines that ship without the en-GM CLDR bundle. A bare
// toLocaleString() would follow the device locale instead — "1 250" on a
// fr-GM handset, "1,00,000" on en-IN — and disagree with the server HTML on
// hydration. One module-level formatter: Intl.NumberFormat construction is
// the expensive part, format() is cheap.
// ─────────────────────────────────────────────────────────────────────────────

export const DALASI_PREFIX = 'D';

const dalasiFormatter = new Intl.NumberFormat(['en-GM', 'en-US'], {
  maximumFractionDigits: 2,
});

/** `D1,250` · `D1,000,000` · `D99.5`. Null, undefined, '' and NaN → null so
 *  callers can omit the price line entirely (or show "Price on request"). */
export function formatDalasi(value: number | string | null | undefined): string | null {
  if (value == null || value === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return `${DALASI_PREFIX}${dalasiFormatter.format(amount)}`;
}
