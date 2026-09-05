import { useMemo, useState } from "react";

import { PackageOpen, Truck } from "../icons";
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
import { Field } from "../shared/forms";
import { DELIVERY_STAGE } from "../../utils/constants";
import { deliveryStage } from "../../utils/copy";
import { normalizeItems } from "../../utils/orderItems";
import { committedOf, orderedOf, outstandingOf, voidedOf } from "../../utils/stockLedger";

/**
 * What actually went on the van.
 *
 * THE REASON THIS EXISTS. Advancing a delivery used to be one green button, and
 * that button assumed the whole order went. It usually does. When it does not —
 * the van was full, the customer only wanted half of it today, somebody in the
 * yard missed a bundle — the old flow had no way to say so, so the shelf was
 * told the goods had gone and the customer had no record of being owed the
 * rest. Both of those are quiet failures, which is the kind this system was
 * rebuilt to eliminate.
 *
 * PRE-FILLED WITH "ALL OF IT", because all of it is what usually happens and a
 * dialog that makes somebody retype the expected answer is a dialog they will
 * learn to click through. Change a number only when a number changed.
 *
 * IT SAYS WHAT WILL HAPPEN BEFORE IT HAPPENS. The moment a figure drops below
 * what was ordered, the amber block appears and names the consequence — a
 * second delivery will be raised, and the shelf will only be charged for what
 * left. Nobody should discover that after pressing the button.
 *
 * COUNTED IN STOCK UNITS, which for most lines is simply how many were ordered.
 * A cut-to-size line is the exception: twelve pieces come off three sheets, and
 * three sheets is what the shelf loses, so three is what this asks about and
 * the hint says so. Asking in pieces and dividing would invent a half-sheet
 * that does not exist.
 */

const asUnits = (value) => Math.max(0, Math.trunc(Number(value) || 0));

/** Every line, with what is still owed on it and what it may be asked for. */
function manifestFor(order) {
  return normalizeItems(order?.items).map((line, index) => {
    const ordered = orderedOf(line);
    const committed = committedOf(line);
    const voided = voidedOf(line);
    return {
      index,
      productId: line.productId ?? null,
      name: line.name,
      quantity: line.quantity,
      ordered,
      committed,
      voided,
      owed: outstandingOf(line),
      // A carved shape draws no catalog stock, so there is nothing here for the
      // shelf to be short of. It still appears, so the manifest is a complete
      // list of what was on the order rather than a filtered one.
      tracked: ordered > 0,
      ceiling: Math.max(0, ordered - voided),
    };
  });
}

