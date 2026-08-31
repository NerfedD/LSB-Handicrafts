/**
 * Display helpers for styro products.
 *
 * Sizes used to be buried in the product name as free text ("Styro Ball 2
 * inch"), which meant the only way to show a size was to slice words off the
 * name. Dimensions are real columns now; these functions turn them back into
 * the labels staff are used to reading.
 *
 * Note the workspace screens print "PHP 1,234.00" inline while the profile
 * screens use profileFormat.formatPeso's "₱". That split is deliberate — the
 * two shells have different visual languages. Don't unify it here.
 */

import { PRODUCT_TYPE, PRODUCT_TYPE_OPTIONS } from './constants';

/**
 * Thicknesses are quoted in halves and quarters in this trade — a sheet is a
 * 1/2" sheet, never a 0.5" sheet. Anything not on this list falls back to a
 * trimmed decimal.
 */
const FRACTIONS = [
  [0.25, '1/4'],
  [0.5, '1/2'],
  [0.75, '3/4'],
  [1.5, '1-1/2'],
  [2.5, '2-1/2'],
];

/** 0.5 -> "1/2", 2 -> "2", 1.25 -> "1.25". */
export function formatInches(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;

  const fraction = FRACTIONS.find(([decimal]) => decimal === n);
  if (fraction) return fraction[1];

  // Trim a trailing ".00" without rounding a genuine 1.25 down to 1.
  return String(Number(n.toFixed(2)));
}

/** 4 -> "4ft", 1.5 -> "1.5ft". */
function formatFeet(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : `${Number(n.toFixed(2))}ft`;
}

/**
 * The size label for a row: `4"` for a ball, `1" × 2ft × 4ft` for a sheet.
 * Returns "—" when a row has no dimensions yet, which is every row created
 * before product_type existed.
 */
export function formatDimensions(item) {
  if (!item) return '—';

  if (item.productType === PRODUCT_TYPE.BALL) {
    const diameter = formatInches(item.diameterIn);
    return diameter ? `${diameter}"` : '—';
  }

  if (
    item.productType === PRODUCT_TYPE.SHEET ||
    item.productType === PRODUCT_TYPE.BLOCK
  ) {
    const thickness = formatInches(item.thicknessIn);
    const parts = [
      thickness ? `${thickness}"` : null,
      formatFeet(item.lengthFt),
      formatFeet(item.widthFt),
    ].filter(Boolean);
    return parts.length ? parts.join(' × ') : '—';
  }

  return '—';
}

/** "Styro Sheet" for the type column. */
export function formatProductType(productType) {
  const match = PRODUCT_TYPE_OPTIONS.find((o) => o.value === productType);
  return match ? match.label : 'Other';
}

/** "per piece" / "per bundle of 10". */
export function formatUnit(item) {
  if (!item) return 'per piece';
  const unit = item.unit || 'piece';
  const packSize = Number(item.packSize) || 1;
  if (unit === 'piece' || packSize <= 1) return `per ${unit}`;
  return `per ${unit} of ${packSize}`;
}

/**
 * A consistent product name built from the dimensions, offered as the default
 * in ProductForm so the catalog doesn't drift into a dozen naming styles. Staff
 * can still overwrite it.
 */
export function suggestProductName(item) {
  const size = formatDimensions(item);
  if (size === '—') return '';
  if (item.productType === PRODUCT_TYPE.BALL) return `Styro Ball ${size}`;
  if (item.productType === PRODUCT_TYPE.SHEET) return `Styro Sheet ${size}`;
  if (item.productType === PRODUCT_TYPE.BLOCK) return `Styro Block ${size}`;
  return '';
}

/**
 * Sort key for dimension-based ordering. Balls sort by diameter, sheets by
 * face area. Returns null for rows with nothing to sort on so callers can push
 * them to the end rather than treating them as zero.
 */
export function sizeSortKey(item) {
  if (!item) return null;
  if (item.productType === PRODUCT_TYPE.BALL) {
    const d = Number(item.diameterIn);
    return Number.isNaN(d) || !item.diameterIn ? null : d;
  }
  const l = Number(item.lengthFt);
  const w = Number(item.widthFt);
  if (!item.lengthFt || !item.widthFt || Number.isNaN(l) || Number.isNaN(w)) {
    return null;
  }
  return l * w;
}
