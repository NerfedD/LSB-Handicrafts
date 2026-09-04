/**
 * Plain words, not jargon.
 *
 * Rule 2 of the six acceptance criteria in the UI overhaul handoff, and the
 * reason this file exists rather than the strings being retyped per screen:
 * the same concept was being labelled three different ways. Stock was "LOW" in
 * the workspace, "Low Stock" in the catalog and "low_stock_threshold" in a
 * form hint. An account was "Status: Active" on one screen and "Active" on
 * another — and what an administrator actually wants to know is whether the
 * person can sign in.
 *
 * STORED VALUES ARE UNCHANGED. Everything here maps a database literal (see
 * utils/constants.js) to display copy. The literals stay exactly as Supabase
 * holds them, so this is a presentation layer, not a migration — nothing here
 * is ever written back to a row.
 */

import { DELIVERY_STAGE, ORDER_STATUS, STOCK_STATUS } from "./constants";

// ---- stock -----------------------------------------------------------------

/**
 * "In Stock" -> "Plenty in stock". The three words staff use for the three
 * situations that change what they do next.
 */
export const STOCK_LABEL = {
  [STOCK_STATUS.IN]: "Plenty in stock",
  [STOCK_STATUS.LOW]: "Running low",
  [STOCK_STATUS.OUT]: "Run out",
};

/** The tone each stock state paints in — see shared/tones.js for the palette. */
export const STOCK_TONE = {
  [STOCK_STATUS.IN]: "green",
  [STOCK_STATUS.LOW]: "amber",
  [STOCK_STATUS.OUT]: "red",
};

export const stockLabel = (status) => STOCK_LABEL[status] ?? "Not tracked";
export const stockTone = (status) => STOCK_TONE[status] ?? "neutral";

// ---- accounts --------------------------------------------------------------

/**
 * Whether the person can sign in, which is the question the staff list is
 * actually answering. Three answers, not two: an account with no role assigned
 * has a working password and still cannot get in, and "Blocked" was the wrong
 * word for it — that is what "Not set up" covers.
 *
 * Keyed by the `status` column ('Active' | 'Blocked'), with the no-role case
 * resolved by signInLabel() below rather than by a fourth status value,
 * because the database's status check constraint allows exactly two.
 */
export const SIGN_IN = {
  yes: { label: "Yes", tone: "green", icon: "check" },
  blocked: { label: "Blocked", tone: "red", icon: "x" },
  notSetUp: { label: "Not set up", tone: "amber", icon: "clock" },
};

/** Which of the three a staff row is in. */
export function signInState(account) {
  if (!account) return SIGN_IN.notSetUp;
  if (account.status === "Blocked") return SIGN_IN.blocked;
  if (!account.role) return SIGN_IN.notSetUp;
  return SIGN_IN.yes;
}

/**
 * What a role unlocks, in a sentence.
 *
 * Shown on the change-role radio cards (2q) and on the person's own profile
 * (2s). Spelling it out is the point: "Manager" tells someone nothing about
 * what the account will be able to reach.
 */
export const ROLE_BLURB = {
  Admin:
    "Everything. Can add and remove staff accounts, change what people do, see the activity log, and edit every record.",
  Manager:
    "Everything except staff accounts. Can see and edit products, orders, deliveries, customers and suppliers.",
  "Sales Staff":
    "Writes orders and looks after customers. Can see products and prices, but cannot change them.",
  "Production Staff":
    "Works from the make list. Can record what was made and add new products, but does not see customers or suppliers.",
  "Delivery Staff":
    "Moves deliveries along. Can see what is going out and mark it as arrived.",
};

/** Administrators are called that in the UI; the stored role stays "Admin". */
export const roleLabel = (role) => (role === "Admin" ? "Administrator" : role || "No role yet");

// ---- orders ----------------------------------------------------------------

export const ORDER_LABEL = {
  [ORDER_STATUS.PENDING]: "Waiting",
  [ORDER_STATUS.COMPLETED]: "Done",
  [ORDER_STATUS.CANCELLED]: "Cancelled",
};

export const ORDER_TONE = {
  [ORDER_STATUS.PENDING]: "amber",
  [ORDER_STATUS.COMPLETED]: "green",
  [ORDER_STATUS.CANCELLED]: "red",
};

export const orderLabel = (status) => ORDER_LABEL[status] ?? status ?? "—";
export const orderTone = (status) => ORDER_TONE[status] ?? "neutral";

// ---- deliveries ------------------------------------------------------------

/**
 * The five places a delivery can be, in order. The board (2k) is one column
 * per entry and the detail screen (2l) moves a delivery one step along, so the
 * ORDER of this array is load-bearing — it is what "next" and "back" mean.
 */
export const DELIVERY_STAGES = [
  { value: DELIVERY_STAGE.NOT_SENT, label: "Not sent yet", tone: "neutral", icon: "inbox" },
  { value: DELIVERY_STAGE.BEING_MADE, label: "Being made", tone: "clay", icon: "hammer" },
  { value: DELIVERY_STAGE.READY, label: "Ready to go", tone: "cobalt", icon: "package-check" },
  { value: DELIVERY_STAGE.ON_THE_WAY, label: "On the way", tone: "amber", icon: "truck" },
  { value: DELIVERY_STAGE.ARRIVED, label: "Arrived", tone: "green", icon: "circle-check" },
];

export const deliveryStage = (value) =>
  DELIVERY_STAGES.find((s) => s.value === value) ?? DELIVERY_STAGES[0];

export const deliveryStageIndex = (value) =>
  Math.max(0, DELIVERY_STAGES.findIndex((s) => s.value === value));

/** Shown when a role reaches a screen that is not theirs (2u). */
export const NOT_ALLOWED_TITLE = "This screen is not part of your job";
