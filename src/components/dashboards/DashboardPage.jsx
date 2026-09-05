import { useEffect, useMemo } from "react";

import {
  Boxes,
  ClipboardList,
  Hammer,
  History,
  PackagePlus,
  Truck,
  UserPlus,
  UserRound,
  Users,
  Wallet,
} from "../icons";
import {
  ActivityFeed,
  AttentionCard,
  Greeting,
  QuickActions,
  StatCard,
  StatStrip,
} from "../shared/dashboard";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import IconChip, { Mono } from "../shared/Chip";
import { EmptySlot } from "../shared/PageStates";
import StatusPill from "../shared/StatusPill";
import { activityIcon } from "../shared/activityIcons";
import { dashIcon } from "../shared/dashboardIcons";
import { productIcon } from "../shared/productIcons";
import LargeTextDashboard from "./LargeTextDashboard";
import { whenLabel } from "../../utils/activityLog";
import { DASHBOARD_VIEW, ORDER_STATUS } from "../../utils/constants";
import { customerSummary, ordersByCustomer } from "../../utils/customers";
import {
  attentionFor,
  daySummary,
  followUpsFor,
  makeList,
  takenThisMonth,
} from "../../utils/dashboard";
import { isLate } from "../../utils/deliveries";
import { greeting, formatPeso } from "../../utils/profileFormat";
import { stockCounts } from "../../utils/productStock";

/**
 * The dashboards — screens 1b, 1c, 2c and 2d.
 *
 * FOUR SCREENS, ONE FILE, because they are the same furniture arranged around
 * different data: a greeting, an attention card, some numbers, a feed and a set
 * of actions. The previous three dashboards were three separate components and
 * had already drifted — different card radii, different stat treatments, and a
 * "Quick Actions" heading on one and "Things you do often" on none.
 *
 * WHAT DIFFERS IS WHOSE DAY IT IS:
 *
 *   Admin / Manager   everything, led by whatever is broken (1b)
 *   Sales Staff       follow-ups: orders waiting, customers to ring (2c)
 *   Production Staff  the make list, in one table, most urgent first (2d)
 *
 * Sales and production dashboards do not show a greyed-out version of the
 * administrator's data — it is simply ABSENT. Disabling a tile still puts it on
 * screen to be looked at and wondered about.
 *
 * THE LARGE-TEXT VIEW is a per-account preference, not a role, so it branches
 * here rather than being a fourth role dashboard.
 */
