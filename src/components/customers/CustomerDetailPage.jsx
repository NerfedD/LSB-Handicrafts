import { useMemo } from "react";

import {
  ArrowLeft,
  ArrowRight,
  AtSign,
  Building2,
  Calendar,
  ClipboardList,
  MapPin,
  Pencil,
  Phone,
  UserRound,
} from "../icons";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, Mono } from "../shared/Chip";
import FactTable, { StatTiles } from "../shared/FactTable";
import { EmptySlot, NotFoundState } from "../shared/PageStates";
import StatusPill from "../shared/StatusPill";
import { ORDER_STATUS } from "../../utils/constants";
import { orderLabel, orderTone } from "../../utils/copy";
import { customerSummary, ordersByCustomer } from "../../utils/customers";
import { formatLongDate, formatPeso, formatShortDate } from "../../utils/profileFormat";

/**
 * One customer — screen 2n.
 *
 * TWO NUMBERS AND TWO BUTTONS. What somebody standing at a counter needs from
 * a customer's screen is how much they matter (orders placed, spent with us)
 * and the ability to start the next order. Everything else — the address, the
 * email, when they were added — is reference, and sits below in a fact table
 * where it can be looked up rather than read.
 *
 * "WRITE THEM AN ORDER" IS THE PRIMARY. Not "Edit". Editing a customer's
 * details is housekeeping; the reason their screen is open is almost always
 * that they want to buy something.
 */
export default function CustomerDetailPage({
  customer,
  orders = [],
  onBack,
  onEdit,
  onWriteOrder,
  onOpenOrder,
}) {
  const { summary, theirOrders } = useMemo(() => {
    if (!customer) return { summary: null, theirOrders: [] };
    const index = ordersByCustomer(orders);
    const key = String(customer.name || "").trim().toLowerCase();
    return {
      summary: customerSummary(customer, index),
      theirOrders: [...(index.get(key) ?? [])].sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      ),
    };
  }, [customer, orders]);

  if (!customer) return <NotFoundState noun="customer" onBack={onBack} />;

  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" size="sm" className="self-start px-2" onClick={onBack}>
        <ArrowLeft className="h-5 w-5" />
        All customers
      </Button>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="p-5.5">
            <div className="flex flex-wrap items-center gap-4">
              <Avatar name={customer.name} size="xl" />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[23px] font-extrabold tracking-[-0.02em] text-ink">
                  {customer.name}
                </h2>
                <p className="flex items-center gap-1.5 pt-1 text-[15.5px] text-muted">
                  {summary.isBusiness ? (
                    <>
                      <Building2 className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
                      Business customer
                    </>
                  ) : (
                    <>
                      <UserRound className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
                      Walk-in customer
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  on record since {formatLongDate(customer.createdAt)}
                </p>
              </div>
            </div>

            <StatTiles
              className="pt-5"
              tiles={[
                {
                  label: "Orders placed",
                  value: summary.orderCount,
                  hint: summary.isRegular ? "A regular" : undefined,
                },
                {
                  label: "Spent with us",
                  value: formatPeso(summary.spent),
                  hint: summary.lastOrderAt
                    ? `Last order ${formatShortDate(new Date(summary.lastOrderAt).toISOString())}`
                    : "No orders yet",
                },
              ]}
            />

            <div className="flex flex-wrap gap-3 pt-5">
              <Button variant="cobalt" size="lg" onClick={() => onWriteOrder(customer)}>
                <ClipboardList className="h-5 w-5" />
                Write them an order
              </Button>
              <Button variant="outline" size="lg" onClick={() => onEdit(customer.id)}>
                <Pencil className="h-5 w-5" />
                Edit details
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What they have ordered</CardTitle>
            </CardHeader>

            {theirOrders.length === 0 ? (
              <EmptySlot className="py-10 text-[15px]">
                Nothing yet. Orders written for this customer will be listed here.
              </EmptySlot>
            ) : (
              <ul>
                {theirOrders.slice(0, 8).map((order) => (
                  <li key={order.id}>
                    <button
                      type="button"
                      onClick={() => onOpenOrder(order.id)}
                      className="flex w-full min-h-15.5 items-center gap-4 border-b border-hair px-5.5 py-3.5 text-left transition duration-150 last:border-b-0 hover:bg-wash-2"
                    >
                      <span className="min-w-0 flex-1">
                        <Mono className="text-[13.5px]">#{order.id}</Mono>
                        <span className="block text-[16px] font-bold text-ink">
                          {formatShortDate(order.createdAt)}
                        </span>
                      </span>
                      <StatusPill
                        label={orderLabel(order.status)}
                        tone={orderTone(order.status)}
                        size="sm"
                      />
                      <span className="w-28 shrink-0 text-right text-[16.5px] font-bold tabular-nums text-ink">
                        {formatPeso(order.totalAmount)}
                      </span>
                      <ArrowRight className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>How to reach them</CardTitle>
          </CardHeader>
          <FactTable
            rows={[
              {
                label: "Phone",
                value: customer.contactNumber || null,
                icon: <Phone className="h-4.5 w-4.5" />,
              },
              {
                label: "Email",
                value: customer.email || null,
                icon: <AtSign className="h-4.5 w-4.5" />,
              },
              {
                label: "Address",
                value: customer.address || null,
                icon: <MapPin className="h-4.5 w-4.5" />,
              },
              {
                label: "On record since",
                value: formatLongDate(customer.createdAt),
                icon: <Calendar className="h-4.5 w-4.5" />,
              },
              {
                label: "Open orders",
                value: summary.hasOpenOrder
                  ? `${theirOrders.filter((o) => o.status === ORDER_STATUS.PENDING).length} waiting`
                  : "None waiting",
                icon: <ClipboardList className="h-4.5 w-4.5" />,
              },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
