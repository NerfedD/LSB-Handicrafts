import { useMemo, useState } from "react";

import { Banknote, TriangleAlert, Undo2 } from "../icons";
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
import Callout from "../shared/Callout";
import { ChoiceButtons, Field, RadioCards } from "../shared/forms";
import { REFUND_DISPOSITION, REFUND_METHOD } from "../../utils/constants";
import {
  DISPOSITION_OPTIONS,
  REFUND_METHOD_OPTIONS,
  REFUND_REASON_OPTIONS,
} from "../../utils/copy";
import { normalizeItems } from "../../utils/orderItems";
import { orderNetTotal } from "../../utils/orders";
import { committedOf, orderedOf, voidedOf } from "../../utils/stockLedger";
import { formatPeso } from "../../utils/profileFormat";

/**
 * Giving money back.
 *
 * TWO SEPARATE QUESTIONS, AND THE SECOND ONE IS THE IMPORTANT ONE. How much
 * money goes back is arithmetic. What happens to the goods is a judgement only
 * the person holding them can make, and getting it wrong is expensive in a
 * direction nobody notices: a cracked sheet or a shape carved to somebody's
 * wedding cannot be sold to anyone else, so putting it back on the shelf makes
 * the shelf claim stock that will never sell. That is why the disposition is a
 * required choice per item with the consequence spelled out on the card, and
 * why there is no default.
 *
 * PARTIAL IS THE NORMAL CASE. One item of six came back damaged far more often
 * than a whole order is cancelled, so the per-line quantities start at zero and
 * "Give all of it back" is a button rather than the starting state — the
 * expensive answer should take a deliberate press.
 *
 * A FULL REFUND CANCELS THE ORDER and says so before it is pressed, including
 * what survives: the order stays in the list under the customer's name so the
 * record of what was asked for is not lost.
 */

const asUnits = (value) => Math.max(0, Math.trunc(Number(value) || 0));
const asMoney = (value) => Math.max(0, Number(value) || 0);

/** The lines that can still have something refunded against them. */
function refundableLines(order) {
  return normalizeItems(order?.items).map((line, index) => {
    const ordered = orderedOf(line);
    const voided = voidedOf(line);
    return {
      index,
      name: line.name,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal: line.lineTotal,
      committed: committedOf(line),
      // What is left to give back on this line. A unit already refunded cannot
      // be refunded twice, which is what voidedUnits records.
      refundable: Math.max(0, ordered - voided),
      tracked: ordered > 0,
    };
  });
}

