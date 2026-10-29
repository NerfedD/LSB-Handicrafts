import { useMemo, useState } from "react";

import { CalendarBlank, CaretDown, DownloadSimple, Hammer, Money, Package, Plus, Receipt, SquaresFour, Users } from "../icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AttentionList, CountUp, RecentActivity, StockWatch, WeeklyChart } from "../shared/dashboard";
import { EmptyState, Page, PageHeader, SectionCard, StatCard, StatCards } from "../shared/page";
import { Mono } from "../shared/Chip";
import StatusPill from "../shared/StatusPill";
import LargeTextDashboard from "./LargeTextDashboard";
import { downloadCsv } from "@/lib/csv";
import { DASHBOARD_VIEW, ORDER_STATUS } from "../../utils/constants";
import { customerSummary, DEFAULT_LOYALTY } from "../../utils/customers";
import { attentionFor, followUpsFor, makeList } from "../../utils/dashboard";
import { isLate } from "../../utils/deliveries";
import { greeting, formatPeso } from "../../utils/profileFormat";
import { stockCounts } from "../../utils/productStock";

/**
 * The dashboard, drawn to the "2 · Dashboard" board:
 *
 *   PageHeader (period, Export, New order) → four StatCards → the weekly
 *   chart beside Stock to watch → Recent activity.
 *
 * The app's own "Needs your attention" (a salesperson's follow-ups) sits
 * under the stat cards, built from the same card parts. Production staff,
 * who neither take orders nor see revenue, get the make list in the chart's
 * place: what to make next, with a Start batch on each line.
 */
const DAY = 86_400_000;
const PERIODS = [
  { value: "7", label: "Last 7 days", days: 7, compare: "the 7 days before" },
  { value: "30", label: "Last 30 days", days: 30, compare: "the 30 days before" },
];
// Orders are read for the last 120 days (see App), so the chart compares the
// last 8 weeks with the 8 before: 16 weeks of history.
const WEEKS = 8;

const live = (order) => order.status !== ORDER_STATUS.CANCELLED;
const createdAt = (order) => {
  const at = order.createdAt ? new Date(order.createdAt).getTime() : NaN;
  return Number.isNaN(at) ? null : at;
};

