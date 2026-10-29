import FormError from "../shared/FormError";
import { localDateIso, promisedDateProblem } from "../../utils/dates";
import { guardForm, reportFormError } from "../../utils/formErrors";
import { useMemo, useState } from "react";

import { Gift, Plus, Trash, Warning } from "../icons";
import { Button } from "@/components/ui/button";
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
import { Field, Row } from "../shared/forms";
import { Avatar } from "../shared/Chip";
import { Page, PageHeader, SectionCard, TextLink } from "../shared/page";
import { Checkbox } from "../shared/AuthField";
import { LINE_KIND } from "../../utils/constants";
import { customerSummary, DEFAULT_LOYALTY, loyaltyDiscount } from "../../utils/customers";
import { normalizeItems, orderTotal } from "../../utils/orderItems";
import { roundMoney } from "../../utils/money";
import { moneyProblem, nameProblem } from "../../utils/validation";
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
 * THE LOYALTY REWARD IS OFFERED, NOT HIDDEN. When the order is for a saved
 * customer who has earned it under the rules a manager set, the form says so
 * and applies it, and the order records that it did. The database checks the
 * same rules when it saves (private.validate_order_promotion).
 *
 * PRICES DEFAULT, THEY DO NOT LOCK. A line starts at the catalogue price and
 * can be changed, because the real business negotiates. What it cannot do is
 * pretend the change did not happen: the line is marked as an agreed price so
 * the order shows why the total is not the sum of the list prices.
 *
 * A LINE CAN ALSO BE MADE BY HAND. LSB's own product line is custom sculptures
 * and made-to-order pieces, and `LINE_KIND.CUSTOM` has existed since the data
 * model did — OrderDetail already prints a custom line's note beside its name.
 * This screen used to have no way to WRITE one: every line required a
 * `productId` from the shelf, so an order for anything not already in the
 * catalogue could not be entered at all. Toggling a line to "not in the
 * catalogue" swaps the Select for two plain fields (a name, and what makes it
 * custom) and draws no stock — the same thing `normalizeItem` already assumes
 * a custom line does.
 */

const emptyLine = () => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  productId: "",
  name: "",
  notes: "",
  quantity: 1,
  unitPrice: 0,
  listPrice: 0,
  custom: false,
  // Carried so a line this form cannot BUILD can still survive being edited.
  // A cut-to-size line is the case: its kind and its parent-sheet draw are
  // decided where the cutting is worked out, not here, and a new row has
  // neither until it is seeded from a saved one.
  kind: null,
  stockUnits: null,
  // The quantity this row was SEEDED with, kept still while `quantity` is
  // typed in. A cut line's draw scales against the pairing it arrived as, so
  // comparing against the live field would make every keystroke its own new
  // baseline and the draw would never move.
  seededQuantity: null,
});

/**
 * Turns a stored order's lines back into rows this form can edit.
 *
 * THE ID HAS TO BE TRANSLATED BACK. A saved line carries the INVENTORY row's
 * id, because that is what the stock maths reads (see stockRowIdFor below);
 * this form's Select works in CATALOGUE ids. Going in, the translation runs the
 * other way, through the same item_code = sku join.
 *
 * A line whose product has since been deleted becomes a by-hand line keeping
 * its name and price, rather than an empty row or a silently dropped one. The
 * order said what it said; editing the delivery address should not quietly
 * throw a line away.
 */
function seedLines(order, products, inventory) {
  const items = normalizeItems(order?.items);
  if (items.length === 0) return [emptyLine()];

  const rowIdByCode = new Map(
    inventory.map((row) => [String(row.sku || "").toLowerCase(), row.id])
  );
  const catalogueIdByRowId = new Map();
  for (const product of products) {
    const rowId = rowIdByCode.get(String(product.itemCode || "").toLowerCase());
    if (rowId != null) catalogueIdByRowId.set(rowId, product.id);
  }

  return items.map((item) => {
    const catalogueId =
      item.productId == null ? null : catalogueIdByRowId.get(item.productId) ?? null;
    const byHand = item.kind === LINE_KIND.CUSTOM || catalogueId == null;
    return {
      ...emptyLine(),
      custom: byHand,
      productId: byHand ? "" : String(catalogueId),
      name: item.name ?? "",
      notes: item.notes ?? "",
      quantity: String(item.quantity ?? ""),
      unitPrice: String(item.unitPrice ?? 0),
      listPrice: Number(item.listPrice ?? item.unitPrice ?? 0),
      // A cut line draws WHOLE PARENT SHEETS -- three sheets can yield twelve
      // finished pieces -- so its kind and its draw have to come back out of
      // the saved line. Rebuilding them from the row, the way an ordinary line
      // is rebuilt, sets the draw to the number of PIECES and quadruples what
      // comes off the shelf.
      kind: item.kind ?? null,
      stockUnits: Number(item.stockUnits ?? 0),
      seededQuantity: Number(item.quantity ?? 0),
    };
  });
}

