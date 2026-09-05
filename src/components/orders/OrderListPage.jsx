import { useEffect, useMemo, useState } from "react";

import { ArrowRight, ClipboardList } from "../icons";
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
import { Mono } from "../shared/Chip";
import { FilterBar, RecordCard, StickyCta } from "../shared/ListScreen";
import usePaged from "../../hooks/usePaged";
import { matches } from "../../utils/search";
import { FilterChips, FilterSelect, Pager, SearchField } from "../shared/filters";
import { EmptyState, ErrorState, LoadingState } from "../shared/PageStates";
import StatusPill from "../shared/StatusPill";
import { ORDER_STATUS } from "../../utils/constants";
import { BACKORDER_CHIP, orderLabel, orderTone } from "../../utils/copy";
import { hasBackorder, hasRefund, itemSummary, orderCounts } from "../../utils/orders";
import { formatPeso, formatShortDate } from "../../utils/profileFormat";

/**
 * Orders — screen 2i.
 *
 * STATUS IS A LABEL HERE, NOT A DROPDOWN. That is the one decision worth
 * defending on this screen. A status dropdown in a list means an order can be
 * marked done by somebody scrolling past it with a trackpad, and "done" moves
 * stock. Changing where an order stands is a deliberate act performed on the
 * order itself, via the explicit button on its own screen — so this column
 * reports, and the only control in the row is "Open".
 *
 * The chips carry counts from the unfiltered set, like every list in this
 * system, so "Waiting 12" is readable before anything is clicked.
 */

const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "biggest", label: "Biggest first" },
  { value: "customer", label: "Customer A–Z" },
];

const GROUP_STATUS = {
  waiting: ORDER_STATUS.PENDING,
  done: ORDER_STATUS.COMPLETED,
  cancelled: ORDER_STATUS.CANCELLED,
};

/**
 * The two chips that are not a status.
 *
 * "Some left behind" and "Refunded" cut across the status column rather than
 * selecting a value in it — a part-delivered order is still Waiting, and a
 * refunded one can be Waiting or Cancelled. They are still chips in the same
 * row, because the row is a single choice among ways of looking at the list,
 * and splitting them into a second control would ask somebody to combine two
 * filters to answer one question.
 */
const GROUP_TEST = {
  backorder: hasBackorder,
  refunded: hasRefund,
};

