import { useEffect, useMemo, useState } from "react";

import {
  CalendarClock,
  CircleCheck,
  Hammer,
  Inbox,
  PackageCheck,
  Truck,
} from "../icons";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import IconChip, { Mono } from "../shared/Chip";
import { FilterBar } from "../shared/ListScreen";
import {
  ActiveFilterSummary,
  FilterChips,
  FilterSelect,
  SearchField,
} from "../shared/filters";
import { EmptySlot, ErrorState, LoadingState } from "../shared/PageStates";
import { InlineBadge } from "../shared/StatusPill";
import { tone as toneOf } from "../shared/tones";
import { isBackorderDelivery } from "../../utils/orders";
import { matches } from "../../utils/search";
import { DELIVERY_STAGE } from "../../utils/constants";
import {
  areaOf,
  areasOf,
  board,
  customerFrom,
  deliveryChips,
  dueLabel,
  hasNoDriver,
  isDueThisWeek,
  isDueToday,
  isLate,
  matchesChip,
} from "../../utils/deliveries";

/**
 * Deliveries — screen 2k.
 *
 * A BOARD, NOT A TABLE, and the reason is the work rather than the fashion: a
 * delivery is always in exactly one of five places, and the job is moving it to
 * the next one. A table sorted by status shows the same information and hides
 * the thing that matters — how much is piled up at each step.
 *
 * ALL FIVE COLUMNS, ALWAYS. An empty column says "nothing is waiting to be
 * made", which is worth knowing; hiding it changes the board's shape day to
 * day, and the shape is how somebody finds "Ready to go" without reading the
 * headings. Empty columns say so in words rather than sitting blank, because a
 * blank column reads as a page that failed to load.
 *
 * THE SUMMARY BAR EARNS ITS PLACE HERE more than anywhere else in the app.
 * Three dropdowns and a chip can silently combine into an empty board, and an
 * empty board looks exactly like a quiet day. The bar states the combination in
 * a sentence and offers one control that undoes all of it.
 */

const STAGE_ICONS = {
  inbox: <Inbox />,
  hammer: <Hammer />,
  "package-check": <PackageCheck />,
  truck: <Truck />,
  "circle-check": <CircleCheck />,
};

const DUE_OPTIONS = [
  { value: "any", label: "Any day" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "late", label: "Overdue" },
];

