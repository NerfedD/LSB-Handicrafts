import { useMemo, useState } from "react";

import OrderPriorityBoard from "./OrderPriorityBoard";
import useUrlState from "../../hooks/useUrlState";
import useTablePage from "../../hooks/useTablePage";
import { CaretRight, DownloadSimple, List, Plus, Receipt, Rows } from "../icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { landedRow } from "../shared/landing";
import { EmptyState, FilterSelect, Page, PageHeader, SearchField, StatCard, StatCards, TablePagination, TextLink } from "../shared/page";
import { ErrorState, LoadingState } from "../shared/PageStates";
import StatusPill from "../shared/StatusPill";
import StageBadge from "../deliveries/StageBadge";
import { ToggleChips } from "../production/parts";
import { downloadCsv } from "@/lib/csv";
import { matches } from "../../utils/search";
import { ORDER_STATUS } from "../../utils/constants";
import { BACKORDER_CHIP, orderLabel, orderTone } from "../../utils/copy";
import { deliveryForOrder, hasBackorder, hasRefund, itemSummary, orderCounts } from "../../utils/orders";
import { dueTime, isDueThisWeek, isLate } from "../../utils/deliveries";
import { formatPeso, formatShortDate } from "../../utils/profileFormat";

/**
 * Orders, drawn to the "16 · Orders" board:
 *
 *   PageHeader (Export, New order) → four compact StatCards → FilterBar
 *   (search, the order groups as toggles) → the orders table (Order,
 *   Customer, Items, Total, status, Delivery, Due) → pagination.
 *
 * The app does not record payments, so the board's Payment column shows the
 * order's own status (Waiting, Done, Cancelled) and "Still to collect" counts
 * what waiting orders are worth. The app's priority arrangement is the second
 * view in the same FilterBar.
 */
const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "biggest", label: "Biggest first" },
  { value: "customer", label: "Customer A–Z" },
];

const GROUP_STATUS = { waiting: ORDER_STATUS.PENDING, done: ORDER_STATUS.COMPLETED, cancelled: ORDER_STATUS.CANCELLED };
const GROUP_TEST = { backorder: hasBackorder, refunded: hasRefund };

