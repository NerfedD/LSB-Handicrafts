/**
 * Shared status and enum literals.
 *
 * These strings were previously re-typed at every site that filtered, sorted or
 * coloured on them — order status alone appeared in eight files. A typo in any
 * one of them fails silently: the row just never matches. Import from here.
 *
 * The values are the exact strings stored in Supabase, so this file is a rename
 * of existing literals, not a migration. Changing a value here means rewriting
 * stored rows.
 *
 * DISPLAY COPY IS NOT HERE. "Pending" reads as "Waiting" and "Low Stock" as
 * "Running low" throughout the UI; that mapping lives in utils/copy.js so the
 * stored literal and the words on screen can differ without either being
 * ambiguous.
 */

export const ORDER_STATUS = {
  PENDING: 'Pending',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

/**
 * The five places a delivery can be.
 *
 * THREE OF THESE ARE THE ORIGINAL VALUES. The overhaul's deliveries board (2k)
 * needs five columns where the old screen had three, and the two new stages are
 * added ALONGSIDE the existing strings rather than replacing them — so every
 * delivery row already in the database keeps rendering in the column it was
 * already in, with no migration and no chance of a row landing nowhere.
 *
 * `deliveries.status` has no check constraint (see supabase/schema.sql, which
 * explains why), so the new values need no schema change either.
 *
 * ORDER MATTERS: copy.DELIVERY_STAGES lists them in this sequence, and that
 * sequence is what the detail screen's "It arrived" / "Move back" buttons walk.
 */
export const DELIVERY_STAGE = {
  NOT_SENT: 'Not Yet Delivered',
  BEING_MADE: 'Being Made',
  READY: 'Ready To Go',
  ON_THE_WAY: 'On The Way',
  ARRIVED: 'Delivered',
};

/**
 * The previous name for the subset above. Kept as an alias because the legacy
 * workspace screens imported it; new code should use DELIVERY_STAGE.
 */
export const DELIVERY_STATUS = {
  NOT_YET: DELIVERY_STAGE.NOT_SENT,
  ON_THE_WAY: DELIVERY_STAGE.ON_THE_WAY,
  DELIVERED: DELIVERY_STAGE.ARRIVED,
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

/**
 * The product-kind choice buttons on the add-a-product form (2g), in the order
 * they are shown. `icon` is the shape icon that appears on the button and then
 * again beside every row of that kind in the products table, so a kind is
 * recognisable before the words are read.
 */
export const PRODUCT_TYPE_OPTIONS = [
  { value: PRODUCT_TYPE.BALL,  label: 'Styro ball',   icon: 'circle' },
  { value: PRODUCT_TYPE.SHEET, label: 'Styro sheet',  icon: 'square' },
  { value: PRODUCT_TYPE.BLOCK, label: 'Styro block',  icon: 'box' },
  { value: PRODUCT_TYPE.OTHER, label: 'Something else', icon: 'shapes' },
];

/**
 * How a product is counted and sold. `piece` implies a pack size of 1.
 *
 * Labels are what the price cell prints under the amount ("each", "per sheet"),
 * so they read as a continuation of the number rather than as a field name.
 */
export const SELL_UNIT_OPTIONS = [
  { value: 'piece',  label: 'each' },
  { value: 'pack',   label: 'per pack' },
  { value: 'bundle', label: 'per bundle' },
  { value: 'sheet',  label: 'per sheet' },
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
  { value: LINE_KIND.CATALOG, label: 'From the catalogue' },
  { value: LINE_KIND.NEGOTIATED, label: 'Agreed price' },
  { value: LINE_KIND.CUT, label: 'Cut to size' },
  { value: LINE_KIND.CUSTOM, label: 'Custom shape' },
];

/**
 * How a person wants their dashboard. A per-account preference, not a global
 * setting: it changes only what that person sees. Stored on staff.dashboard_view.
 */
export const DASHBOARD_VIEW = {
  STANDARD: 'standard',
  LARGE: 'large',
};

/**
 * Whether an order still owes the customer goods.
 *
 * A CACHE, NOT THE TRUTH. The app never reads this — utils/orders.hasBackorder
 * derives the answer from the line counters, for the same reason the stage
 * tracker is derived: a stored word and the lines it summarises are two places
 * that can disagree about the same fact. The column exists so SQL reporting can
 * ask the question without unpacking jsonb, exactly as inventory.reserved
 * caches a number the orders array is the real source of.
 */
export const BACKORDER_STATUS = {
  NONE: 'none',
  PARTIAL: 'partial',
  RESOLVED: 'resolved',
};

/**
 * What happens to goods a customer sends back.
 *
 * THE ONLY TWO ANSWERS, and the difference is the whole point. Styrofoam that
 * was carved to a shape or cut to a size cannot be sold to anybody else, and a
 * broken sheet is worth nothing — so putting either back on the shelf would be
 * the shelf lying about what can be sold, which is the bug this system exists
 * to avoid. Staff have to say which it was; there is no default.
 */
export const REFUND_DISPOSITION = {
  RESTOCK: 'restock',
  SCRAP: 'scrap',
};

/** How the money actually goes back. Stored as-is; see utils/copy for wording. */
export const REFUND_METHOD = {
  CASH: 'cash',
  GCASH: 'gcash',
  BANK: 'bank',
  CREDIT: 'credit',
};

/**
 * Why money went back. A fixed list rather than free text: "damaged on the way"
 * asked of the delivery driver and "made wrong" asked of the production floor
 * are different conversations, and neither happens if the reason is a sentence
 * nobody can count.
 */
export const REFUND_REASON = {
  DAMAGED: 'damaged',
  WRONG: 'wrong',
  LATE: 'late',
  CHANGED_MIND: 'changed-mind',
  PRICE: 'price',
};

/** Why a price was corrected after the customer had already been told one. */
export const PRICE_REASON = {
  TYPO: 'typo',
  DISCOUNT: 'discount',
  RUSH: 'rush',
  MEASURE: 'measure',
};
