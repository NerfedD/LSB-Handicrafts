import { useState } from "react";

import { Info, Tag } from "../icons";
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
import { Field, RadioCards } from "../shared/forms";
import { PRICE_REASON_OPTIONS } from "../../utils/copy";
import { orderRefunded } from "../../utils/orders";
import { formatPeso } from "../../utils/profileFormat";

/**
 * Putting a price right after the customer has already been told one.
 *
 * THE OLD FIGURE IS KEPT, ALWAYS. Correcting a price used to mean typing over
 * total_amount, which quietly destroyed the only record of what was quoted — so
 * a disputed invoice a month later had no evidence on either side, and nobody
 * could tell a correction from a mistake. Every change is appended to the
 * order's history with the old total, the new one, who changed it and why, and
 * the order screen prints the most recent one as a banner.
 *
 * THE REASON IS REQUIRED for the same reason it is on a refund: the person who
 * has to answer for a total that moved is usually not the person who moved it.
 *
 * IT SAYS WHICH DIRECTION, IN WORDS. "₱240 more than they were told" and "₱180
 * too much was charged" are different conversations — one is a bill to send,
 * the other is money to give back — and a signed number leaves the reader to
 * work out which. The difference is stated, and then what to do about it is
 * stated under it.
 */

const asMoney = (value) => Math.max(0, Number(value) || 0);

export default function PriceAdjustmentDialog({ open, onOpenChange, order, onSave }) {
  const oldTotal = Number(order?.totalAmount) || 0;

  const [newTotal, setNewTotal] = useState(String(oldTotal));
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const next = asMoney(newTotal);
  const difference = next - oldTotal;
  const undercharged = difference > 0;
  const overcharged = difference < 0;
  const alreadyBack = orderRefunded(order);

  function reset() {
    setNewTotal(String(oldTotal));
    setReason("");
    setErrors({});
  }

  function handleOpenChange(nextOpen) {
    if (saving) return;
    if (!nextOpen) reset();
    onOpenChange?.(nextOpen);
  }

  function validate() {
    const found = {};
    if (newTotal.trim() === "") {
      found.newTotal = "Put in what the order should cost.";
    } else if (difference === 0) {
      found.newTotal = "That is the same as the price now, so there is nothing to change.";
    } else if (next < alreadyBack) {
      found.newTotal = `${formatPeso(alreadyBack)} has already been given back on this order, so the new price cannot be less than that.`;
    }
    if (!reason) {
      found.reason = "Say why the price changed. A total that moves with no reason reads as a mistake.";
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
    const ok = await onSave({ oldTotal, newTotal: next, difference, reason });
    setSaving(false);
    if (ok !== false) handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>Fix the price on order #{order?.id}</DialogTitle>
            <DialogDescription>
              The old price is kept. Nothing here overwrites what {order?.customerName} was
              originally told — it is recorded alongside it, with your name on it.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="flex flex-col gap-5.5">
            {/* The two figures side by side, because the whole question is how
                they differ and a single input hides the number being replaced. */}
            <div className="rounded-field bg-paper-2 p-4.5">
              <dl className="flex flex-col gap-2.5">
                <div className="flex items-baseline justify-between gap-6">
                  <dt className="text-[15.5px] text-muted">What they were told</dt>
                  <dd className="text-[17px] font-bold tabular-nums text-ink">
                    {formatPeso(oldTotal)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-6">
                  <dt className="text-[15.5px] text-muted">What it should be</dt>
                  <dd className="text-[17px] font-bold tabular-nums text-ink">
                    {formatPeso(next)}
                  </dd>
                </div>
              </dl>
            </div>

            <Field
              label="What it should be"
              required
              error={errors.newTotal}
              hint="The whole order, in pesos — not the difference."
            >
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={newTotal}
                  onChange={(event) => {
                    setNewTotal(event.target.value);
                    setErrors((previous) => ({ ...previous, newTotal: undefined }));
                  }}
                />
              )}
            </Field>

            {undercharged && (
              <Callout
                tone="amber"
                icon={<Info />}
                title={`${formatPeso(difference)} more than they were told`}
              >
                Their balance goes up by this much. Print the order after saving and send
                it over, so the new figure comes from you rather than from a surprise at
                the door.
              </Callout>
            )}

            {overcharged && (
              <Callout
                tone="cobalt"
                icon={<Info />}
                title={`${formatPeso(Math.abs(difference))} too much was charged`}
              >
                Saving this lowers what they owe. If they have already paid the old
                figure, give the difference back from this order afterwards — that is the
                Give money back button, and it records where the money went.
              </Callout>
            )}

            <Field label="Why" required error={errors.reason}>
              <RadioCards
                label="Why the price changed"
                options={PRICE_REASON_OPTIONS}
                value={reason}
                onChange={(nextReason) => {
                  setReason(nextReason);
                  setErrors((previous) => ({ ...previous, reason: undefined }));
                }}
              />
            </Field>
          </DialogBody>

          <DialogFooter className="justify-between">
            <Button
              variant="outline"
              size="lg"
              disabled={saving}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="cobalt" size="lg" disabled={saving}>
              <Tag className="h-5 w-5" />
              {saving ? "Saving…" : "Save the new price"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
