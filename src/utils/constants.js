/**
 * Shared status and enum literals.
 *
 * These strings were previously re-typed at every site that filtered, sorted or
 * coloured on them — order status alone appeared in eight files. A typo in any
 * one of them fails silently: the row just never matches. Import from here.
 *
 * The values are the exact strings already stored in Supabase, so this file is
 * a rename of existing literals, not a migration. Changing a value here means
 * rewriting stored rows.
 */

export const ORDER_STATUS = {
  PENDING: 'Pending',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const DELIVERY_STATUS = {
  NOT_YET: 'Not Yet Delivered',
  ON_THE_WAY: 'On The Way',
  DELIVERED: 'Delivered',
};

/**
 * Derived from available stock, never typed by a user — see stockLedger.statusOf.
 * OUT is new: before per-product thresholds existed the UI only distinguished
 * "Low Stock" from everything else.
 */
export const STOCK_STATUS = {
  IN: 'In Stock',
  LOW: 'Low Stock',
  OUT: 'Out of Stock',
};

/**
 * Which dimension fields a product actually has. Stored lowercase because these
 * are structural discriminators the code branches on, not display labels —
 * productFormat.formatProductType renders them for people.
 */
export const PRODUCT_TYPE = {
  BALL: 'ball',
  SHEET: 'sheet',
  BLOCK: 'block',
  OTHER: 'other',
};

export const PRODUCT_TYPE_OPTIONS = [
  { value: PRODUCT_TYPE.BALL, label: 'Styro Ball' },
  { value: PRODUCT_TYPE.SHEET, label: 'Styro Sheet' },
  { value: PRODUCT_TYPE.BLOCK, label: 'Styro Block' },
  { value: PRODUCT_TYPE.OTHER, label: 'Other' },
];

/** How a product is counted and sold. `piece` implies a pack size of 1. */
export const SELL_UNIT_OPTIONS = [
  { value: 'piece', label: 'Per Piece' },
  { value: 'pack', label: 'Per Pack' },
  { value: 'bundle', label: 'Per Bundle' },
  { value: 'sheet', label: 'Per Sheet' },
];

/**
 * Order line kinds. `catalog` and `negotiated` sell a stocked product as-is;
 * `cut` and `custom` are the made-to-order cases, both priced by hand.
 */
export const LINE_KIND = {
  CATALOG: 'catalog',
  NEGOTIATED: 'negotiated',
  CUT: 'cut',
  CUSTOM: 'custom',
};

export const LINE_KIND_OPTIONS = [
  { value: LINE_KIND.CATALOG, label: 'Catalog' },
  { value: LINE_KIND.NEGOTIATED, label: 'Negotiated Price' },
  { value: LINE_KIND.CUT, label: 'Cut to Size' },
  { value: LINE_KIND.CUSTOM, label: 'Custom Shape' },
];