export default function OrderListPage({
  isLoaded = true,
  loadError = null,
  onRetry,
  orders = [],
  onOpen,
  onWriteOrder,
  onGoToDashboard,
  onContext,
  initialFilter,
}) {
  const [query, setQuery] = useState("");
  // Seeded from the dashboard. An attention row's button names a verb and
  // lands here with the matching chip already on, so the sentence somebody
  // read and the list they arrive at agree. It stays an ordinary chip
  // afterwards -- clearable, and not a mode.
  const [group, setGroup] = useState(initialFilter ?? "all");
  const [sort, setSort] = useState("newest");

  const counts = useMemo(() => orderCounts(orders), [orders]);

  useEffect(() => {
    if (!isLoaded) return;
    onContext?.(
      counts.waiting > 0
        ? `${counts.all} orders · ${counts.waiting} still waiting`
        : `${counts.all} orders · nothing waiting`
    );
  }, [counts.all, counts.waiting, isLoaded, onContext]);

  const filtered = useMemo(() => {
    const list = orders.filter((order) => {
      if (GROUP_TEST[group]) {
        if (!GROUP_TEST[group](order)) return false;
      } else if (group !== "all" && order.status !== GROUP_STATUS[group]) {
        return false;
      }
      return matches(query, order.customerName, `#${order.id}`, String(order.id));
    });

    const time = (order) => new Date(order.createdAt || 0).getTime() || 0;

    switch (sort) {
      case "oldest":
        return [...list].sort((a, b) => time(a) - time(b));
      case "biggest":
        return [...list].sort((a, b) => (b.totalAmount ?? 0) - (a.totalAmount ?? 0));
      case "customer":
        return [...list].sort((a, b) =>
          String(a.customerName).localeCompare(String(b.customerName))
        );
      default:
        return [...list].sort((a, b) => time(b) - time(a));
    }
  }, [orders, group, query, sort]);

  const paged = usePaged(filtered);

  const chips = [
    { value: "all", label: "All", count: counts.all },
    { value: "waiting", label: "Waiting", count: counts.waiting, tone: "amber" },
    { value: "backorder", label: BACKORDER_CHIP, count: counts.backorder, tone: "amber" },
    { value: "done", label: "Done", count: counts.done, tone: "green" },
    { value: "refunded", label: "Refunded", count: counts.refunded, tone: "purple" },
    { value: "cancelled", label: "Cancelled", count: counts.cancelled, tone: "red" },
  ];

  if (loadError) {
    return <ErrorState onRetry={onRetry} onGoToDashboard={onGoToDashboard} noun="orders" />;
  }

  return (
    <div className="flex flex-col gap-3.5">
      <FilterBar>
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search by customer or order number"
          id="order-search"
        />
        <FilterSelect label="Sort" value={sort} onChange={setSort} options={SORTS} />
      </FilterBar>

      <FilterChips chips={chips} value={group} onChange={setGroup} label="Show which orders" />

      {!isLoaded ? (
        <LoadingState noun="orders" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<ClipboardList />}
          title="No orders yet"
          description="Write your first order and it will appear here, along with what still needs making."
          query={query.trim()}
          onClearSearch={() => setQuery("")}
          actionLabel="Write a new order"
          onAction={onWriteOrder}
        />
      ) : (
        <>
          <Card className="hidden tab:block">
            <Table minWidth={960}>
              <TableCaption>Every order and where it stands</TableCaption>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-28">Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>What is on it</TableHead>
                  <TableHead className="w-40 text-right">Total</TableHead>
                  <TableHead className="w-40">Where it stands</TableHead>
                  <TableHead className="w-32 text-right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.visible.map((order) => {
                  const items = itemSummary(order);
                  return (
                    <TableRow key={order.id}>
                      <TableCell>
                        <Mono className="text-[15px] font-bold text-ink">
                          #{order.id}
                        </Mono>
                      </TableCell>

                      <TableCell>
                        <p className="truncate text-[16.5px] font-bold">{order.customerName}</p>
                        <p className="pt-0.5 text-[14px] text-muted">
                          {formatShortDate(order.createdAt)}
                        </p>
                      </TableCell>

                      <TableCell>
                        <p className="text-[15.5px] font-bold">{items.label}</p>
                        <p className="truncate pt-0.5 text-[14px] text-muted">
                          {items.names}
                        </p>
                      </TableCell>

                      <TableCell className="text-right text-[16.5px] font-bold tabular-nums">
                        {formatPeso(order.totalAmount)}
                      </TableCell>

                      <TableCell>
                        {/* Two pills rather than one replaced: a part-delivered
                            order is still Waiting, and hiding that behind the
                            newer fact would make the Waiting count and the list
                            disagree. */}
                        <div className="flex flex-col items-start gap-1.5">
                          <StatusPill
                            label={orderLabel(order.status)}
                            tone={orderTone(order.status)}
                            size="sm"
                          />
                          {hasBackorder(order) && (
                            <StatusPill label={BACKORDER_CHIP} tone="amber" size="sm" />
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex justify-end">
                          <Button variant="outline" size="sm" onClick={() => onOpen(order.id)}>
                            Open
                            <ArrowRight className="h-4.5 w-4.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <CardFooter>
              <Pager {...paged} noun="orders" className="w-full" />
            </CardFooter>
          </Card>

          <div className="flex flex-col gap-3 tab:hidden">
            {paged.visible.map((order) => {
              const items = itemSummary(order);
              return (
                <RecordCard key={order.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Mono className="text-[14px]">#{order.id}</Mono>
                      <p className="truncate text-[16.5px] font-bold">{order.customerName}</p>
                      <p className="pt-0.5 text-[14px] text-muted">
                        {formatShortDate(order.createdAt)} · {items.label}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <StatusPill
                        label={orderLabel(order.status)}
                        tone={orderTone(order.status)}
                        size="sm"
                      />
                      {hasBackorder(order) && (
                        <StatusPill label={BACKORDER_CHIP} tone="amber" size="sm" />
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-3.5">
                    <span className="text-[20px] font-extrabold tabular-nums">
                      {formatPeso(order.totalAmount)}
                    </span>
                    <Button variant="outline" onClick={() => onOpen(order.id)}>
                      Open
                      <ArrowRight className="h-5 w-5" />
                    </Button>
                  </div>
                </RecordCard>
              );
            })}

            <Card className="p-4">
              <Pager {...paged} noun="orders" />
            </Card>
          </div>

          <StickyCta>
            <Button variant="cobalt" size="xl" block onClick={onWriteOrder}>
              <ClipboardList className="h-5.5 w-5.5" />
              Write a new order
            </Button>
          </StickyCta>
        </>
      )}
    </div>
  );
}
