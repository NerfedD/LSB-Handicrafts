import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import FormError from "../shared/FormError";
import { Field, RadioRow } from "../shared/forms";
import { localDateIso } from "../../utils/dates";
import { roundMoney } from "../../utils/money";
import { balanceOf, needsReference, owingOrders, PAYMENT_METHODS, paymentProblem } from "../../utils/payments";
import { formatPeso, formatShortDate } from "../../utils/profileFormat";

const ALL = "all";

/**
 * Record a payment, drawn to the RecordPaymentDialog board: For (one order, or
 * all of them) → Amount received → Received on → Paid by → Reference number →
 * what is still to collect after this.
 *
 * Opened from an order (that order is chosen) or from a customer (all of their
 * unpaid orders are offered, oldest first). With "all" chosen the database
 * settles them oldest first, so the amount defaults to everything owed and can
 * be lowered for a part payment.
 *
 * Mounted only while open, so it starts fresh each time; the request id is
 * kept across a retry so a payment whose answer was lost is not taken twice.
 */
export default function RecordPaymentDialog({ customerName, orders = [], paid, initialOrderId = null, loading = false, onSave, onClose }) {
  const owing = useMemo(() => owingOrders(orders, paid), [orders, paid]);
  const totalOwed = roundMoney(owing.reduce((sum, order) => sum + balanceOf(order, paid), 0));
  const [pick, setPick] = useState(() => (initialOrderId != null && owing.some((o) => o.id === initialOrderId) ? initialOrderId : ALL));
  const chosen = pick === ALL ? owing : owing.filter((order) => order.id === pick);
  const owed = roundMoney(chosen.reduce((sum, order) => sum + balanceOf(order, paid), 0));

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [receivedOn, setReceivedOn] = useState(() => localDateIso());
  const [problem, setProblem] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [requestId] = useState(() => crypto.randomUUID());

  // Blank means "all of it", so the field follows the order picked until typed in.
  const typed = amount === "" ? (owed ? owed.toFixed(2) : "") : amount;
  const left = Math.max(0, roundMoney(owed - (Number(typed) || 0)));

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaveError(null);
    const found = paymentProblem({ amount: typed, method, reference, receivedOn }, owed, localDateIso());
    setProblem(found);
    if (found) return;
    setSaving(true);
    try {
      const result = await onSave({
        orderIds: chosen.map((order) => order.id),
        amount: Number(typed),
        method,
        reference: needsReference(method) ? reference.trim() : null,
        receivedOn,
        requestId,
      });
      if (!result?.ok) setSaveError(result?.message || "That payment was not recorded. Try again.");
    } catch {
      setSaveError("We could not reach the system, so nothing was recorded. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const errorFor = (field) => (problem?.field === field ? problem.message : undefined);
  const orderOptions = [
    ...(owing.length > 1 ? [{ value: ALL, label: `All ${owing.length} orders`, description: `${formatPeso(totalOwed)} · settled oldest first` }] : []),
    ...owing.map((order) => ({
      value: order.id,
      label: `#${order.id} · ${formatPeso(balanceOf(order, paid))} owed`,
      description: `Written ${formatShortDate(order.createdAt)}`,
    })),
  ];

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !saving) onClose?.(); }}>
      <DialogContent size="md" showClose={!saving}>
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>Record a payment</DialogTitle>
            <DialogDescription>
              {loading
                ? `Looking up what ${customerName || "they"} owe…`
                : owing.length === 0
                  ? `${customerName || "This customer"} owes nothing right now.`
                  : `${customerName || "This customer"} owes ${formatPeso(totalOwed)}${owing.length > 1 ? ` across ${owing.length} orders` : ""}.`}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <FormError message={saveError} />
            {owing.length > 0 ? (
              <>
                {orderOptions.length > 1 ? (
                  <Field label="For">
                    {() => (
                      <RadioRow
                        label="For"
                        value={pick}
                        onChange={(next) => { setPick(next); setAmount(""); setProblem(null); }}
                        options={orderOptions}
                      />
                    )}
                  </Field>
                ) : null}
                <Field label="Amount received" required error={errorFor("amount")} hint={`Up to ${formatPeso(owed)}.`}>
                  {(props) => (
                    <div className="relative">
                      <span aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-13 text-muted-fg">₱</span>
                      <Input
                        {...props}
                        type="number"
                        inputMode="decimal"
                        step="any"
                        min="0"
                        className="pl-6"
                        value={typed}
                        onChange={(event) => setAmount(event.target.value)}
                      />
                    </div>
                  )}
                </Field>
                <Field label="Received on" required error={errorFor("receivedOn")}>
                  {(props) => (
                    <Input {...props} type="date" max={localDateIso()} value={receivedOn} onChange={(event) => setReceivedOn(event.target.value)} />
                  )}
                </Field>
                <Field label="Paid by" error={errorFor("method")}>
                  {() => <RadioRow label="Paid by" value={method} onChange={setMethod} options={PAYMENT_METHODS} />}
                </Field>
                {needsReference(method) ? (
                  <Field
                    label="Reference number"
                    required
                    error={errorFor("reference")}
                    hint={method === "check" ? "The check number." : "The reference on the receipt or confirmation."}
                  >
                    {(props) => <Input {...props} maxLength={80} value={reference} onChange={(event) => setReference(event.target.value)} />}
                  </Field>
                ) : null}
                <div className="flex items-baseline justify-between rounded-md bg-surface-2 px-3 py-2.5 text-13">
                  <span className="text-muted-fg">Still to collect after this</span>
                  <span className={left === 0 ? "font-semibold text-success-fg" : "font-semibold text-warning-fg"}>
                    {left === 0 ? "Nothing. All paid." : formatPeso(left)}
                  </span>
                </div>
              </>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => onClose?.()} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving || loading || owing.length === 0}>
              {saving ? "Recording…" : "Record payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
