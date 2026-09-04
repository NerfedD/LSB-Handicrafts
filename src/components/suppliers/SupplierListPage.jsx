import { useEffect, useMemo, useState } from "react";

import { ArrowRight, Handshake, MapPin, Phone } from "../icons";
import { Button } from "@/components/ui/button";
import { Card, CardFooter } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import IconChip from "../shared/Chip";
import { FilterBar, RecordCard, StickyCta } from "../shared/ListScreen";
import { FilterSelect, Pager, SearchField } from "../shared/filters";
import { EmptyState, ErrorState, LoadingState } from "../shared/PageStates";
import usePaged from "../../hooks/usePaged";
import { matches } from "../../utils/search";
import { citiesOf, cityOf } from "../../utils/customers";

/**
 * Suppliers — the right half of screen 2n.
 *
 * THE SAME VOCABULARY AS EVERY OTHER LIST, deliberately: a search field, an
 * area filter, a sort, then rows with a leading chip, a name, a couple of
 * facts and an "Open" on the right. Learning the customers screen should teach
 * you this one, and that only holds if the pieces are in the same places doing
 * the same things.
 *
 * CLAY, NOT COBALT, for the add button and the row chips. Suppliers sit on the
 * making side of the business alongside production, and the third accent is
 * what keeps that side from reading as the same thing as sales.
 *
 * A TABLE ABOVE 834px AND CARDS BELOW, exactly like products, orders and
 * staff — and unlike customers, which is the one list that stays cards at
 * every width because you read it with the person standing in front of you.
 * A supplier list is scanned to find one name and its phone number, which is
 * what a table is for.
 *
 * This screen used to CLAIM that shared vocabulary while implementing its own:
 * a `<ul>` of `<button>` rows that a screen reader saw as neither table nor
 * list of records, a footer band hand-built out of `bg-paper-2` instead of
 * `CardFooter`, and an "Open" that was a `<span>` painted to look like a
 * button INSIDE the row button — so the row had a fake control in it and no
 * card layout below 834px at all. Same vocabulary now means the same
 * components.
 *
 * WHAT THE SECOND LINE SHOWS. The design calls for "what they supply", and
 * there is no column for it — `suppliers` holds a contact person, a number, an
 * email and an address. The contact person is shown instead, which is the other
 * thing a supplier row is opened for. Adding a "what they supply" field would
 * be worth doing; inventing one out of the address would not.
 */