export default function DeliveryBoardPage({
  isLoaded = true,
  loadError = null,
  onRetry,
  deliveries = [],
  staff = [],
  onOpen,
  onGoToDashboard,
  onContext,
  initialFilter,
}) {
  const [query, setQuery] = useState("");
  // Seeded from the dashboard. An attention row's button names a verb and
  // lands here with the matching chip already on, so the sentence somebody
  // read and the list they arrive at agree. It stays an ordinary chip
  // afterwards -- clearable, and not a mode.
  const [chip, setChip] = useState(initialFilter ?? "all");
  const [due, setDue] = useState("any");
  const [driver, setDriver] = useState("any");
  const [area, setArea] = useState("any");

  const chips = useMemo(() => deliveryChips(deliveries), [deliveries]);
  const areas = useMemo(() => areasOf(deliveries), [deliveries]);

  // Drivers come from the deliveries themselves as well as the staff list: a
  // delivery can be taken by somebody without a system account, and a filter
  // that cannot select the name written on the delivery is not a filter.
  const drivers = useMemo(() => {
    const seen = new Map();
    for (const person of staff) {
      if (person.name) seen.set(person.name.toLowerCase(), person.name);
    }
    for (const delivery of deliveries) {
      const name = String(delivery.driver || "").trim();
      if (name) seen.set(name.toLowerCase(), name);
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  }, [staff, deliveries]);

  const lateCount = chips.find((c) => c.value === "late")?.count ?? 0;

  useEffect(() => {
    if (!isLoaded) return;
    onContext?.(
      lateCount > 0
        ? `${deliveries.length} deliveries · ${lateCount} late`
        : `${deliveries.length} deliveries · none late`
    );
  }, [deliveries.length, lateCount, isLoaded, onContext]);

  const filtered = useMemo(
    () =>
      deliveries.filter((delivery) => {
        if (!matchesChip(delivery, chip)) return false;

        // The predicates, never the display string: dueLabel() answers
        // "Arrived" for a finished delivery whatever day it was promised, and
        // filtering on that text would quietly drop rows for the wrong reason.
        if (due === "today" && !isDueToday(delivery)) return false;
        if (due === "late" && !isLate(delivery)) return false;
        if (due === "week" && !isDueThisWeek(delivery)) return false;

        if (driver === "none" && !hasNoDriver(delivery)) return false;
        if (driver !== "any" && driver !== "none" && delivery.driver !== driver) return false;

        if (area !== "any" && areaOf(delivery) !== area) return false;

        return matches(query, delivery.product, delivery.location, `#${delivery.id}`, delivery.driver);
      }),
    [deliveries, chip, due, driver, area, query]
  );

  const columns = useMemo(() => board(filtered), [filtered]);

  // Only the filters that are actually narrowing anything are named in the
  // summary. Listing "any driver" and "all areas" every time would make the
  // sentence noise, and noise is what people stop reading.
  const summaryParts = [
    chip !== "all" ? chips.find((c) => c.value === chip)?.label.toLowerCase() : null,
    due !== "any" ? DUE_OPTIONS.find((o) => o.value === due)?.label.toLowerCase() : null,
    driver === "none" ? "with nobody assigned" : driver !== "any" ? driver : null,
    area !== "any" ? area : null,
    query.trim() ? `matching “${query.trim()}”` : null,
  ].filter(Boolean);

  const clearAll = () => {
    setChip("all");
    setDue("any");
    setDriver("any");
    setArea("any");
    setQuery("");
  };

  if (loadError) {
    return <ErrorState onRetry={onRetry} onGoToDashboard={onGoToDashboard} noun="deliveries" />;
  }

  return (
    <div className="flex flex-col gap-3.5">
      <FilterBar>
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search by delivery number or customer"
          id="delivery-search"
        />
        <FilterSelect label="Due" value={due} onChange={setDue} options={DUE_OPTIONS} />
        <FilterSelect
          label="Driver"
          value={driver}
          onChange={setDriver}
          options={[
            { value: "any", label: "Anyone" },
            { value: "none", label: "Nobody yet" },
            ...drivers.map((name) => ({ value: name, label: name })),
          ]}
        />
        <FilterSelect
          label="Area"
          value={area}
          onChange={setArea}
          options={[
            { value: "any", label: "Everywhere" },
            ...areas.map((name) => ({ value: name, label: name })),
          ]}
        />
      </FilterBar>

      <FilterChips chips={chips} value={chip} onChange={setChip} label="Show which deliveries" />

      <ActiveFilterSummary parts={summaryParts} onClear={clearAll} />

      {!isLoaded ? (
        <LoadingState noun="deliveries" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 desk:grid-cols-5">
          {columns.map((column) => (
            <Card
              key={column.value}
              className="flex flex-col border-t-4"
              // The 4px tone stripe is the column's identity, and a colour per
              // stage cannot be a class -- Tailwind would need one per tone and
              // the tone comes from data.
              style={{ borderTopColor: toneOf(column.tone).hex }}
            >
              <div className="flex items-center gap-2.5 px-4 pb-2 pt-3.5">
                <IconChip
                  icon={STAGE_ICONS[column.icon]}
                  tone={column.tone}
                  size="sm"
                  className="size-8 text-[16px]"
                />
                <h3 className="min-w-0 flex-1 truncate text-[15px] font-extrabold text-ink">
                  {column.label}
                </h3>
                <span className="text-[24px] font-extrabold leading-none tabular-nums text-ink">
                  {column.items.length}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-2 bg-paper-2 p-3">
                {column.items.length === 0 ? (
                  <EmptySlot className="py-6">
                    {summaryParts.length > 0 ? "Nothing here right now" : "Nothing waiting"}
                  </EmptySlot>
                ) : (
                  column.items.map((delivery) => (
                    <button
                      key={delivery.id}
                      type="button"
                      onClick={() => onOpen(delivery.id)}
                      className={cn(
                        "rounded-tile border border-card bg-surface p-3 text-left transition duration-150",
                        "hover:border-cobalt/40 hover:shadow-card",
                      )}
                    >
                      <Mono className="text-[13px]">#{delivery.id}</Mono>
                      <p className="truncate pt-0.5 text-[16px] font-bold text-ink">
                        {customerFrom(delivery) || "No customer named"}
                      </p>
                      {/* Said in words on the card, not only by the chip above
                          it. Somebody scanning the board for what is owed
                          should not have to apply a filter to find out which
                          of these is a second trip. */}
                      {isBackorderDelivery(delivery) && (
                        <p className="pt-1">
                          <InlineBadge label="The rest of an order" tone="amber" />
                        </p>
                      )}
                      <p className="truncate pt-0.5 text-[14.5px] text-muted">
                        {delivery.location || "No address"}
                      </p>
                      <p
                        className={cn(
                          "flex items-center gap-1.5 pt-2 text-[14px]",
                          isLate(delivery)
                            ? "font-bold text-red-text"
                            : "text-muted"
                        )}
                      >
                        <CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {dueLabel(delivery)}
                        {hasNoDriver(delivery) && column.value !== DELIVERY_STAGE.ARRIVED && (
                          <span className="truncate"> · nobody assigned</span>
                        )}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