export default function OrderListPage({
  isLoaded = true,
  loadError = null,
  onRetry,
  orders = [],
  deliveries = [],
  onOpen,
  onWriteOrder,
  onGoToDashboard,
  initialFilter,
  onReorder,
  historyNote = null,
  onShowOlder,
  change = null,
}) {
  const [layout, setLayout] = useUrlState("layout", "list", "orders");
  const [query, setQuery] = useUrlState("query", "", "orders");
  const [group, setGroup] = useUrlState("tab", initialFilter ?? "all", "orders");
  const [sort, setSort] = useUrlState("sort", "newest", "orders");
  const [now] = useState(() => Date.now());

  const counts = useMemo(() => orderCounts(orders), [orders]);
  const filtered = useMemo(() => {
    const list = orders.filter((order) => {
      if (GROUP_TEST[group]) {
        if (!GROUP_TEST[group](order)) return false;
      } else if (group !== "all" && order.status !== GROUP_STATUS[group]) {
        return false;
      }
      return matches(query, order.customerName, `#${order.id}`, String(order.id), itemSummary(order).names);
    });
    const time = (order) => new Date(order.createdAt || 0).getTime() || 0;
    switch (sort) {
      case "oldest":
        return [...list].sort((a, b) => time(a) - time(b));
      case "biggest":
        return [...list].sort((a, b) => (b.totalAmount ?? 0) - (a.totalAmount ?? 0));
      case "customer":
        return [...list].sort((a, b) => String(a.customerName).localeCompare(String(b.customerName)));
      default:
        return [...list].sort((a, b) => time(b) - time(a));
    }
  }, [orders, group, query, sort]);
  const paged = useTablePage(filtered);

  const open = orders.filter((o) => o.status === ORDER_STATUS.PENDING);
  const waitingValue = open.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
  const dueThisWeek = open.filter((o) => {
    const delivery = deliveryForOrder(o, deliveries);
    return delivery && isDueThisWeek(delivery);
  }).length;
  const monthStart = new Date(now);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const soldThisMonth = orders
    .filter((o) => o.status !== ORDER_STATUS.CANCELLED && o.createdAt && new Date(o.createdAt).getTime() >= monthStart.getTime())
    .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
  const month = monthStart.toLocaleDateString("en-US", { month: "long" });

  const chips = [
    { value: "all", label: "All", count: counts.all },
    { value: "waiting", label: "Waiting", count: counts.waiting },
    { value: "backorder", label: BACKORDER_CHIP, count: counts.backorder },
    { value: "done", label: "Done", count: counts.done },
    { value: "refunded", label: "Refunded", count: counts.refunded },
    { value: "cancelled", label: "Cancelled", count: counts.cancelled },
  ];

  const exportOrders = () =>
    downloadCsv(
      "lsb-orders.csv",
      [
        { label: "Order", value: (o) => `#${o.id}` },
        { label: "Customer", value: (o) => o.customerName },
        { label: "Items", value: (o) => itemSummary(o).names },
        { label: "Total", value: (o) => o.totalAmount },
        { label: "Status", value: (o) => orderLabel(o.status) },
        { label: "Created", value: (o) => o.createdAt },
      ],
      filtered
    );

  if (loadError) {
    return (
      <Page>
        <ErrorState onRetry={onRetry} onGoToDashboard={onGoToDashboard} noun="orders" />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        icon={Receipt}
        title="Orders"
        description="Every order from quote to delivered, with what is still waiting."
        actions={
          <>
            <Button variant="outline" onClick={exportOrders}>
              <DownloadSimple aria-hidden="true" />
              Export
            </Button>
            {onWriteOrder ? (
              <Button onClick={onWriteOrder} aria-haspopup="dialog">
                <Plus aria-hidden="true" />
                New order
              </Button>
            ) : null}
          </>
        }
      />

      <StatCards label="Order totals" min={180}>
        <StatCard compact label="Open orders" value={open.length} caption={`${counts.backorder} with goods still owed`} onClick={() => setGroup("waiting")} />
        <StatCard compact label="Still waiting" value={formatPeso(waitingValue)} caption="on open orders" />
        <StatCard compact label="Due this week" value={dueThisWeek} caption="deliveries for open orders" />
        <StatCard compact label={`Sold in ${month}`} value={formatPeso(soldThisMonth)} caption="not counting cancelled" />
      </StatCards>

      <div className="flex flex-wrap items-center gap-2">
        <SearchField label="Search orders" value={query} onChange={setQuery} placeholder="Search number, customer or product" />
        <ToggleChips label="Show" value={group} onChange={setGroup} chips={chips} />
        <span className="flex-[1_1_0]" />
        {layout === "list" ? <FilterSelect label="Sort" value={sort} onChange={setSort} options={SORTS} /> : null}
        {onReorder ? (
          <ToggleGroup
            label="Order view"
            value={layout}
            onValueChange={setLayout}
            options={[
              { value: "list", label: "Order list", icon: <List aria-hidden="true" /> },
              { value: "priority", label: "Arrange priority", icon: <Rows aria-hidden="true" /> },
            ]}
          />
        ) : null}
      </div>

      {layout === "priority" && isLoaded ? (
        <OrderPriorityBoard orders={orders} onReorder={onReorder} onOpen={onOpen} />
      ) : (
        <section aria-label="Orders" className="rounded-lg border border-border bg-card shadow-xs">
          {!isLoaded ? (
            <LoadingState noun="orders" bare />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title={orders.length === 0 ? "No orders yet" : "No orders match"}
              description={orders.length === 0 ? "Orders show up here as soon as one is written." : "Try another number or customer, or show all orders."}
              action={orders.length ? <Button variant="outline" onClick={() => { setQuery(""); setGroup("all"); }}>Clear filters</Button> : null}
            />
          ) : (
            <Table minWidth={980} aria-label="Orders">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="w-[110px] text-right">Total</TableHead>
                  <TableHead className="w-[150px]">Status</TableHead>
                  <TableHead className="w-[130px]">Delivery</TableHead>
                  <TableHead className="w-[120px]">Due</TableHead>
                  <TableHead className="w-10"><span className="sr-only">Open</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.visible.map((order) => {
                  const landed = landedRow(change, "order", order.id);
                  const items = itemSummary(order);
                  const delivery = deliveryForOrder(order, deliveries);
                  const late = delivery && order.status === ORDER_STATUS.PENDING && isLate(delivery);
                  return (
                    <TableRow key={landed.key} className={`h-10 ${landed.className ?? ""}`}>
                      <TableCell>
                        <button type="button" data-slot="text-link" onClick={() => onOpen(order.id)} className="border-0 bg-transparent p-0 font-medium text-primary-text hover:underline">
                          #{order.id}
                        </button>
                      </TableCell>
                      <TableCell>
                        <span className="block max-w-[220px] truncate font-medium">{order.customerName || "Walk-in"}</span>
                        <span className="block text-2xs leading-[14px] text-muted-fg">{formatShortDate(order.createdAt)}</span>
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate text-fg-2" title={items.names}>{items.names || items.label}</TableCell>
                      <TableCell className="text-right">{formatPeso(order.totalAmount)}</TableCell>
                      <TableCell>
                        <span className="inline-flex flex-wrap items-center gap-1">
                          <StatusPill label={orderLabel(order.status)} tone={orderTone(order.status)} />
                          {hasBackorder(order) ? <Badge variant="warning">{BACKORDER_CHIP}</Badge> : null}
                        </span>
                      </TableCell>
                      <TableCell>{delivery ? <StageBadge status={delivery.status} /> : <span className="text-muted-fg">No delivery</span>}</TableCell>
                      <TableCell className={late ? "text-danger-fg" : "text-fg-2"}>
                        {delivery && dueTime(delivery) !== null ? `${formatShortDate(new Date(dueTime(delivery)).toISOString())}${late ? " · late" : ""}` : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="icon-sm" aria-label={`Open order ${order.id}`} onClick={() => onOpen(order.id)}>
                          <CaretRight aria-hidden="true" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          <TablePagination
            summary={
              <span className="inline-flex flex-wrap items-center gap-2">
                Showing {paged.visible.length} of {filtered.length} orders
                {historyNote && onShowOlder ? (
                  <>
                    <span>· {historyNote}</span>
                    <TextLink onClick={onShowOlder}>Show older orders</TextLink>
                  </>
                ) : null}
              </span>
            }
            page={paged.page}
            pageCount={paged.pageCount}
            onPage={paged.onPage}
          />
        </section>
      )}
    </Page>
  );
}