function change(current, previous) {
  if (!previous) return current ? "New" : "No change";
  const pct = ((current - previous) / previous) * 100;
  const rounded = Math.round(pct * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

const changeVariant = (current, previous) => (current > previous ? "success" : current < previous ? "warning" : "secondary");

function weeklySeries(orders, now) {
  const startOfWeek = (t) => {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return d.getTime();
  };
  const thisWeek = startOfWeek(now);
  const buckets = Array.from({ length: WEEKS }, (_, i) => {
    const start = thisWeek - (WEEKS - 1 - i) * 7 * DAY;
    return {
      start,
      label: new Date(start).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      orders: { current: 0, previous: 0 },
      revenue: { current: 0, previous: 0 },
    };
  });
  const first = buckets[0].start;
  for (const order of orders.filter(live)) {
    const at = createdAt(order);
    if (at === null) continue;
    const amount = Number(order.totalAmount) || 0;
    let index = Math.floor((at - first) / (7 * DAY));
    let key = "current";
    if (index < 0) {
      index += WEEKS;
      key = "previous";
    }
    if (index < 0 || index >= WEEKS) continue;
    buckets[index].orders[key] += 1;
    buckets[index].revenue[key] += amount;
  }
  return {
    orders: buckets.map((b) => ({ label: b.label, ...b.orders })),
    revenue: buckets.map((b) => ({ label: b.label, ...b.revenue })),
  };
}

export default function DashboardPage({
  profile,
  dashboardView = DASHBOARD_VIEW.STANDARD,
  products = [],
  inventory = [],
  orders = [],
  deliveries = [],
  customers = [],
  customerStats = new Map(),
  loyalty = DEFAULT_LOYALTY,
  suppliers = [],
  staff = [],
  activity = [],
  materials = [],
  batches = [],
  onNavigate,
  onOpenFiltered,
  onWriteOrder,
  onRecordMade,
}) {
  const role = profile?.role;
  const isSales = role === "Sales Staff";
  const isProduction = role === "Production Staff";
  const isAdmin = role === "Admin";
  const [periodKey, setPeriodKey] = useState("30");
  const [measure, setMeasure] = useState("orders");
  // One "now" per visit, so the figures do not shift under somebody reading them.
  const [now] = useState(() => Date.now());
  const period = PERIODS.find((p) => p.value === periodKey) ?? PERIODS[1];

  const customerRows = useMemo(
    () => customers.map((customer) => ({ customer, summary: customerSummary(customer, customerStats, loyalty) })),
    [customers, customerStats, loyalty]
  );
  const attention = useMemo(() => {
    if (isProduction) return [];
    if (isSales) return followUpsFor({ orders, customerRows });
    return attentionFor({ role, products, inventory, orders, deliveries, staff, materials, batches });
  }, [isProduction, isSales, role, products, inventory, orders, deliveries, staff, customerRows, materials, batches]);

  const stock = useMemo(() => stockCounts(products, inventory, orders), [products, inventory, orders]);
  const list = useMemo(() => makeList({ products, inventory, orders }), [products, inventory, orders]);
  const series = useMemo(() => weeklySeries(orders, now), [orders, now]);

  const totals = useMemo(() => {
    const span = period.days * DAY;
    const inRange = (from, to) => orders.filter(live).filter((o) => {
      const at = createdAt(o);
      return at !== null && at >= from && at < to;
    });
    const current = inRange(now - span, now + DAY);
    const previous = inRange(now - 2 * span, now - span);
    const money = (rows) => rows.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
    return { current, previous, revenue: money(current), revenueBefore: money(previous) };
  }, [orders, period.days, now]);

  if (dashboardView === DASHBOARD_VIEW.LARGE) {
    return (
      <LargeTextDashboard
        profile={profile}
        stock={stock}
        waiting={orders.filter((order) => order.status === ORDER_STATUS.PENDING).length}
        late={deliveries.filter(isLate).length}
        peopleCount={staff.length}
        customerCount={customers.length}
        supplierCount={suppliers.length}
        role={role}
        makeList={list}
        onNavigate={onNavigate}
        onRecordMade={onRecordMade}
      />
    );
  }

  const firstName = profile?.name?.split(" ")[0] || "there";
  const month = new Date().toLocaleDateString("en-US", { month: "long" });
  const watchRows = list.map((row) => ({
    key: `${row.backorder ? "owed" : "low"}-${row.product.id}`,
    product: row.product,
    name: row.product.name,
    code: row.product.itemCode,
    left: `${row.onShelf} left`,
    status: row.backorder ? "Owed to a customer" : row.urgency === "Run out" ? "Out of stock" : "Running low",
    tone: row.tone,
  }));
  const todays = activity.filter((entry) => entry.at && new Date(entry.at).toDateString() === new Date().toDateString());
  const recent = (todays.length ? todays : activity).slice(0, 6);
  const activeStaff = staff.filter((person) => person.status === "Active").length;
  const suspended = staff.filter((person) => person.status === "Blocked").length;

  const exportOrders = () =>
    downloadCsv(
      `lsb-orders-${period.value}-days.csv`,
      [
        { label: "Order", value: (o) => `#${o.id}` },
        { label: "Customer", value: (o) => o.customerName },
        { label: "Status", value: (o) => o.status },
        { label: "Total", value: (o) => o.totalAmount },
        { label: "Created", value: (o) => o.createdAt },
      ],
      totals.current
    );

  const header = (
    <PageHeader
      icon={SquaresFour}
      title="Dashboard"
      description={
        isProduction
          ? `${greeting()}, ${firstName}. ${list.length === 0 ? "Nothing is running low." : `${list.length} ${list.length === 1 ? "product needs" : "products need"} making; the most urgent is first.`}`
          : `${greeting()}, ${firstName}. Here is how the workshop is doing in ${month}.`
      }
      actions={
        isProduction ? (
          <Button onClick={() => onRecordMade?.()}>
            <Plus aria-hidden="true" />
            Start batch
          </Button>
        ) : (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" />}>
                <CalendarBlank aria-hidden="true" />
                {period.label}
                <CaretDown aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup value={periodKey} onValueChange={setPeriodKey}>
                  {PERIODS.map((p) => (
                    <DropdownMenuRadioItem key={p.value} value={p.value}>{p.label}</DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" onClick={exportOrders}>
              <DownloadSimple aria-hidden="true" />
              Export
            </Button>
            <Button onClick={onWriteOrder} aria-haspopup="dialog">
              <Plus aria-hidden="true" />
              New order
            </Button>
          </>
        )
      }
    />
  );

  if (isProduction) {
    return (
      <Page>
        {header}
        <StatCards label="Key numbers">
          <StatCard label="Products we make" icon={Package} value={<CountUp value={stock.all} />} caption="Everything in the catalogue" />
          <StatCard label="Running low" icon={Package} value={<CountUp value={stock.low} />} badge={<Badge variant="warning">Below the warn level</Badge>} />
          <StatCard label="Run out" icon={Package} value={<CountUp value={stock.out} />} badge={<Badge variant={stock.out ? "destructive" : "secondary"}>Nothing left to sell</Badge>} />
          <StatCard label="Unfinished batches" icon={Hammer} value={<CountUp value={batches.filter((b) => ["Queued", "In Progress", "Quality Check"].includes(b.status)).length} />} caption="Planned, on the floor or in checking" />
        </StatCards>
        <SectionCard title="Needed next, most urgent first" description="What to make, and how short we are">
          {list.length === 0 ? (
            <div className="border-t border-border">
              <EmptyState icon={Hammer} title="Nothing to make" description="Every product is above the level it should be." />
            </div>
          ) : (
            <div className="border-t border-border">
              <Table minWidth={640}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="w-28 text-right">On shelf</TableHead>
                    <TableHead className="w-28 text-right">Needed</TableHead>
                    <TableHead className="w-44">How urgent</TableHead>
                    <TableHead className="w-32"><span className="sr-only">Next step</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map(({ product, onShelf, needed, urgency, tone, backorder }) => (
                    <TableRow key={`${backorder ? "owed" : "low"}-${product.id}`}>
                      <TableCell>
                        <div className="font-medium">{product.name}</div>
                        {backorder ? (
                          <div className="text-xs text-danger-fg">Somebody is already waiting for this</div>
                        ) : (
                          <Mono>{product.itemCode}</Mono>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{onShelf}</TableCell>
                      <TableCell className="text-right font-medium">{needed}</TableCell>
                      <TableCell><StatusPill label={urgency} tone={tone} /></TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => onRecordMade(product.id, needed * (product.packSize || 1))}>
                          Start batch
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </SectionCard>
        <RecentActivity entries={recent} description="The latest changes, across every role" />
      </Page>
    );
  }

  return (
    <Page>
      {header}
      <StatCards label="Key numbers">
        <StatCard
          label="Orders"
          icon={Receipt}
          value={<CountUp value={totals.current.length} />}
          badge={<Badge variant={changeVariant(totals.current.length, totals.previous.length)}>{change(totals.current.length, totals.previous.length)}</Badge>}
          caption={`vs ${period.compare}`}
        />
        <StatCard
          label="Revenue"
          icon={Money}
          value={<CountUp value={totals.revenue} format={(n) => formatPeso(Math.round(n * 100) / 100)} />}
          badge={<Badge variant={changeVariant(totals.revenue, totals.revenueBefore)}>{change(totals.revenue, totals.revenueBefore)}</Badge>}
          caption={`vs ${period.compare}`}
        />
        {isSales ? (
          <StatCard
            label="Customers"
            icon={Users}
            value={<CountUp value={customers.length} />}
            badge={<Badge variant="secondary">{orders.filter((o) => o.status === ORDER_STATUS.PENDING).length} orders waiting</Badge>}
            caption="People and businesses"
          />
        ) : (
          <StatCard
            label="Staff who can sign in"
            icon={Users}
            value={<CountUp value={activeStaff} />}
            unit={`of ${staff.length}`}
            badge={<Badge variant="secondary">{suspended} suspended</Badge>}
            caption={`${staff.length - activeStaff - suspended} not set up yet`}
          />
        )}
        <StatCard
          label="Items running low"
          icon={Package}
          value={<CountUp value={stock.low + stock.out} />}
          badge={<Badge variant={stock.out ? "warning" : "secondary"}>{stock.out} out of stock</Badge>}
          caption={`${list.filter((row) => row.backorder).length} owed to customers`}
        />
      </StatCards>

      <AttentionList
        title={isSales ? "Your follow-ups" : "Needs your attention"}
        items={attention.map((item) => ({ ...item, onAction: () => onOpenFiltered?.(item.target.view, item.target.filter) }))}
      />

      <section className="flex flex-wrap gap-4">
        <WeeklyChart
          title={measure === "orders" ? "Orders per week" : "Revenue per week"}
          description={`Last ${WEEKS} weeks against the ${WEEKS} before`}
          series={series}
          measure={measure}
          onMeasure={setMeasure}
          formatValue={(n) => (measure === "orders" ? `${n} orders` : formatPeso(n))}
        />
        <StockWatch
          rows={watchRows.slice(0, 5)}
          total={watchRows.length}
          onOpen={(row) => onOpenFiltered?.("products", "low", row)}
          onOpenInventory={() => onOpenFiltered?.("products", "low")}
        />
      </section>

      <RecentActivity
        entries={recent}
        description={todays.length ? "Today, across every role" : "The latest changes, across every role"}
        onViewAll={isAdmin ? () => onNavigate("activity") : undefined}
      />
    </Page>
  );
}