export default function RefundDialog({ open, onOpenChange, order, onSave }) {
  const lines = useMemo(() => refundableLines(order), [order]);
  const outstanding = orderNetTotal(order);

  const [units, setUnits] = useState({});
  const [disposition, setDisposition] = useState({});
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(REFUND_METHOD.CASH);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const chosen = lines
    .map((line) => ({ ...line, units: Math.min(asUnits(units[line.index]), line.refundable) }))
    .filter((line) => line.units > 0);

  // What those lines are worth, offered as the starting figure so nobody has to
  // do the multiplication — but editable, because a goodwill refund is a real
  // thing and so is keeping a delivery charge.
  const suggested = chosen.reduce((sum, line) => sum + line.units * line.unitPrice, 0);
  const givingBack = amount === "" ? suggested : asMoney(amount);
  const isFull = givingBack >= outstanding && outstanding > 0;
  const needsDisposition = chosen.filter(
    (line) => line.tracked && line.committed > 0 && !disposition[line.index]
  );

  function reset() {
    setUnits({});
    setDisposition({});
    setAmount("");
    setMethod(REFUND_METHOD.CASH);
    setReason("");
    setErrors({});
  }

  function handleOpenChange(next) {
    if (saving) return;
    if (!next) reset();
    onOpenChange?.(next);
  }

  function takeAll() {
    setUnits(Object.fromEntries(lines.map((line) => [line.index, String(line.refundable)])));
    setAmount(String(outstanding));
  }

  function validate() {
    const found = {};
    if (givingBack <= 0) {
      found.amount = "Put in how much is going back. It has to be more than nothing.";
    }
    if (givingBack > outstanding) {
      found.amount = `That is more than the ${formatPeso(outstanding)} still on this order.`;
    }
    if (!reason) {
      found.reason = "Say why the money is going back. It is how a pattern gets spotted.";
    }
    if (needsDisposition.length > 0) {
      found.disposition = `Say what happened to the ${needsDisposition
        .map((line) => line.name)
        .join(", ")} that came back.`;
    }
    return found;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const found = validate();
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setSaving(true);
    const ok = await onSave({
      amount: givingBack,
      method,
      reason,
      full: isFull,
      lines: chosen.map((line) => ({
        lineIndex: line.index,
        units: line.units,
        // A line where nothing ever shipped has no goods to dispose of. It is
        // recorded as scrapped-by-default only in the sense that no stock moves
        // — handleRefundStock puts nothing back for units that never left.
        disposition: disposition[line.index] ?? REFUND_DISPOSITION.SCRAP,
      })),
    });
    setSaving(false);
    if (ok !== false) handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>Give money back on order #{order?.id}</DialogTitle>
            <DialogDescription>
              {formatPeso(outstanding)} is on this order. Put in how many of each thing
              came back, then say what happened to it.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="flex flex-col gap-5.5">
            {lines.map((line) => {
              const taken = Math.min(asUnits(units[line.index]), line.refundable);
              return (
                <div key={line.index} className="flex flex-col gap-3.5">
                  <Field
                    label={line.name}
                    hint={
                      line.refundable === 0
                        ? "Everything on this line has already been given back."
                        : `${line.refundable} can still come back, at ${formatPeso(line.unitPrice)} each.`
                    }
                  >
                    {(props) => (
                      <Input
                        {...props}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={line.refundable}
                        disabled={line.refundable === 0}
                        value={units[line.index] ?? ""}
                        placeholder="0"
                        onChange={(event) =>
                          setUnits((previous) => ({
                            ...previous,
                            [line.index]: event.target.value,
                          }))
                        }
                      />
                    )}
                  </Field>

                  {/* Only asked once something is actually coming back, and only
                      where something actually left — there is nothing to put on
                      a shelf that never left it. */}
                  {taken > 0 && line.tracked && line.committed > 0 && (
                    <Field
                      label={`What happened to the ${taken} × ${line.name}?`}
                      error={errors.disposition && !disposition[line.index] ? errors.disposition : undefined}
                    >
                      <RadioCards
                        label={`What happened to the returned ${line.name}`}
                        options={DISPOSITION_OPTIONS}
                        value={disposition[line.index]}
                        onChange={(next) =>
                          setDisposition((previous) => ({ ...previous, [line.index]: next }))
                        }
                      />
                    </Field>
                  )}
                </div>
              );
            })}

            <Button variant="outline" size="lg" onClick={takeAll} disabled={saving}>
              <Undo2 className="h-5 w-5" />
              Give all of it back
            </Button>

            <Field
              label="How much is going back"
              required
              error={errors.amount}
              hint={
                suggested > 0
                  ? `What came back is worth ${formatPeso(suggested)}. Change this if a different amount was agreed.`
                  : "In pesos."
              }
            >
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={amount === "" ? (suggested > 0 ? String(suggested) : "") : amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0"
                />
              )}
            </Field>

            <Field label="How they get it">
              <ChoiceButtons
                label="How they get the money back"
                options={REFUND_METHOD_OPTIONS}
                value={method}
                onChange={setMethod}
              />
            </Field>

            <Field label="Why" required error={errors.reason}>
              <RadioCards
                label="Why the money is going back"
                options={REFUND_REASON_OPTIONS}
                value={reason}
                onChange={(next) => {
                  setReason(next);
                  setErrors((previous) => ({ ...previous, reason: undefined }));
                }}
              />
            </Field>

            {isFull && (
              <Callout
                tone="red"
                icon={<TriangleAlert />}
                title="This gives back everything, so the order is cancelled"
              >
                Nothing more will be made or sent for it, and any stock still set aside
                is released. The order stays in the list under {order?.customerName}, so
                the record of what was asked for is not lost. Anything you marked as
                thrown away does not go back on the shelf.
              </Callout>
            )}
          </DialogBody>

          <DialogFooter className="justify-between">
            <Button
              variant="outline"
              size="lg"
              disabled={saving}
              onClick={() => handleOpenChange(false)}
            >
              Keep it
            </Button>
            <Button
              type="submit"
              variant="danger-solid"
              size="lg"
              // A button that is always pressable reads as ready even at
              // ₱0.00 — the one figure that is guaranteed to fail on submit.
              // Disabled here is the honest default; enabled is the promise.
              disabled={saving || givingBack <= 0}
            >
              <Banknote className="h-5 w-5" />
              {saving ? "Working…" : `Give back ${formatPeso(givingBack)}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
