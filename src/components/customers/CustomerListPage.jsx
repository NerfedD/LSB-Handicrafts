import { useEffect, useMemo, useState } from "react";

import { ArrowRight, Building2, MapPin, Phone, UserPlus, UserRound } from "../icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar } from "../shared/Chip";
import { FilterBar, StickyCta } from "../shared/ListScreen";
import { ActiveFilterSummary, FilterChips, FilterSelect, Pager, SearchField } from "../shared/filters";
import { EmptyState, ErrorState, LoadingState } from "../shared/PageStates";
import usePaged from "../../hooks/usePaged";
import { hasActiveFilters, matches } from "../../utils/search";
import {
  cityOf,
  citiesOf,
  customerChips,
  customerSummary,
  matchesCustomerChip,
  ordersByCustomer,
} from "../../utils/customers";

/**
 * Customers — screen 2m.
 *
 * CARDS, NOT A TABLE, and this is the one list in the system that breaks the
 * shared table vocabulary on purpose. A customer is a face, a phone number and
 * a place; the screen is used standing at a counter with the person in front of
 * you, and what is needed then is one recognisable block per person, not a row
 * to trace across five columns.
 *
 * THE CHIPS ARE QUESTIONS, NOT CATEGORIES. "Not ordered in a year" is a call
 * list. "Has an open order" is who is waiting on us. A filter row that only
 * offered "Businesses / Walk-ins" would be a way of narrowing a list; this one
 * is a way of deciding what to do this afternoon.
 */

const SORTS = [
  { value: "name", label: "Name A–Z" },
  { value: "recent", label: "Ordered most recently" },
  { value: "orders", label: "Most orders" },
  { value: "newest", label: "Newest on the books" },
];