export default function RecordDeliveredDialog({
  open,
  onOpenChange,
  delivery,
  order,
  toStage = DELIVERY_STAGE.ARRIVED,
  staff = [],
  onSave,
}) {
  const lines = useMemo(() => manifestFor(order), [order]);

  // Seeded with everything that is still owed plus whatever already went, i.e.
  // "all of it" expressed as a running total rather than as this trip alone.
  const [went, setWent] = useState(() =>
    Object.fromEntries(lines.map((line) => [line.index, String(line.ceiling)]))
  );
  const [driver, setDriver] = useState(delivery?.driver ?? "");
  const [dueOn, setDueOn] = useState("");
  const [saving, setSaving] = useState(false);

  const stage = deliveryStage(toStage);

  const shortfall = lines
    .map((line) => ({
      ...line,
      going: Math.min(asUnits(went[line.index]), line.ceiling),
    }))
    .filter((line) => line.tracked && line.going < line.ceiling);

  const isShort = shortfall.length > 0;

  function setLine(index, value) {
    setWent((previous) => ({ ...previous, [index]: value }));
  }

  function reset() {
    setWent(Object.fromEntries(lines.map((line) => [line.index, String(line.ceiling)])));
    setDriver(delivery?.driver ?? "");
    setDueOn("");
  }

  function handleOpenChange(next) {
    if (saving) return;
    if (!next) reset();
    onOpenChange?.(next);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    const ok = await onSave({
      toStage,
      // The ledger counts a RUNNING TOTAL per line, not this trip's amount, so
      // that re-submitting the same manifest deducts nothing the second time.
      // See commitPartialDelivery.
      delivered: lines
        .filter((line) => line.tracked)
        .map((line) => ({
          lineIndex: line.index,
          units: Math.min(asUnits(went[line.index]), line.ceiling),
        })),
      manifest: lines.map((line) => ({
        productId: line.productId ?? null,
        name: line.name,
        orderedQty: line.ordered,
        deliveredQty: Math.min(asUnits(went[line.index]), line.ceiling),
        backorderQty: Math.max(
          0,
          line.ceiling - Math.min(asUnits(went[line.index]), line.ceiling)
        ),
      })),
      followUp: isShort ? { driver: driver.trim(), dueOn } : null,
    });
    setSaving(false);
    if (ok !== false) handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>What actually went out?</DialogTitle>
            <DialogDescription>
              This is what comes off the shelf, so it needs to match what was really
              loaded. If everything went, leave the numbers as they are.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="flex flex-col gap-5.5">
            {lines.length === 0 ? (
              <p className="text-[16px] text-muted">
                There is nothing on this order to load, so there is nothing to count.
              </p>
            ) : (
              lines.map((line) =>
                line.tracked ? (
                  <Field
                    key={line.index}
                    label={line.name}
                    hint={
                      line.quantity !== line.ordered
                        ? `${line.ordered} off the shelf, cut into ${line.quantity} pieces. Count what left the shelf.`
                        : line.committed > 0
                          ? `${line.ordered} on the order, ${line.committed} already gone.`
                          : `${line.ordered} on the order.`
                    }
                  >
                    {(props) => (
                      <Input
                        {...props}
                        type="number"
                        inputMode="numeric"
                        min={line.committed}
                        max={line.ceiling}
                        value={went[line.index] ?? ""}
                        onChange={(event) => setLine(line.index, event.target.value)}
                      />
                    )}
                  </Field>
                ) : (
                  <Field
                    key={line.index}
                    label={line.name}
                    hint="A made-to-order piece. It is not counted on the shelf, so there is no number to record here."
                  >
                    <p className="text-[16px] font-bold text-muted">
                      {line.quantity} on the order
                    </p>
                  </Field>
                )
              )
            )}

            {isShort && (
              <Callout
                tone="amber"
                icon={<PackageOpen />}
                title="Some of this is being left behind"
              >
                {shortfall.map((line) => (
                  <span key={line.index} className="block">
                    <strong className="font-bold text-ink">
                      {line.ceiling - line.going} × {line.name}
                    </strong>{" "}
                    still owed.
                  </span>
                ))}
                <span className="block pt-2">
                  A second delivery will be raised for the rest, and only what actually
                  went out comes off the shelf. The order stays open until it arrives.
                </span>
              </Callout>
            )}

            {isShort && (
              <>
                <Field
                  label="Who takes the rest"
                  hint="Leave it empty if that is not decided yet — it shows on the board as needing somebody."
                >
                  {(props) => (
                    <>
                      <Input
                        {...props}
                        list="record-delivered-drivers"
                        value={driver}
                        onChange={(event) => setDriver(event.target.value)}
                        placeholder="Their name"
                      />
                      <datalist id="record-delivered-drivers">
                        {staff.map((person) => (
                          <option key={person.id} value={person.name} />
                        ))}
                      </datalist>
                    </>
                  )}
                </Field>

                <Field
                  label="When it should get there"
                  hint="A promised day. Without one it never shows under Late or Due today."
                >
                  {(props) => (
                    <Input
                      {...props}
                      type="date"
                      value={dueOn}
                      onChange={(event) => setDueOn(event.target.value)}
                    />
                  )}
                </Field>
              </>
            )}
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
            <Button type="submit" variant="green" size="lg" disabled={saving}>
              <Truck className="h-5 w-5" />
              {saving
                ? "Recording…"
                : isShort
                  ? "Record what went, and raise the rest"
                  : `Yes, it is ${stage.label.toLowerCase()}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