export default function OrderFormPage({
  customers = [],
  products = [],
  inventory = [],
  /** Every order already written, so "free to sell" excludes what is promised. */
  existingOrders = [],
  /** Customers' whole-history totals (utils/customers statsIndex) and the rules. */
  customerStats = new Map(),
  loyalty = DEFAULT_LOYALTY,
  /** Pre-selected when the order was started from a customer's own screen. */
  customer,
  /** The order being rewritten, when this screen is opened as an edit. */
  order,
  /** Its delivery, if one was raised — the address fields are seeded from it. */
  delivery,
  mode = "add",
  saving = false,
  onSave,
  onCancel,
}) {
  const isEdit = mode === "edit";
  const [customerName, setCustomerName] = useState(
    isEdit ? order?.customerName ?? "" : customer?.name ?? ""
  );
  const [lines, setLines] = useState(() =>
    isEdit ? seedLines(order, products, inventory) : [emptyLine()]
  );
  const [address, setAddress] = useState(
    isEdit ? delivery?.location ?? "" : customer?.address ?? ""
  );
  const [dueOn, setDueOn] = useState(isEdit ? delivery?.dueOn ?? "" : "");
  const [dueError, setDueError] = useState(null);
  const [driver, setDriver] = useState(isEdit ? delivery?.driver ?? "" : "");
  const [deliveryCharge, setDeliveryCharge] = useState(
    isEdit && delivery?.amount ? String(delivery.amount) : ""
  );
  const [error, setError] = useState(null);
  // Problems shown beside the field they belong to: the customer, and each
  // line's price by line key.
  const [customerProblem, setCustomerProblem] = useState(null);
  const [priceProblems, setPriceProblems] = useState({});
  // Asked once, then it goes through — the same shape as the duplicate-name and
  // phone-number questions on the record dialogs.
  const [deliveryDoubt, setDeliveryDoubt] = useState(null);
  const [askedAboutDelivery, setAskedAboutDelivery] = useState(false);

  const shelf = useMemo(
    () => shelfItems(products, inventory, existingOrders),
    [products, inventory, existingOrders]
  );

  const filled = lines.filter(
    (line) => (line.custom ? line.name.trim() : line.productId) && Number(line.quantity) > 0
  );
  const itemsTotal = orderTotal(
    filled.map((line) => ({
      productId: line.productId,
      name: line.name,
      quantity: Number(line.quantity),
      unitPrice: Number(line.unitPrice),
    }))
  );
  // WHICH CUSTOMER RECORD THIS IS FOR, when that can be known for certain.
  // The field stays free text with a datalist, deliberately, so a walk-in can
  // be served without being enrolled first -- which means a typed name may
  // match one customer, none, or more than one.
  //
  // Only an exact single match is linked. None is an ordinary unlinked order.
  // MORE than one is the case that matters: two people really do share a name,
  // and quietly picking whichever sorts first would attach one person's
  // spending to the other. An unchanged name keeps the identity the order or
  // the customer screen started with, even after a rename.
  const typed = customerName.trim().toLowerCase();
  const originalName = isEdit ? order?.customerName : customer?.name;
  const originalId = isEdit ? order?.customerId : customer?.id;
  const named = customers.filter((one) => String(one.name || "").trim().toLowerCase() === typed);
  const customerId = originalId != null && typed === String(originalName || "").trim().toLowerCase()
    ? originalId
    : named.length === 1 ? named[0].id : null;
  const linked = customers.find((one) => one.id === customerId);

  const [useReward, setUseReward] = useState(true);
  const earned = linked ? customerSummary(linked, customerStats, loyalty) : null;
  const offerReward = Boolean(earned?.rewardEligible);
  // A reward already on an order being changed stays as it was agreed, even if
  // the rules have moved since; the database re-checks only a changed amount.
  const keptDiscount = isEdit && !offerReward ? Number(order?.discountAmount) || 0 : 0;
  const discount = offerReward && useReward ? loyaltyDiscount(itemsTotal, loyalty) : keptDiscount;
  const total = Math.max(0, roundMoney(itemsTotal + (Number(deliveryCharge) || 0) - discount));

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
      kind: null,
      stockUnits: null,
      seededQuantity: null,
      name: match.product.name,
      unitPrice: Number(match.product.unitPrice) || 0,
      listPrice: Number(match.product.unitPrice) || 0,
    });
  }

  /**
   * The id an order line has to carry so the stock maths can find it.
   *
   * NOT THE CATALOGUE ID. `products` and `inventory` are two tables joined on
   * code, with their own separate primary keys, and every stock function keys
   * on the INVENTORY one — see the note on `rowId` in utils/productStock. This
   * screen picks from the catalogue, so it has the wrong id in hand and has to
   * translate before it saves. It did not, and the first real order written
   * here reserved nothing and deducted nothing while reporting itself
   * Completed.
   *
   * Null for a catalogue entry nobody is counting yet. That is honest rather
   * than lossy: with no ledger row there is no stock to draw, and a line
   * pointing at an id that matches nothing is what caused this in the first
   * place.
   */
  const stockRowIdFor = (productId) =>
    shelf.find(({ product }) => String(product.id) === String(productId))?.stock.rowId ?? null;

  /** Swap a line between "pick from the shelf" and "made by hand". */
  function toggleCustom(key) {
    setLines((previous) =>
      previous.map((line) => {
        if (line.key !== key) return line;
        return line.custom
          ? { ...emptyLine(), key: line.key, quantity: line.quantity, custom: false }
          : { ...emptyLine(), key: line.key, quantity: line.quantity, custom: true };
      })
    );
    setError(null);
  }

  // Warn, do not block. Selling something we are short of is a real decision
  // somebody is allowed to make — they may be about to make more — so the
  // screen says what it knows and leaves the choice with the person. A custom
  // line draws no catalog stock, so it never appears here.
  const shortages = filled
    .map((line) => {
      const match = shelf.find(({ product }) => String(product.id) === String(line.productId));
      if (!match?.stock.tracked) return null;
      const short = Number(line.quantity) - match.stock.available;
      return short > 0 ? { name: match.product.name, short, have: match.stock.available } : null;
    })
    .filter(Boolean);

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;
    const formElement = event.currentTarget;
    const fail = (message) => { setError(message); reportFormError(formElement, message); };
    // A date already on the delivery is kept even if it has passed; only a
    // date typed now has to be today or later. The database checks the same.
    const dateProblem = address.trim() ? promisedDateProblem(dueOn, isEdit ? delivery?.dueOn ?? null : null) : null;
    if (dateProblem) {
      setDueError(dateProblem);
      fail(dateProblem);
      return;
    }
    if (!guardForm(formElement)) return;
    // A blank price used to be read as 0 and saved as a free line. The price is
    // checked as typed, beside its own field, before anything else is judged.
    const nextPriceProblems = {};
    for (const line of lines) {
      const problem = moneyProblem(line.unitPrice, { label: "The price" });
      if (problem) nextPriceProblems[line.key] = problem;
    }
    const nextCustomerProblem = customerName.trim() ? nameProblem(customerName, { label: "The customer's name" }) : null;
    setPriceProblems(nextPriceProblems);
    setCustomerProblem(nextCustomerProblem);
    if (nextCustomerProblem || Object.keys(nextPriceProblems).length > 0) {
      reportFormError(formElement, nextCustomerProblem || Object.values(nextPriceProblems)[0]);
      return;
    }
    if (filled.length !== lines.length || lines.some((line) => !Number.isInteger(Number(line.quantity)) || Number(line.quantity) <= 0 || !Number.isFinite(Number(line.unitPrice)) || Number(line.unitPrice) < 0)) {
      fail('Complete every order line with a product, a whole quantity above zero and a price of zero or more.');
      return;
    }

    if (!customerName.trim()) {
      fail("Say who the order is for. A name is enough.");
      return;
    }
    if (filled.length === 0) {
      fail("Add at least one thing to the order, with how many they want.");
      return;
    }

    // AN EMPTY ADDRESS SILENTLY MEANT "NO DELIVERY", and silence is the wrong
    // way to communicate a decision that big: the order saved, the deliveries
    // board never mentioned it, and nobody found out until the customer rang
    // asking where their goods were. It is still allowed — plenty of orders are
    // collected at the shop — so this asks once and then gets out of the way.
    if (!address.trim() && !askedAboutDelivery) {
      setDeliveryDoubt(
        delivery
          ? "Clearing this removes the delivery already raised for this order. Is it being collected from the shop instead?"
          : "Nothing here means no delivery is raised for this order. Is it being collected from the shop?"
      );
      setAskedAboutDelivery(true);
      return;
    }

    try {
    const result = await onSave({
      customerName: customerName.trim(),
      customerId,
      items: filled.map((line) => {
        // A CUT LINE IS NOT REBUILT, IT IS CARRIED. This form knows how to make
        // a catalogue, negotiated or by-hand line and nothing else, so a saved
        // cut line used to come out the other side as one of those three: its
        // kind flipped, its cutting notes were dropped, and stockUnits was
        // rewritten from the parent-sheet count to the piece count -- twelve
        // pieces off a three-sheet draw became a twelve-sheet draw, quadrupling
        // what the order reserved and later deducted, on somebody saving an
        // unrelated change to the delivery address.
        //
        // The draw scales with the quantity because that is the physical fact:
        // twelve pieces from three sheets is four to a sheet, so twenty-four
        // pieces need six. Rounded UP -- a part-used sheet has still left the
        // shelf. An unchanged quantity scales by exactly one and comes back the
        // number it went in as.
        const wasCut = line.kind === LINE_KIND.CUT;
        const quantity = Number(line.quantity);
        const cutDraw = () => {
          const originalQty = Number(line.seededQuantity);
          const originalDraw = Number(line.stockUnits);
          if (!originalDraw || !originalQty) return originalDraw || 0;
          const perParent = originalQty / originalDraw;
          return perParent > 0 ? Math.ceil(quantity / perParent) : originalDraw;
        };

        return {
        kind: wasCut
          ? LINE_KIND.CUT
          : line.custom
          ? LINE_KIND.CUSTOM
          : Number(line.unitPrice) !== Number(line.listPrice)
            ? LINE_KIND.NEGOTIATED
            : LINE_KIND.CATALOG,
        // The ledger row's id, not the catalogue row's — see stockRowIdFor.
        productId: line.custom ? null : stockRowIdFor(line.productId),
        name: line.name,
        // Cutting instructions are the point of a cut line, not decoration.
        notes: wasCut || line.custom ? line.notes.trim() || undefined : undefined,
        quantity,
        unitPrice: Number(line.unitPrice),
        listPrice: Number(line.listPrice),
        lineTotal: roundMoney(Number(line.unitPrice) * quantity),
        // A custom shape consumes no catalog stock — see normalizeItem.
        stockUnits: wasCut ? cutDraw() : line.custom ? 0 : quantity,
        };
      }),
      totalAmount: total,
      discountAmount: discount,
      promotion: discount > 0 ? { kind: "loyalty" } : null,
      delivery: address.trim()
        ? {
            location: address.trim(),
            dueOn: dueOn || null,
            driver: driver.trim() || null,
            amount: Number(deliveryCharge) || 0,
          }
        : null,
    });
    if (!result?.ok) fail(result?.message || 'The order was not saved. Check the details and retry.');
    } catch {
      fail('The request failed. Your entries are still here; check the connection and retry.');
    }
  }

  const cell = "border-b border-row-divider px-2 py-2 align-top first:pl-3 last:pr-3";

  return (
    <Page>
      <PageHeader
        back={{ label: isEdit ? "Back to the order" : "Back to Orders", onClick: onCancel }}
        title={isEdit ? `Edit order #${order?.id ?? ""}` : "New order"}
        description="Stock is set aside when you create the order. Nothing leaves the shelf until it is delivered."
      />
      <form onSubmit={handleSubmit} noValidate className="w-full max-w-[720px]">
        <SectionCard
          title={isEdit ? "Order details" : "Order"}
          bodyClassName="flex flex-col gap-3.5 px-4 pb-4"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onCancel} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving
                  ? "Saving…"
                  : deliveryDoubt
                    ? isEdit
                      ? "Save it anyway"
                      : "Create it anyway"
                    : isEdit
                      ? "Save changes"
                      : "Create order"}
              </Button>
            </div>
          }
        >
          <FormError message={error} />

          <Field
            label="Customer"
            required
            error={customerProblem}
            hint={linked ? undefined : "Start typing to find someone already on the books, or write a new name."}
          >
            {(props) => (
              <>
                <Input
                  {...props}
                  list="order-customers"
                  value={customerName}
                  onChange={(event) => {
                    setCustomerName(event.target.value);
                    setCustomerProblem(null);
                  }}
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
          {linked ? (
            <div className="-mt-1.5 flex items-center gap-2.5 rounded-md border border-border px-3 py-2 text-13">
              <Avatar name={linked.name} size="sm" />
              <span className="min-w-0 truncate">
                <span className="font-medium">{linked.name}</span>
                <span className="text-muted-fg">
                  {[linked.address, linked.contactNumber, earned ? `${earned.openCount} open ${earned.openCount === 1 ? "order" : "orders"}` : null]
                    .filter(Boolean)
                    .map((part) => ` · ${part}`)
                    .join("")}
                </span>
              </span>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <p className="m-0 text-sm font-medium">Items</p>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[560px] border-collapse text-13">
                <thead>
                  <tr className="bg-surface-2 text-left text-xs text-muted-fg">
                    <th scope="col" className="h-8 px-2 pl-3 font-medium">Product</th>
                    <th scope="col" className="h-8 w-20 px-2 font-medium">Qty</th>
                    <th scope="col" className="h-8 w-28 px-2 font-medium">Price</th>
                    <th scope="col" className="h-8 w-28 px-2 text-right font-medium">Total</th>
                    <th scope="col" className="h-8 w-10 px-2 pr-3"><span className="sr-only">Remove</span></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => {
                    const match = shelf.find(
                      ({ product }) => String(product.id) === String(line.productId)
                    );
                    return (
                      <tr key={line.key}>
                        <td className={cell}>
                          <div className="flex min-w-0 flex-col gap-1.5">
                            {line.custom ? (
                              <>
                                <Input
                                  aria-label="What is it"
                                  value={line.name}
                                  onChange={(event) => setLine(line.key, { name: event.target.value })}
                                  placeholder="Carved rose centrepiece"
                                />
                                <Input
                                  aria-label="Details"
                                  value={line.notes}
                                  onChange={(event) => setLine(line.key, { notes: event.target.value })}
                                  placeholder="Size, shape, colour: why the price is what it is"
                                />
                              </>
                            ) : (
                              <Select
                                items={shelf.map(({ product }) => ({ value: String(product.id), label: product.name }))}
                                value={String(line.productId)}
                                onValueChange={(next) => chooseProduct(line.key, next)}
                              >
                                <SelectTrigger aria-label="Item" className="w-full">
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
                            <span className="text-xs text-muted-fg">
                              {line.custom
                                ? "Made to order · priced by hand"
                                : !match
                                  // Nothing picked yet: "not tracked" here stated a
                                  // fact about a product nobody had chosen.
                                  ? "Pick a product to see how many are on the shelf"
                                  : match.stock.tracked
                                    ? `${match.stock.available} on the shelf · ${stockLabel(match.stock.status)}`
                                    : "Stock not tracked for this one"}
                              {match && Number(line.unitPrice) !== Number(line.listPrice)
                                ? ` · list price ${formatPeso(line.listPrice)}`
                                : ""}
                            </span>
                            <TextLink className="w-fit text-xs" onClick={() => toggleCustom(line.key)}>
                              {line.custom ? "Pick from the catalogue instead" : "Not in the catalogue? Add it by hand"}
                            </TextLink>
                          </div>
                        </td>
                        <td className={cell}>
                          <Input
                            aria-label="How many"
                            type="number"
                            inputMode="numeric"
                            min="1"
                            value={line.quantity}
                            onChange={(event) => setLine(line.key, { quantity: event.target.value })}
                          />
                        </td>
                        <td className={cell}>
                          <Input
                            aria-label="Price each"
                            aria-invalid={priceProblems[line.key] ? true : undefined}
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            value={line.unitPrice}
                            onChange={(event) => {
                              setLine(line.key, { unitPrice: event.target.value });
                              setPriceProblems((previous) => ({ ...previous, [line.key]: undefined }));
                            }}
                          />
                          {priceProblems[line.key] ? (
                            <span role="alert" className="mt-1 block text-xs text-danger-fg">{priceProblems[line.key]}</span>
                          ) : null}
                        </td>
                        <td className={`${cell} pt-3.5 text-right font-medium tabular-nums`}>
                          {formatPeso(roundMoney(Number(line.unitPrice) * Number(line.quantity || 0)))}
                        </td>
                        <td className={cell}>
                          {lines.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Remove"
                              onClick={() => setLines((previous) => previous.filter((l) => l.key !== line.key))}
                            >
                              <Trash />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {lines.length === 0 && <EmptySlot>Nothing on the order yet.</EmptySlot>}
              <div className="px-3 py-2">
                <Button variant="ghost" size="sm" onClick={() => setLines((previous) => [...previous, emptyLine()])}>
                  <Plus />
                  Add another item
                </Button>
              </div>
            </div>
          </div>

          {shortages.length > 0 && (
            <Callout tone="amber" icon={<Warning />} title="More than we have on the shelf">
              {shortages.map((shortage) => (
                <span key={shortage.name} className="block">
                  {shortage.name}: only {shortage.have} free to sell, so {shortage.short} would
                  need making.
                </span>
              ))}
              <span className="block pt-1">
                You can still save the order. What is short shows as needed next under Batches.
              </span>
            </Callout>
          )}

          <Field
            label="Where to"
            warning={deliveryDoubt}
            hint="Leave this empty if they are collecting. Put the district or city last."
          >
            {(props) => (
              <Input
                {...props}
                value={address}
                onChange={(event) => {
                  setAddress(event.target.value);
                  // Typing an address answers the question outright.
                  setDeliveryDoubt(null);
                  setAskedAboutDelivery(false);
                }}
                placeholder="12 Mabini St, Poblacion, Davao City"
              />
            )}
          </Field>

          {address.trim() && (
            <Row className="sm:grid-cols-3">
              <Field label="Promised for" error={dueError} hint="Today or later.">
                {(props) => (
                  <Input
                    {...props}
                    type="date"
                    min={isEdit && delivery?.dueOn && delivery.dueOn < localDateIso() ? undefined : localDateIso()}
                    value={dueOn}
                    onChange={(event) => { setDueOn(event.target.value); setDueError(null); }}
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
              <Field label="Delivery charge" hint="Empty if free.">
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
            </Row>
          )}

          {offerReward && (
            <Callout
              tone="green"
              icon={<Gift />}
              title={`${linked.name} has earned the loyalty reward`}
            >
              {earned.completedCount} finished orders. The reward is {loyalty.rewardPercent}% off the
              items{useReward ? `: −${formatPeso(discount)} on this order.` : "."}
              <span className="block pt-2">
                <Checkbox
                  id="apply-reward"
                  checked={useReward}
                  onChange={setUseReward}
                  label="Apply it to this order"
                />
              </span>
            </Callout>
          )}

          {/* What is read out to the customer, line by line, then the total. */}
          <dl className="m-0 flex flex-col gap-1.5 rounded-md bg-surface-2 px-3 py-2.5 text-13">
            <div className="flex justify-between gap-6">
              <dt className="text-muted-fg">Items</dt>
              <dd className="m-0 tabular-nums">{formatPeso(itemsTotal)}</dd>
            </div>
            {Number(deliveryCharge) > 0 && address.trim() ? (
              <div className="flex justify-between gap-6">
                <dt className="text-muted-fg">Delivery</dt>
                <dd className="m-0 tabular-nums">{formatPeso(Number(deliveryCharge))}</dd>
              </div>
            ) : null}
            {discount > 0 ? (
              <div className="flex justify-between gap-6">
                <dt className="text-muted-fg">{keptDiscount > 0 ? "Loyalty reward agreed when written" : "Loyalty reward"}</dt>
                <dd className="m-0 tabular-nums">−{formatPeso(discount)}</dd>
              </div>
            ) : null}
            <div className="mt-1 flex items-baseline justify-between gap-6 border-t border-border pt-2">
              <dt className="font-medium">Total to pay</dt>
              <dd className="m-0 text-base font-semibold tabular-nums">{formatPeso(total)}</dd>
            </div>
          </dl>
        </SectionCard>
      </form>
    </Page>
  );
}
