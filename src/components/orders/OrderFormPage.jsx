import { useMemo, useState } from "react";

import { Plus, Save, Trash2, TriangleAlert } from "../icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Callout from "../shared/Callout";
import { EmptySlot } from "../shared/PageStates";
import { Field, FormBand, FormFooter, Row } from "../shared/forms";
import { LINE_KIND } from "../../utils/constants";
import { orderTotal } from "../../utils/orderItems";
import { formatPeso } from "../../utils/profileFormat";
import { shelfItems } from "../../utils/productStock";
import { stockLabel } from "../../utils/copy";

/**
 * Write a new order.
 *
 * NOT ONE OF THE 25 DESIGNED SCREENS. The handoff shows "Write a new order" as
 * a call to action on three dashboards and on the orders list, but it does not
 * design the screen behind it — so this is built from the handoff's own form
 * vocabulary (numbered bands, one question at a time, help text under the
 * fields, a footer band with the way out on the left) rather than invented in a
 * different style. Worth flagging in review: the screen exists because the
 * buttons pointing at it do, and it deserves a proper design pass of its own.
 *
 * WHAT IT WRITES. An order, and — when an address is given — the delivery that
 * carries it, linked by the "Order #12 - Customer" convention the deliveries
 * table has always used (see utils/orders). Writing both here is what stops
 * somebody having to remember to raise a delivery separately, which is how
 * orders end up finished with nothing ever going out.
 *
 * PRICES DEFAULT, THEY DO NOT LOCK. A line starts at the catalogue price and
 * can be changed, because the real business negotiates. What it cannot do is
 * pretend the change did not happen: the line is marked as an agreed price so
 * the order shows why the total is not the sum of the list prices.
 */

const emptyLine = () => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  productId: "",
  name: "",
  quantity: 1,
  unitPrice: 0,
  listPrice: 0,
});