export default function CustomerListPage({
  isLoaded = true,
  loadError = null,
  onRetry,
  customers = [],
  orders = [],
  onView,
  onAdd,
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
  const [area, setArea] = useState("any");
  const [sort, setSort] = useState("name");

  const rows = useMemo(() => {
    const index = ordersByCustomer(orders);
    return customers.map((customer) => ({
      customer,
      summary: customerSummary(customer, index),
    }));
  }, [customers, orders]);

  const chips = useMemo(() => customerChips(rows), [rows]);
  const cities = useMemo(() => citiesOf(customers), [customers]);

  const lapsed = chips.find((c) => c.value === "lapsed")?.count ?? 0;

  useEffect(() => {
    if (!isLoaded) return;
    onContext?.(
      lapsed > 0
        ? `${customers.length} customers · ${lapsed} worth ringing`
        : `${customers.length} customers`
    );
  }, [customers.length, lapsed, isLoaded, onContext]);

  const filtered = useMemo(() => {
    const list = rows.filter(({ customer, summary }) => {
      if (!matchesCustomerChip(summary, chip)) return false;
      if (area !== "any" && cityOf(customer) !== area) return false;
      return matches(query, customer.name, customer.contactNumber, customer.address, customer.email);
    });

    switch (sort) {
      case "recent":
        return [...list].sort(
          (a, b) => (b.summary.lastOrderAt ?? 0) - (a.summary.lastOrderAt ?? 0)
        );
      case "orders":
        return [...list].sort((a, b) => b.summary.orderCount - a.summary.orderCount);
      case "newest":
        return [...list].sort(
          (a, b) =>
            new Date(b.customer.createdAt || 0).getTime() -
            new Date(a.customer.createdAt || 0).getTime()
        );
      default:
        return [...list].sort((a, b) =>
          String(a.customer.name).localeCompare(String(b.customer.name))
        );
    }
  }, [rows, chip, area, query, sort]);

  const paged = usePaged(filtered, 12);

  // The X in the search box and the "Clear the search box" button below both
  // unmount the moment they are pressed -- the second one takes its whole
  // empty-state panel with it -- which would otherwise drop focus to <body>.
  // Sending it back to the search box keeps a keyboard or screen-reader user
  // exactly where they were, ready to type the next search.
  function clearSearch() {
    setQuery("");
    document.getElementById("customer-search")?.focus();
  }

  // A chip (e.g. "Regulars") or the area dropdown can narrow a real, populated
  // list down to zero rows same as a search can -- the chip's own count says
  // "0" before it's even clicked. "Show everyone"/"Clear filters" undoes all
  // three filter axes at once, matching ActiveFilterSummary's own convention
  // (suppliers, the deliveries board) rather than leaving one behind.
  function clearFilters() {
    setChip("all");
    setArea("any");
    setQuery("");
  }

  // Three independent filter axes (a chip, an area, a search) can combine
  // silently -- only the ones actually narrowing anything are named, same
  // rule as the deliveries board's summary sentence.
  const summaryParts = [
    chip !== "all" ? chips.find((c) => c.value === chip)?.label.toLowerCase() : null,
    area !== "any" ? area : null,
    query.trim() ? `matching “${query.trim()}”` : null,
  ].filter(Boolean);

  // A visible list swaps its whole subtree between loading, empty and
  // populated -- states a screen reader has no other way to notice, since
  // nothing about the swap itself is announced. This is the one stable
  // element that stays mounted throughout, so changing its text is what
  // actually reaches assistive tech.
  const statusMessage = !isLoaded
    ? ""
    : filtered.length === 0
      ? query.trim()
        ? `No customers match “${query.trim()}”.`
        : "No customers found."
      : `${filtered.length} ${filtered.length === 1 ? "customer" : "customers"} shown.`;

  if (loadError) {
    return <ErrorState onRetry={onRetry} onGoToDashboard={onGoToDashboard} noun="customers" />;
  }

  return (
    <div className="flex flex-col gap-3.5">
      <p role="status" aria-live="polite" className="sr-only">
        {statusMessage}
      </p>

      <FilterBar>
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search by name, phone or business"
          id="customer-search"
        />
        <FilterSelect
          label="Area"
          value={area}
          onChange={setArea}
          options={[
            { value: "any", label: "Anywhere" },
            ...cities.map((city) => ({ value: city, label: city })),
          ]}
        />
        <FilterSelect label="Sort" value={sort} onChange={setSort} options={SORTS} />
      </FilterBar>

      <FilterChips chips={chips} value={chip} onChange={setChip} label="Show which customers" />

      <ActiveFilterSummary parts={summaryParts} onClear={clearFilters} />

      {!isLoaded ? (
        <LoadingState noun="customers" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<UserRound />}
          title="No customers yet"
          description="Add the people and businesses you sell to, and their orders will build up here."
          query={query.trim()}
          onClearSearch={clearSearch}
          filtered={hasActiveFilters(chip !== "all", area !== "any")}
          onClearFilters={clearFilters}
          actionLabel="Add a customer"
          onAction={onAdd}
        />
      ) : (
        <>
          <ul className="grid gap-3.5 sm:grid-cols-2 desk:grid-cols-3">
            {paged.visible.map(({ customer, summary }) => (
              <li key={customer.id}>
                <Card className="flex h-full flex-col p-4.5">
                  <div className="flex min-w-0 items-center gap-3.5">
                    <Avatar name={customer.name} size="lg" />
                    <div className="min-w-0">
                      <p className="truncate text-[17px] font-extrabold text-ink">
                        {customer.name}
                      </p>
                      <p className="flex items-center gap-1.5 pt-0.5 text-[14.5px] text-muted">
                        {summary.isBusiness ? (
                          <>
                            <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                            Business customer
                          </>
                        ) : (
                          <>
                            <UserRound className="h-4 w-4 shrink-0" aria-hidden="true" />
                            Walk-in
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pb-4 pt-4">
                    <p className="flex items-center gap-2.5 text-[15.5px] text-ink-2">
                      <Phone className="h-4.5 w-4.5 shrink-0 text-muted" aria-hidden="true" />
                      <span className="truncate">
                        {customer.contactNumber || (
                          <span className="text-muted">No phone number</span>
                        )}
                      </span>
                    </p>
                    <p className="flex items-center gap-2.5 text-[15.5px] text-ink-2">
                      <MapPin className="h-4.5 w-4.5 shrink-0 text-muted" aria-hidden="true" />
                      <span className="truncate">
                        {cityOf(customer) || <span className="text-muted">No address</span>}
                      </span>
                    </p>
                  </div>

                  {/* mt-auto pins the footer to the bottom of the tallest card
                      in the row, so a customer with no address does not leave a
                      card whose "Open" button sits higher than its neighbours'. */}
                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-hair pt-3.5">
                    <span className="text-[15px] text-muted">
                      {summary.orderCount === 0
                        ? "No orders yet"
                        : `${summary.orderCount} ${summary.orderCount === 1 ? "order" : "orders"}`}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => onView(customer.id)}>
                      Open
                      <ArrowRight className="h-4.5 w-4.5" />
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>

          <Card className="p-4">
            <Pager {...paged} noun="customers" />
          </Card>

          <StickyCta>
            <Button variant="cobalt" size="xl" block onClick={onAdd}>
              <UserPlus className="h-5.5 w-5.5" />
              Add a customer
            </Button>
          </StickyCta>
        </>
      )}
    </div>
  );
}
