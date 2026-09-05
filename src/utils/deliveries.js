/**
 * Deliveries, as the board needs them.
 *
 * A delivery is always in exactly one of five places, and moving it along is
 * the entire job — which is why the screen is a board and not a table. The
 * derivations here are what the columns, the chips and the "late" count read.
 */

import { DELIVERY_STAGE } from "./constants";
import { BACKORDER_CHIP, DELIVERY_STAGES, deliveryStageIndex } from "./copy";
import { BACKORDER_SUFFIX, isBackorderDelivery } from "./orders";

/** Midnight today, as a number, for date-only comparisons. */
const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
};

/** A stored `date` string ("2026-09-04") as a local midnight timestamp. */
export function dueTime(delivery) {
  const raw = delivery?.dueOn;
  if (!raw) return null;
  const [year, month, day] = String(raw).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day).getTime();
}

export const hasArrived = (delivery) => delivery?.status === DELIVERY_STAGE.ARRIVED;

/**
 * Late means: promised for a day that has passed, and not there yet.
 *
 * An arrived delivery is never late however long it took — it is done, and
 * colouring finished work red teaches people to ignore the colour.
 */
export function isLate(delivery) {
  if (hasArrived(delivery)) return false;
  const due = dueTime(delivery);
  return due !== null && due < startOfToday();
}

export function isDueToday(delivery) {
  const due = dueTime(delivery);
  return due !== null && due === startOfToday();
}

/** Due between today and six days from now, inclusive. */
export function isDueThisWeek(delivery) {
  const due = dueTime(delivery);
  if (due === null) return false;
  const today = startOfToday();
  return due >= today && due < today + 7 * 86400000;
}

export const hasNoDriver = (delivery) => !String(delivery?.driver || "").trim();

/**
 * A second run, raised because the first one could not take everything.
 *
 * Worth its own chip for the reason the "No driver yet" chip earns one: it is a
 * filter and a list of debts at the same time. These are the runs where a
 * customer has already had half of what they paid for and is waiting on the
 * rest, and they should not have to be found by reading every card.
 */
export const isLeftBehindRun = (delivery) =>
  isBackorderDelivery(delivery) && !hasArrived(delivery);

/**
 * The board's chips. Counts come from the UNFILTERED set, like every list in
 * this system.
 *
 * "No driver yet" is a filter and a to-do list at the same time, which is the
 * same reasoning behind the customers screen's "Not ordered in a year": the
 * useful chips are the ones that name a problem.
 */
export function deliveryChips(deliveries = []) {
  return [
    { value: "all", label: "Everything", count: deliveries.length },
    { value: "late", label: "Late", count: deliveries.filter(isLate).length, tone: "red" },
    {
      value: "today",
      label: "Due today",
      count: deliveries.filter(isDueToday).length,
      tone: "amber",
    },
    { value: "week", label: "This week", count: deliveries.filter(isDueThisWeek).length },
    {
      value: "no-driver",
      label: "No driver yet",
      count: deliveries.filter((d) => hasNoDriver(d) && !hasArrived(d)).length,
    },
    {
      value: "left-behind",
      label: BACKORDER_CHIP,
      count: deliveries.filter(isLeftBehindRun).length,
      tone: "amber",
    },
    {
      value: "arrived",
      label: "Arrived",
      count: deliveries.filter(hasArrived).length,
      tone: "green",
    },
  ];
}

const CHIP_TESTS = {
  all: () => true,
  late: isLate,
  today: isDueToday,
  week: isDueThisWeek,
  "no-driver": (d) => hasNoDriver(d) && !hasArrived(d),
  "left-behind": isLeftBehindRun,
  arrived: hasArrived,
};

export const matchesChip = (delivery, chip) => (CHIP_TESTS[chip] ?? CHIP_TESTS.all)(delivery);

/**
 * The five columns, in order, each with the deliveries standing in it.
 *
 * Always all five, even when a column is empty — a board that hides its empty
 * columns has a different shape every day, and the shape is how somebody finds
 * "Ready to go" without reading.
 */
export function board(deliveries = []) {
  return DELIVERY_STAGES.map((stage) => ({
    ...stage,
    items: deliveries.filter((delivery) => delivery.status === stage.value),
  }));
}

/** Where a delivery goes next, and where it came from. Null at either end. */
export function nextStage(delivery) {
  const index = deliveryStageIndex(delivery?.status);
  return index < DELIVERY_STAGES.length - 1 ? DELIVERY_STAGES[index + 1] : null;
}

export function previousStage(delivery) {
  const index = deliveryStageIndex(delivery?.status);
  return index > 0 ? DELIVERY_STAGES[index - 1] : null;
}

/**
 * The areas to offer in the "Area" filter, taken from the delivery addresses
 * themselves.
 *
 * Derived rather than a fixed list, because a hardcoded list of Davao
 * districts would be wrong the first time somebody delivers somewhere new, and
 * an area filter that cannot select the place you are looking at is worse than
 * no filter.
 */
export function areasOf(deliveries = []) {
  const seen = new Map();
  for (const delivery of deliveries) {
    const area = areaOf(delivery);
    if (area && !seen.has(area.toLowerCase())) seen.set(area.toLowerCase(), area);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/**
 * The area part of an address — the last comma-separated piece, which is how
 * these are written ("12 Mabini St, Poblacion").
 */
export function areaOf(delivery) {
  const parts = String(delivery?.location || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : "";
}

/** "Due Friday" / "Due today" / "3 days late" — the meta line on a board card. */
export function dueLabel(delivery) {
  const due = dueTime(delivery);
  if (due === null) return "No date promised";

  const days = Math.round((due - startOfToday()) / 86400000);
  if (hasArrived(delivery)) return "Arrived";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days > 1 && days < 7) {
    return `Due ${new Date(due).toLocaleDateString("en-GB", { weekday: "long" })}`;
  }
  if (days < 0) {
    const late = Math.abs(days);
    return `${late} ${late === 1 ? "day" : "days"} late`;
  }
  return `Due ${new Date(due).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}

/**
 * The customer name written into the free-text `product` field, if there is one.
 *
 * The "(backorder)" suffix is trimmed off. It is there so the follow-up run can
 * be told apart from the original while keeping the same "Order #N - " prefix
 * every matcher relies on — but it is a marker, not part of anybody's name, and
 * printing "Ana Reyes (backorder)" under a card reads as though it were.
 * Whether a run is a follow-up is said by its own badge instead.
 */
export function customerFrom(delivery) {
  const raw = String(delivery?.product || "");
  const dash = raw.indexOf(" - ");
  const name = dash === -1 ? raw : raw.slice(dash + 3);
  return name.endsWith(BACKORDER_SUFFIX)
    ? name.slice(0, -BACKORDER_SUFFIX.length)
    : name;
}

/** "Order #12", when the delivery was raised from one. */
export function orderRefFrom(delivery) {
  const match = String(delivery?.product || "").match(/^Order #(\d+)\s-\s/);
  return match ? Number(match[1]) : null;
}