export default function OrderFormPage({
  customers = [],
  products = [],
  inventory = [],
  /** Every order already written, so "free to sell" excludes what is promised. */
  existingOrders = [],
  /** Pre-selected when the order was started from a customer's own screen. */
  customer,
  saving = false,
  onSave,
  onCancel,
}) {
  const [customerName, setCustomerName] = useState(customer?.name ?? "");
  const [lines, setLines] = useState(() => [emptyLine()]);
  const [address, setAddress] = useState(customer?.address ?? "");
  const [dueOn, setDueOn] = useState("");
  const [driver, setDriver] = useState("");
  const [deliveryCharge, setDeliveryCharge] = useState("");
  const [error, setError] = useState(null);

  const shelf = useMemo(
    () => shelfItems(products, inventory, existingOrders),
    [products, inventory, existingOrders]
  );

  const filled = lines.filter((line) => line.productId && Number(line.quantity) > 0);
  const itemsTotal = orderTotal(
    filled.map((line) => ({
      productId: line.productId,
      name: line.name,
      quantity: Number(line.quantity),
      unitPrice: Number(line.unitPrice),
    }))
  );
  const total = itemsTotal + (Number(deliveryCharge) || 0);

  function setLine(key, changes) {
    setLines((previous) =>
      previous.map((line) => (line.key === key ? { ...line, ...changes } : line))
    );
    setError(null);
  }

  function chooseProduct(key, productId) {
    const match = shelf.find(({ product }) => String(product.id) === String(productId));
    if (!match) return;
    setLine(key, {
      productId,
      name: match.product.name,
      unitPrice: Number(match.product.unitPrice) || 0,
      listPrice: Number(match.product.unitPrice) || 0,
    });
  }

  // Warn, do not block. Selling something we are short of is a real decision
  // somebody is allowed to make — they may be about to make more — so the
  // screen says what it knows and leaves the choice with the person.
  const shortages = filled
    .map((line) => {
      const match = shelf.find(({ product }) => String(product.id) === String(line.productId));
      if (!match?.stock.tracked) return null;
      const short = Number(line.quantity) - match.stock.available;
      return short > 0 ? { name: match.product.name, short, have: match.stock.available } : null;
    })
    .filter(Boolean);

  function handleSubmit(event) {
    event.preventDefault();

    if (!customerName.trim()) {
      setError("Say who the order is for. A name is enough.");
      return;
    }
    if (filled.length === 0) {
      setError("Add at least one thing to the order, with how many they want.");
      return;
    }

    onSave({
      customerName: customerName.trim(),
      items: filled.map((line) => ({
        kind:
          Number(line.unitPrice) !== Number(line.listPrice)
            ? LINE_KIND.NEGOTIATED
            : LINE_KIND.CATALOG,
        productId: Number(line.productId),
        name: line.name,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
        listPrice: Number(line.listPrice),
        lineTotal: Number(line.unitPrice) * Number(line.quantity),
        stockUnits: Number(line.quantity),
      })),
      totalAmount: total,
      delivery: address.trim()
        ? {
            location: address.trim(),
            dueOn: dueOn || null,
            driver: driver.trim() || null,
            amount: Number(deliveryCharge) || 0,
          }
        : null,
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mx-auto w-full max-w-[820px]">
      <Card>
        <FormBand step={1} title="Who is it for?">
          {error && (
            <Callout tone="red" icon={<TriangleAlert />} title="Not saved yet.">
              {error}
            </Callout>
          )}

          <Field
            label="Customer"
            required
            hint="Start typing to find someone already on the books, or write a new name."
          >
            {(props) => (
              <>
                <Input
                  {...props}
                  list="order-customers"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="Ana Reyes"
                />
                {/* A datalist rather than a select: most orders are for somebody
                    already on the books, but a walk-in who has never been added
                    must not be turned away by the form. */}
                <datalist id="order-customers">
                  {customers.map((one) => (
                    <option key={one.id} value={one.name} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
        </FormBand>

        <FormBand step={2} title="What do they want?" tinted>
          <div className="flex flex-col gap-3">
            {lines.map((line) => {
              const match = shelf.find(
                ({ product }) => String(product.id) === String(line.productId)
              );
              return (
                <div
                  key={line.key}
                  className="rounded-field border border-card bg-surface p-4"
                >
                  <div className="grid gap-3.5 sm:grid-cols-[minmax(0,2fr)_100px_140px]">
                    <Field label="Item">
                      {(props) => (
                        <Select
                          value={String(line.productId)}
                          onValueChange={(next) => chooseProduct(line.key, next)}
                        >
                          <SelectTrigger id={props.id}>
                            <SelectValue placeholder="Pick a product" />
                          </SelectTrigger>
                          <SelectContent>
                            {shelf.map(({ product, stock }) => (
                              <SelectItem key={product.id} value={String(product.id)}>
                                {product.name}
                                {stock.tracked ? ` — ${stock.available} left` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </Field>

                    <Field label="How many">
                      {(props) => (
                        <Input
                          {...props}
                          type="number"
                          inputMode="numeric"
                          min="1"
                          value={line.quantity}
                          onChange={(event) =>
                            setLine(line.key, { quantity: event.target.value })
                          }
                        />
                      )}
                    </Field>

                    <Field
                      label="Price each"
                      hint={
                        match && Number(line.unitPrice) !== Number(line.listPrice)
                          ? `List price is ${formatPeso(line.listPrice)}`
                          : undefined
                      }
                    >
                      {(props) => (
                        <Input
                          {...props}
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          value={line.unitPrice}
                          onChange={(event) =>
                            setLine(line.key, { unitPrice: event.target.value })
                          }
                        />
                      )}
                    </Field>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3.5">
                    <span className="text-[15px] text-muted">
                      {match?.stock.tracked
                        ? `${match.stock.available} on the shelf · ${stockLabel(match.stock.status)}`
                        : "Stock not tracked for this one"}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-[16.5px] font-bold tabular-nums">
                        {formatPeso(Number(line.unitPrice) * Number(line.quantity || 0))}
                      </span>
                      {lines.length > 1 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setLines((previous) => previous.filter((l) => l.key !== line.key))
                          }
                        >
                          <Trash2 className="h-4.5 w-4.5" />
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {lines.length === 0 && (
              <EmptySlot className="py-6">Nothing on the order yet.</EmptySlot>
            )}
          </div>

          <Button
            variant="outline"
            size="lg"
            onClick={() => setLines((previous) => [...previous, emptyLine()])}
          >
            <Plus className="h-5 w-5" />
            Add another item
          </Button>

          {shortages.length > 0 && (
            <Callout tone="amber" icon={<TriangleAlert />} title="More than we have on the shelf">
              {shortages.map((shortage) => (
                <span key={shortage.name} className="block">
                  {shortage.name}: only {shortage.have} free to sell, so {shortage.short} would
                  need making.
                </span>
              ))}
              <span className="block pt-1.5">
                You can still write the order — it will show on the make list.
              </span>
            </Callout>
          )}
        </FormBand>

        <FormBand step={3} title="Is it going out?">
          <Field
            label="Where to"
            hint="Leave this empty if they are collecting. Put the district or city last."
          >
            {(props) => (
              <Input
                {...props}
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="12 Mabini St, Poblacion, Davao City"
              />
            )}
          </Field>

          {address.trim() && (
            <>
              <Row>
                <Field label="Promised for" hint="The day they expect it.">
                  {(props) => (
                    <Input
                      {...props}
                      type="date"
                      value={dueOn}
                      onChange={(event) => setDueOn(event.target.value)}
                    />
                  )}
                </Field>
                <Field label="Who is taking it" hint="Can be filled in later.">
                  {(props) => (
                    <Input
                      {...props}
                      value={driver}
                      onChange={(event) => setDriver(event.target.value)}
                      placeholder="Nobody yet"
                    />
                  )}
                </Field>
              </Row>

              <Field label="Delivery charge" hint="Leave empty if delivery is free.">
                {(props) => (
                  <Input
                    {...props}
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={deliveryCharge}
                    onChange={(event) => setDeliveryCharge(event.target.value)}
                    placeholder="0.00"
                  />
                )}
              </Field>
            </>
          )}
        </FormBand>

        {/* The total, at the size the order detail screen uses for it, so the
            number somebody reads out to a customer looks the same in both
            places. */}
        <div className="flex items-baseline justify-between gap-6 border-t border-hair bg-surface px-6.5 py-5">
          <span className="text-[16.5px] font-extrabold text-ink">Total to pay</span>
          <span className="text-[28px] font-extrabold tracking-[-0.02em] tabular-nums text-ink">
            {formatPeso(total)}
          </span>
        </div>

        <FormFooter
          left={
            <Button variant="outline" size="lg" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
          }
          right={
            <Button type="submit" variant="cobalt" size="lg" disabled={saving}>
              <Save className="h-5 w-5" />
              {saving ? "Saving…" : "Write this order"}
            </Button>
          }
        />
      </Card>
    </form>
  );
}
