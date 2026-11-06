import { useEffect, useMemo, useState } from "react";

import useUrlState from "../../hooks/useUrlState";
import useTablePage from "../../hooks/useTablePage";
import { ArrowRight, CaretRight, DownloadSimple, Gift, Plus, Storefront, X } from "../icons";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar } from "../shared/Chip";
import { landedRow } from "../shared/landing";
import { EmptyState, Page, PageHeader, SearchField, StatCard, StatCards, TablePagination, TextLink } from "../shared/page";
import { ErrorState, LoadingState } from "../shared/PageStates";
import StatusPill from "../shared/StatusPill";
import { ToggleChips } from "../production/parts";
import { downloadCsv } from "@/lib/csv";
import { matches } from "../../utils/search";
import { cityOf, customerChips, customerSummary, DEFAULT_LOYALTY, matchesCustomerChip } from "../../utils/customers";
import { orderLabel, orderTone } from "../../utils/copy";
import { formatPeso, formatShortDate } from "../../utils/profileFormat";

/**
 * Customers, drawn to the "14 · Customers" board:
 *
 *   PageHeader (Export, Add customer) → four compact StatCards → FilterBar
 *   (search, the app's customer groups as toggles) → the customers table
 *   (Customer, Contact, Area, Orders, Last order, money) beside a details
 *   panel: contact facts, three figures, New order / Record payment / Edit
 *   details, and recent orders.
 *
 * The app does not track payments, so the board's "To collect" money is
 * shown as what each customer has spent, and Record payment is disabled.
 * "View customer" opens the app's full customer screen.
 */
const kindLabel = (customer) => (customer.kind === "business" ? "Business" : "Walk-in");

function RecentOrders({ customer, loadOrders, onOpenOrder }) {
  const [state, setState] = useState({ id: null, rows: [], loaded: false });
  useEffect(() => {
    let cancelled = false;
    loadOrders?.(customer).then((result) => {
      if (!cancelled) setState({ id: customer.id, rows: result?.ok ? result.data : [], loaded: true });
    });
    return () => {
      cancelled = true;
    };
  }, [customer, loadOrders]);
  if (!loadOrders) return null;
  const rows = state.id === customer.id ? state.rows.slice(0, 3) : [];
  if (state.id !== customer.id || !state.loaded) return <p className="m-0 text-13 text-muted-fg">Loading…</p>;
  if (!rows.length) return <p className="m-0 text-13 text-muted-fg">No orders yet.</p>;
  return (
    <ul className="m-0 list-none p-0">
      {rows.map((order) => (
        <li key={order.id} className="flex items-center gap-2 border-t border-row-divider py-1.5 text-13 first:border-t-0">
          <button type="button" data-slot="text-link" onClick={() => onOpenOrder?.(order.id)} className="border-0 bg-transparent p-0 font-medium text-primary-text hover:underline">#{order.id}</button>
          <span className="flex flex-1 items-center gap-2 text-muted-fg">
            {formatShortDate(order.createdAt)}
            <StatusPill label={orderLabel(order.status)} tone={orderTone(order.status)} />
          </span>
          <span>{formatPeso(order.totalAmount)}</span>
        </li>
      ))}
    </ul>
  );
}