export default function DashboardPage({
  profile,
  dashboardView = DASHBOARD_VIEW.STANDARD,
  products = [],
  inventory = [],
  orders = [],
  deliveries = [],
  customers = [],
  suppliers = [],
  staff = [],
  activity = [],
  onNavigate,
  onOpenFiltered,
  onAddProduct,
  onAddCustomer,
  onWriteOrder,
  onRecordMade,
  onContext,
}) {
  const role = profile?.role;
  const isSales = role === "Sales Staff";
  const isProduction = role === "Production Staff";
  // The activity log is administrators-only, so "See all" is offered only to
  // somebody it will actually open for. A link that answers "this screen is
  // not part of your job" is worse than no link.
  const canSeeTheLog = role === "Admin";

  const customerRows = useMemo(() => {
    const index = ordersByCustomer(orders);
    return customers.map((customer) => ({
      customer,
      summary: customerSummary(customer, index),
    }));
  }, [customers, orders]);

  const attention = useMemo(() => {
    if (isProduction) return [];
    if (isSales) return followUpsFor({ orders, customerRows });
    return attentionFor({ role, products, inventory, orders, deliveries, staff });
  }, [isProduction, isSales, role, products, inventory, orders, deliveries, staff, customerRows]);

  const stock = useMemo(
    () => stockCounts(products, inventory, orders),
    [products, inventory, orders]
  );
  const list = useMemo(
    () => makeList({ products, inventory, orders }),
    [products, inventory, orders]
  );
  const owedCount = list.filter((row) => row.backorder).length;
  const waiting = orders.filter((order) => order.status === ORDER_STATUS.PENDING).length;
  const late = deliveries.filter(isLate).length;

  useEffect(() => {
    onContext?.(
      new Date().toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    );
  }, [onContext]);

  const openTarget = (target) => onOpenFiltered?.(target.view, target.filter);

  // ---- the large-text view -------------------------------------------------
  if (dashboardView === DASHBOARD_VIEW.LARGE) {
    return (
      <LargeTextDashboard
        profile={profile}
        stock={stock}
        waiting={waiting}
        late={late}
        peopleCount={staff.length}
        customerCount={customers.length}
        supplierCount={suppliers.length}
        role={role}
        onNavigate={onNavigate}
      />
    );
  }

  const feed = activity.slice(0, 5).map((entry) => ({
    id: entry.id,
    icon: activityIcon(entry.icon),
    tone: entry.tone,
    who: entry.who,
    what: entry.what,
    when: whenLabel(entry.at),
  }));

  const attentionItems = attention.map((item) => ({
    ...item,
    icon: dashIcon(item.icon),
    actionIcon: dashIcon(item.actionIcon, "h-5 w-5"),
    onAction: () => openTarget(item.target),
  }));

  // ---- production: the make list is the whole screen ------------------------
  if (isProduction) {
    return (
      <div className="flex flex-col gap-4.5">
        <Greeting
          greeting={greeting()}
          name={profile?.name?.split(" ")[0] || "there"}
          summary={
            list.length === 0
              ? "Nothing is running low. The shelves are where they should be."
              : owedCount > 0
                ? // Somebody standing waiting outranks a shelf that dipped under
                  // a warning level, and the line says which is which rather
                  // than leaving the red rows to explain themselves.
                  `${owedCount === 1 ? "One thing is" : `${owedCount} things are`} already owed to a customer. Those are at the top.`
                : `${list.length === 1 ? "One product needs" : `${list.length} products need`} making. The most urgent is at the top.`
          }
        />

        {/* The make list answers one question — what do we make next — so it
            is a table rather than three sentences: the whole point is
            comparing shortfalls down a column. */}
        <Card className="border-l-[5px] border-l-clay" variant="lift">
          <CardHeader className="bg-tint-clay">
            <IconChip icon={<Hammer />} tone="clay" size="sm" className="bg-white/70 dark:bg-white/[0.08]" />
            <CardTitle className="text-[19px]">Make list — most urgent first</CardTitle>
          </CardHeader>

          {list.length === 0 ? (
            <EmptySlot className="py-12 text-[16px]">
              Nothing to make. Every product is above the level it should be.
            </EmptySlot>
          ) : (
            <Table minWidth={640}>
              <TableCaption>What to make next, and how short we are</TableCaption>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Product</TableHead>
                  <TableHead className="w-36 text-right">On shelf</TableHead>
                  <TableHead className="w-36 text-right">Needed</TableHead>
                  <TableHead className="w-44">How urgent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map(({ product, onShelf, needed, urgency, tone, backorder }) => (
                  // Keyed on the source as well as the product: one product can
                  // now appear because a customer is owed it AND because the
                  // shelf is low, and those are two different rows.
                  <TableRow key={`${backorder ? "owed" : "low"}-${product.id}`}>
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-3.5">
                        <IconChip
                          icon={productIcon(product.productType)}
                          tone={backorder ? "red" : "neutral"}
                          size="md"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-[16.5px] font-bold">{product.name}</p>
                          {backorder ? (
                            <p className="truncate text-[14px] font-bold text-red-text">
                              Somebody is already waiting for this
                            </p>
                          ) : (
                            <Mono className="block truncate">{product.itemCode}</Mono>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-[18px] font-extrabold tabular-nums">
                      {onShelf}
                    </TableCell>
                    <TableCell className="text-right text-[18px] font-extrabold tabular-nums text-clay dark:text-dk-clay">
                      {needed}
                    </TableCell>
                    <TableCell>
                      <StatusPill label={urgency} tone={tone} size="sm" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <div className="grid gap-3.5 sm:grid-cols-3">
          <StatCard
            icon={<Boxes className="h-5 w-5" />}
            tone="clay"
            value={stock.all}
            label="Products we make"
            hint="Everything in the catalogue"
          />
          <StatCard
            icon={<PackagePlus className="h-5 w-5" />}
            tone="amber"
            value={stock.low}
            label="Running low"
            hint="Below the warn level"
          />
          <StatCard
            icon={<ClipboardList className="h-5 w-5" />}
            tone="red"
            value={stock.out}
            label="Run out"
            hint="Nothing left to sell"
          />
        </div>

        <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <ActivityFeed
            entries={feed}
            onSeeAll={canSeeTheLog ? () => onNavigate("activity") : undefined}
          />
          <QuickActions
            actions={[
              {
                label: "Record what we made",
                icon: <Hammer className="h-5 w-5" />,
                onClick: onRecordMade,
              },
              {
                label: "Add a new product",
                icon: <PackagePlus className="h-5 w-5" />,
                onClick: onAddProduct,
              },
              {
                label: "See all products",
                icon: <Boxes className="h-5 w-5" />,
                onClick: () => onNavigate("products"),
              },
            ]}
          />
        </div>
      </div>
    );
  }

  // ---- sales and admin share the shape, not the contents -------------------
  const stats = isSales
    ? [
        {
          label: "Waiting on us",
          value: waiting,
          hint: "Orders not finished",
          tone: "amber",
          icon: <ClipboardList className="h-4.5 w-4.5" />,
        },
        {
          label: "Customers",
          value: customers.length,
          hint: "People and businesses",
          tone: "cobalt",
          icon: <UserRound className="h-4.5 w-4.5" />,
        },
        {
          label: "Taken this month",
          value: formatPeso(takenThisMonth(orders)),
          hint: "Across all orders",
          tone: "green",
          icon: <Wallet className="h-4.5 w-4.5" />,
        },
        {
          label: "Going out",
          value: deliveries.filter((d) => d.status !== "Delivered").length,
          hint: late > 0 ? `${late} past the day promised` : "None late",
          tone: late > 0 ? "red" : "neutral",
          icon: <Truck className="h-4.5 w-4.5" />,
        },
      ]
    : [
        {
          label: "Products",
          value: stock.all,
          hint: `${stock.low + stock.out} need attention`,
          tone: stock.out > 0 ? "red" : stock.low > 0 ? "amber" : "green",
          icon: <Boxes className="h-4.5 w-4.5" />,
        },
        {
          label: "Orders waiting",
          value: waiting,
          hint: "Not finished yet",
          tone: "amber",
          icon: <ClipboardList className="h-4.5 w-4.5" />,
        },
        {
          label: "Going out",
          value: deliveries.filter((d) => d.status !== "Delivered").length,
          hint: late > 0 ? `${late} past the day promised` : "None late",
          tone: late > 0 ? "red" : "cobalt",
          icon: <Truck className="h-4.5 w-4.5" />,
        },
        // A Manager lands on this dashboard too, and cannot open the staff
        // screen — so the fourth cell reports something they can act on rather
        // than a headcount that leads nowhere for them.
        canSeeTheLog
          ? {
              label: "People with accounts",
              value: staff.length,
              hint: "Who can use the system",
              tone: "purple",
              icon: <Users className="h-4.5 w-4.5" />,
            }
          : {
              label: "Customers",
              value: customers.length,
              hint: "People and businesses",
              tone: "purple",
              icon: <UserRound className="h-4.5 w-4.5" />,
            },
      ];

  const actions = isSales
    ? [
        { label: "Write a new order", icon: <ClipboardList className="h-5 w-5" />, onClick: onWriteOrder },
        { label: "Add a customer", icon: <UserPlus className="h-5 w-5" />, onClick: onAddCustomer },
        { label: "Look up a price", icon: <Boxes className="h-5 w-5" />, onClick: () => onNavigate("products") },
      ]
    : [
        { label: "Write a new order", icon: <ClipboardList className="h-5 w-5" />, onClick: onWriteOrder },
        { label: "Add a product", icon: <PackagePlus className="h-5 w-5" />, onClick: onAddProduct },
        // Both of these open administrators-only screens. A Manager shares this
        // dashboard, so they are offered only to somebody they will open for.
        ...(canSeeTheLog
          ? [
              {
                label: "Add a staff account",
                icon: <UserPlus className="h-5 w-5" />,
                onClick: () => onOpenFiltered?.("staff", "add"),
              },
              {
                label: "Open the activity log",
                icon: <History className="h-5 w-5" />,
                onClick: () => onNavigate("activity"),
              },
            ]
          : [
              {
                label: "Add a customer",
                icon: <UserPlus className="h-5 w-5" />,
                onClick: onAddCustomer,
              },
            ]),
      ];

  return (
    <div className="flex flex-col gap-4.5">
      <Greeting
        greeting={greeting()}
        name={profile?.name?.split(" ")[0] || "there"}
        summary={daySummary(attention.length)}
      />

      <AttentionCard
        title={isSales ? "Your follow-ups" : "Needs your attention"}
        items={attentionItems}
        emptyMessage={
          isSales
            ? "Nothing to chase. Every order is moving and no customer is overdue a call."
            : "Nothing needs you right now. Stock is fine, orders are moving, and nobody is locked out."
        }
      />

      <StatStrip stats={stats} />

      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <ActivityFeed
            entries={feed}
            onSeeAll={canSeeTheLog ? () => onNavigate("activity") : undefined}
          />
        <QuickActions actions={actions} />
      </div>
    </div>
  );
}