const SORTS = [
  { value: "name", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
  { value: "newest", label: "Newest first" },
];

export default function SupplierListPage({
  isLoaded = true,
  loadError = null,
  onRetry,
  suppliers = [],
  onView,
  onAdd,
  onGoToDashboard,
  onContext,
}) {
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("any");
  const [sort, setSort] = useState("name");

  const cities = useMemo(() => citiesOf(suppliers), [suppliers]);

  useEffect(() => {
    if (!isLoaded) return;
    onContext?.(`${suppliers.length} ${suppliers.length === 1 ? "supplier" : "suppliers"}`);
  }, [suppliers.length, isLoaded, onContext]);

  const filtered = useMemo(() => {
    const list = suppliers.filter((supplier) => {
      if (area !== "any" && cityOf(supplier) !== area) return false;
      return matches(
        query,
        supplier.name,
        supplier.contactPerson,
        supplier.contactNumber,
        supplier.address
      );
    });

    switch (sort) {
      case "name-desc":
        return [...list].sort((a, b) => String(b.name).localeCompare(String(a.name)));
      case "newest":
        return [...list].sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
      default:
        return [...list].sort((a, b) => String(a.name).localeCompare(String(b.name)));
    }
  }, [suppliers, area, query, sort]);

  const paged = usePaged(filtered);

  if (loadError) {
    return <ErrorState onRetry={onRetry} onGoToDashboard={onGoToDashboard} noun="suppliers" />;
  }

  return (
    <div className="flex flex-col gap-3.5">
      <FilterBar>
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search by name, contact or phone"
          id="supplier-search"
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

      {!isLoaded ? (
        <LoadingState noun="suppliers" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Handshake />}
          title="No suppliers yet"
          description="Add the people you buy materials from, so anyone can find their number without asking."
          query={query.trim()}
          onClearSearch={() => setQuery("")}
          actionLabel="Add a supplier"
          onAction={onAdd}
        />
      ) : (
        <>
          {/* ≥834px: the table. */}
          <Card className="hidden tab:block">
            <Table minWidth={820}>
              <TableCaption>Suppliers, who to ask for and how to reach them</TableCaption>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Supplier</TableHead>
                  <TableHead className="w-56">Phone</TableHead>
                  <TableHead className="w-48">Area</TableHead>
                  <TableHead className="w-32 text-right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.visible.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-3.5">
                        <IconChip icon={<Handshake />} tone="clay" size="md" />
                        <div className="min-w-0">
                          <p className="truncate text-[16.5px] font-bold">{supplier.name}</p>
                          <p className="truncate pt-0.5 text-[14.5px] text-muted">
                            {supplier.contactPerson
                              ? `Ask for ${supplier.contactPerson}`
                              : "No contact person on file"}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="text-[15.5px] text-ink-2">
                      <span className="flex items-center gap-2">
                        <Phone className="h-4.5 w-4.5 shrink-0 text-muted" aria-hidden="true" />
                        {supplier.contactNumber || "—"}
                      </span>
                    </TableCell>

                    <TableCell className="text-[15.5px] text-ink-2">
                      <span className="flex items-center gap-2">
                        <MapPin className="h-4.5 w-4.5 shrink-0 text-muted" aria-hidden="true" />
                        {cityOf(supplier) || "—"}
                      </span>
                    </TableCell>

                    <TableCell>
                      <div className="flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => onView(supplier.id)}>
                          Open
                          <ArrowRight className="h-4.5 w-4.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <CardFooter>
              <Pager {...paged} noun="suppliers" className="w-full" />
            </CardFooter>
          </Card>

          {/* <834px: cards. */}
          <div className="flex flex-col gap-3 tab:hidden">
            {paged.visible.map((supplier) => (
              <RecordCard key={supplier.id}>
                <div className="flex min-w-0 items-center gap-3">
                  <IconChip icon={<Handshake />} tone="clay" size="md" />
                  <div className="min-w-0">
                    <p className="truncate text-[16.5px] font-bold">{supplier.name}</p>
                    <p className="truncate pt-0.5 text-[14.5px] text-muted">
                      {supplier.contactPerson
                        ? `Ask for ${supplier.contactPerson}`
                        : "No contact person on file"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-3.5">
                  <p className="flex items-center gap-2.5 text-[15.5px] text-ink-2">
                    <Phone className="h-4.5 w-4.5 shrink-0 text-muted" aria-hidden="true" />
                    <span className="truncate">
                      {supplier.contactNumber || (
                        <span className="text-muted-2">No phone number</span>
                      )}
                    </span>
                  </p>
                  <p className="flex items-center gap-2.5 text-[15.5px] text-ink-2">
                    <MapPin className="h-4.5 w-4.5 shrink-0 text-muted" aria-hidden="true" />
                    <span className="truncate">
                      {cityOf(supplier) || <span className="text-muted-2">No address</span>}
                    </span>
                  </p>
                </div>

                <div className="pt-4">
                  <Button variant="outline" block onClick={() => onView(supplier.id)}>
                    Open
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </div>
              </RecordCard>
            ))}

            <Card className="p-4">
              <Pager {...paged} noun="suppliers" />
            </Card>
          </div>

          <StickyCta>
            <Button variant="clay" size="xl" block onClick={onAdd}>
              <Handshake className="h-5.5 w-5.5" />
              Add a supplier
            </Button>
          </StickyCta>
        </>
      )}
    </div>
  );
}