function DetailPanel({ customer, summary, onClose, onWriteOrder, onRecordPayment, onEdit, onView, onOpenOrder, loadOrders }) {
  return (
    <aside aria-labelledby="cu-detail" className="flex w-full flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs lg:w-[340px] lg:shrink-0">
      <div className="flex items-start gap-3">
        <Avatar name={customer.name} size="md" photo={false} />
        <div className="min-w-0 flex-1">
          <h2 id="cu-detail" className="m-0 truncate text-sm font-semibold">{customer.name}</h2>
          <div className="text-13 text-muted-fg">{kindLabel(customer)} · customer since {formatShortDate(customer.createdAt) || "—"}</div>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Close details" onClick={onClose}>
          <X aria-hidden="true" />
        </Button>
      </div>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-13">
        <dt className="text-muted-fg">Phone</dt>
        <dd className="m-0">{customer.contactNumber ? <a href={`tel:${String(customer.contactNumber).replace(/[^\d+]/g, "")}`}>{customer.contactNumber}</a> : "—"}</dd>
        <dt className="text-muted-fg">Email</dt>
        <dd className="m-0 truncate">{customer.email ? <a href={`mailto:${customer.email}`}>{customer.email}</a> : "—"}</dd>
        <dt className="text-muted-fg">Deliver to</dt>
        <dd className="m-0">{customer.address || "—"}</dd>
      </dl>
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-md border border-border bg-border">
        {[
          ["Spent", formatPeso(summary.spent)],
          ["Orders", summary.orderCount],
          ["Open", summary.openCount],
        ].map(([label, value]) => (
          <div key={label} className="bg-card px-3 py-2">
            <div className="text-xs text-muted-fg">{label}</div>
            <div className="text-sm font-semibold">{value}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {onWriteOrder ? <Button variant="outline" size="sm" onClick={() => onWriteOrder(customer)}>New order</Button> : null}
        {onRecordPayment ? <Button variant="outline" size="sm" onClick={() => onRecordPayment(customer)}>Record payment</Button> : null}
        {onEdit ? <Button variant="outline" size="sm" onClick={() => onEdit(customer.id)}>Edit details</Button> : null}
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="m-0 text-13 font-semibold">Recent orders</h3>
          <TextLink className="text-xs" onClick={() => onView(customer.id)}>
            View customer
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </TextLink>
        </div>
        <RecentOrders customer={customer} loadOrders={loadOrders} onOpenOrder={onOpenOrder} />
      </div>
    </aside>
  );
}

export default function CustomerListPage({
  isLoaded = true,
  loadError = null,
  onRetry,
  customers = [],
  customerStats = new Map(),
  loyalty = DEFAULT_LOYALTY,
  onView,
  onAdd,
  onEdit,
  onWriteOrder,
  onRecordPayment,
  onOpenOrder,
  loadOrders,
  onEditLoyalty,
  onGoToDashboard,
  initialFilter,
  change = null,
}) {
  const [query, setQuery] = useUrlState("query", "", "customers");
  const [chip, setChip] = useUrlState("tab", initialFilter ?? "all", "customers");
  const [selectedId, setSelectedId] = useState(null);

  const rows = useMemo(
    () => customers.map((customer) => ({ customer, summary: customerSummary(customer, customerStats, loyalty) })),
    [customers, customerStats, loyalty]
  );
  const chips = useMemo(() => customerChips(rows, loyalty), [rows, loyalty]);
  const filtered = useMemo(
    () =>
      rows
        .filter(({ customer, summary }) => matchesCustomerChip(summary, chip) && matches(query, customer.name, customer.contactNumber, customer.email, customer.address))
        .sort((a, b) => String(a.customer.name).localeCompare(String(b.customer.name))),
    [rows, chip, query]
  );
  const paged = useTablePage(filtered);

  const [now] = useState(() => Date.now());
  const month = new Date(now).toLocaleDateString("en-US", { month: "long" });
  const startOfMonth = new Date(now);
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const orderedThisMonth = rows.filter(({ summary }) => summary.lastOrderAt !== null && summary.lastOrderAt >= startOfMonth.getTime()).length;
  const openOrders = rows.reduce((sum, { summary }) => sum + summary.openCount, 0);
  const newThisMonth = rows.filter(({ summary }) => summary.isNewThisMonth).length;
  const selected = rows.find(({ customer }) => customer.id === selectedId) ?? null;

  const exportCustomers = () =>
    downloadCsv(
      "lsb-customers.csv",
      [
        { label: "Customer", value: (r) => r.customer.name },
        { label: "Kind", value: (r) => kindLabel(r.customer) },
        { label: "Phone", value: (r) => r.customer.contactNumber },
        { label: "Email", value: (r) => r.customer.email },
        { label: "Address", value: (r) => r.customer.address },
        { label: "Orders", value: (r) => r.summary.orderCount },
        { label: "Spent", value: (r) => r.summary.spent },
      ],
      filtered
    );

  if (loadError) {
    return (
      <Page>
        <ErrorState onRetry={onRetry} onGoToDashboard={onGoToDashboard} noun="customers" />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        icon={Storefront}
        title="Customers"
        description="Shops, schools, churches and people who order from the workshop."
        actions={
          <>
            {onEditLoyalty ? (
              <Button variant="outline" onClick={onEditLoyalty}>
                <Gift aria-hidden="true" />
                Loyalty rules
              </Button>
            ) : null}
            <Button variant="outline" onClick={exportCustomers}>
              <DownloadSimple aria-hidden="true" />
              Export
            </Button>
            {onAdd ? (
              <Button onClick={onAdd} aria-haspopup="dialog">
                <Plus aria-hidden="true" />
                Add customer
              </Button>
            ) : null}
          </>
        }
      />

      <StatCards label="Customer totals" min={180}>
        <StatCard compact label="Customers" value={rows.length} caption={`${chips.find((c) => c.value === "business")?.count ?? 0} businesses`} />
        <StatCard compact label={`Ordered in ${month}`} value={orderedThisMonth} caption="customers" />
        <StatCard compact label="Open orders" value={openOrders} caption="not finished yet" onClick={() => setChip("open")} />
        <StatCard compact label={`New in ${month}`} value={newThisMonth} caption="added this month" onClick={() => setChip("new")} />
      </StatCards>

      <div className="flex flex-wrap items-center gap-2">
        <SearchField label="Search customers" value={query} onChange={setQuery} placeholder="Search name, contact or phone" />
        <ToggleChips label="Show" value={chip} onChange={setChip} chips={chips.map(({ value, label, count }) => ({ value, label, count }))} />
      </div>

      <div className="flex flex-col items-start gap-4 lg:flex-row">
        <section aria-label="Customers" className="w-full min-w-0 flex-1 rounded-lg border border-border bg-card shadow-xs">
          {!isLoaded ? (
            <LoadingState noun="customers" bare />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Storefront}
              title={rows.length === 0 ? "No customers yet" : "No customers match these filters"}
              description={rows.length === 0 ? "Add the people and businesses who order, so the next order can pick them from a list." : "Try another name, or show everyone."}
              action={rows.length ? <Button variant="outline" onClick={() => { setQuery(""); setChip("all"); }}>Clear filters</Button> : null}
            />
          ) : (
            <Table minWidth={760} aria-label="Customers">
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead className="w-[70px] text-right">Orders</TableHead>
                  <TableHead className="w-[100px]">Last order</TableHead>
                  <TableHead className="w-[120px] text-right">Spent</TableHead>
                  <TableHead className="w-10"><span className="sr-only">Open</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.visible.map(({ customer, summary }) => {
                  const landed = landedRow(change, "customer", customer.id);
                  return (
                    <TableRow key={landed.key} data-state={customer.id === selectedId ? "selected" : undefined} className={`h-10 ${landed.className ?? ""}`}>
                      <TableCell>
                        <span className="flex min-w-0 items-center gap-2">
                          <Avatar name={customer.name} className="rounded-md" photo={false} />
                          <span className="min-w-0">
                            <button type="button" data-slot="text-link" onClick={() => setSelectedId(customer.id)} className="block max-w-[220px] truncate border-0 bg-transparent p-0 text-left font-medium text-foreground hover:underline">
                              {customer.name}
                            </button>
                            <span className="block text-2xs leading-[14px] text-muted-fg">{kindLabel(customer)}</span>
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="text-fg-2">{customer.contactNumber || "—"}</TableCell>
                      <TableCell className="text-fg-2">{cityOf(customer) || "—"}</TableCell>
                      <TableCell className="text-right">{summary.orderCount}</TableCell>
                      <TableCell className="text-muted-fg">{summary.lastOrderAt ? formatShortDate(new Date(summary.lastOrderAt).toISOString()) : "Never"}</TableCell>
                      <TableCell className="text-right">{summary.spent ? formatPeso(summary.spent) : <span className="text-muted-fg">—</span>}</TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="icon-sm" aria-label={`Open ${customer.name}`} onClick={() => setSelectedId(customer.id)}>
                          <CaretRight aria-hidden="true" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          <TablePagination summary={`Showing ${paged.visible.length} of ${filtered.length}`} page={paged.page} pageCount={paged.pageCount} onPage={paged.onPage} />
        </section>
        {selected ? (
          <DetailPanel
            customer={selected.customer}
            summary={selected.summary}
            onClose={() => setSelectedId(null)}
            onWriteOrder={onWriteOrder}
            onRecordPayment={onRecordPayment}
            onEdit={onEdit}
            onView={onView}
            onOpenOrder={onOpenOrder}
            loadOrders={loadOrders}
          />
        ) : null}
      </div>
    </Page>
  );
}
