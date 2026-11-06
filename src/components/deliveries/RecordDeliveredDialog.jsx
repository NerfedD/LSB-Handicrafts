import { useMemo, useState } from "react";
import { localDateIso, promisedDateProblem } from "../../utils/dates";

import { Package } from "../icons";
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
import { Field, RadioRow, Row } from "../shared/forms";
import { DELIVERY_STAGE } from "../../utils/constants";
import { deliveryStage } from "../../utils/copy";
import { customerFrom } from "../../utils/deliveries";
import { countProblem } from "../../utils/validation";
import { committedOf, orderedOf, outstandingOf, stockLines } from "../../utils/stockLedger";

/**
 * What actually went on the van, drawn to the "Mark delivered · Dialog" board:
 * the delivery and its customer, "did everything go?" with "all of it"
 * chosen, and the per-line counts only once somebody says some did not.
 * The board's "Received by", time and proof photo are left out: the app has
 * nowhere to keep them.
 *
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

/**
 * What was typed, as a count -- or null when it is not a whole number. A bad
 * entry is refused beside its box (see countProblem); it used to be clamped
 * into range, so 999 quietly became "everything", a blank or -5 became 0 and
 * raised a back-order nobody asked for, and 1.5 became 1.
 */
const asUnits = (value) => (/^\d{1,10}$/.test(String(value ?? "").trim()) ? Number(value) : null);

/** Every line, with what is still owed on it and what it may be asked for. */
function manifestFor(order) {
  return stockLines(order).map((line, index) => {
    const ordered = orderedOf(line);
    const committed = committedOf(line);
    return {
      index,
      productId: line.productId ?? null,
      name: line.name,
      quantity: line.quantity,
      ordered,
      committed,
      owed: outstandingOf(line),
      // A carved shape draws no catalog stock, so there is nothing here for the
      // shelf to be short of. It still appears, so the manifest is a complete
      // list of what was on the order rather than a filtered one.
      tracked: ordered > 0,
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

  // The person loading the van counts this trip; the ledger receives a total.
  const [went, setWent] = useState(() =>
    Object.fromEntries(lines.map((line) => [line.index, String(line.owed)]))
  );
  const [driver, setDriver] = useState(delivery?.driver ?? "");
  const [dueOn, setDueOn] = useState("");
  const [saving, setSaving] = useState(false);
  const [some, setSome] = useState(false);

  const stage = deliveryStage(toStage);

  // Each counted line's problem with what was typed, if it has one.
  const problems = Object.fromEntries(
    lines
      .filter((line) => line.tracked)
      .map((line) => [
        line.index,
        countProblem(went[line.index], { min: 0, max: line.owed, label: "The count" }),
      ])
      .filter(([, problem]) => problem)
  );
  const hasProblem = Object.keys(problems).length > 0;

  // How many of a line go on this trip. A line with a bad entry counts as all of
  // it for the preview, so the "left behind" notice never reacts to a typo.
  const goingOf = (line) => {
    const typed = asUnits(went[line.index]);
    return typed === null || typed > line.owed ? line.owed : typed;
  };

  const shortfall = lines
    .map((line) => ({
      ...line,
      going: goingOf(line),
    }))
    .filter((line) => line.tracked && line.going < line.owed);

  const isShort = shortfall.length > 0;

  function setLine(index, value) {
    setWent((previous) => ({ ...previous, [index]: value }));
  }

  function reset() {
    setWent(Object.fromEntries(lines.map((line) => [line.index, String(line.owed)])));
    setDriver(delivery?.driver ?? "");
    setDueOn("");
    setSome(false);
  }

  function handleOpenChange(next) {
    if (saving) return;
    if (!next) reset();
    onOpenChange?.(next);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (hasProblem) return;
    // Checked before anything moves: a past date would be refused only when the
    // second delivery is raised, after the goods had already come off the shelf.
    if (isShort && promisedDateProblem(dueOn)) return;
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
          units: line.committed + goingOf(line),
        })),
      // Manifests retain only what this vehicle carried.
      manifest: lines.map((line) => {
        const going = goingOf(line);
        return {
          productId: line.productId ?? null,
          name: line.name,
          orderedQty: line.ordered,
          deliveredQty: going,
          backorderQty: line.owed - going,
        };
      }),
      followUp: isShort ? { driver: driver.trim(), dueOn } : null,
    });
    setSaving(false);
    if (ok !== false) handleOpenChange(false);
  }

  const arriving = toStage === DELIVERY_STAGE.ARRIVED;
  const itemCount = lines.reduce((n, line) => n + (Number(line.owed) || Number(line.quantity) || 0), 0);
  const customer = customerFrom(delivery);
  const counted = lines.filter((line) => line.tracked);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="md">
        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>
              {delivery?.id
                ? arriving ? `Delivery #${delivery.id} arrived` : `Delivery #${delivery.id} is ${stage.label.toLowerCase()}`
                : "What actually went out?"}
            </DialogTitle>
            <DialogDescription>
              {[customer, `${itemCount} ${itemCount === 1 ? "item" : "items"}`].filter(Boolean).join(" · ")}.
              {" "}What is counted here comes off the shelf.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="flex flex-col gap-3.5">
            {lines.length === 0 ? (
              <p className="m-0 text-13 text-muted-fg">
                There is nothing on this order to load, so there is nothing to count.
              </p>
            ) : (
              <>
                {counted.length > 0 ? (
                  <Field label={arriving ? "Did everything arrive in good shape?" : "Did everything go on the van?"}>
                    <RadioRow
                      label={arriving ? "Did everything arrive in good shape?" : "Did everything go on the van?"}
                      value={some ? "some" : "all"}
                      onChange={(next) => {
                        setSome(next === "some");
                        if (next === "all") setWent(Object.fromEntries(lines.map((line) => [line.index, String(line.owed)])));
                      }}
                      options={[
                        { value: "all", label: `Yes, all ${itemCount} ${itemCount === 1 ? "item" : "items"}` },
                        { value: "some", label: arriving ? "Some were missing or damaged" : "Some were left behind" },
                      ]}
                    />
                  </Field>
                ) : null}

                {some || counted.length === 0 ? (
                  <div className="flex flex-col gap-3.5 rounded-md border border-border p-3">
                    {lines.map((line) =>
                      line.tracked ? (
                        <Field
                          key={line.index}
                          label={line.name}
                          error={problems[line.index]}
                          hint={
                            line.quantity !== line.ordered
                              ? `${line.ordered} off the shelf, cut into ${line.quantity} pieces. Count what left the shelf.`
                              : line.committed > 0
                                ? `${line.committed} already gone, ${line.owed} still owed. Count only this trip.`
                                : `${line.ordered} on the order. Count only this trip.`
                          }
                        >
                          {(props) => (
                            <Input
                              {...props}
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={line.owed}
                              value={went[line.index] ?? ""}
                              onChange={(event) => setLine(line.index, event.target.value)}
                            />
                          )}
                        </Field>
                      ) : (
                        <div key={line.index} className="flex items-baseline justify-between gap-3 text-13">
                          <span className="font-medium">{line.name}</span>
                          <span className="text-muted-fg">{line.quantity} made to order, not counted on the shelf</span>
                        </div>
                      )
                    )}
                  </div>
                ) : null}
              </>
            )}

            {isShort && (
              <Callout tone="amber" icon={<Package />} title="Some of this is being left behind">
                {shortfall.map((line) => (
                  <span key={line.index} className="block">
                    <strong>{line.owed - line.going} × {line.name}</strong> still owed.
                  </span>
                ))}
                <span className="block pt-1">
                  A second delivery is raised for the rest, and only what went out comes off the shelf.
                  Sales can see it, and the order stays open until it arrives.
                </span>
              </Callout>
            )}

            {isShort && (
              <Row>
                <Field
                  label={<>Who takes the rest <span className="font-normal text-muted-fg">(optional)</span></>}
                  hint="Left empty, it shows on the board as needing somebody."
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
                  error={promisedDateProblem(dueOn)}
                  hint="Today or later, so it shows under Late or Due today."
                >
                  {(props) => (
                    <Input
                      {...props}
                      type="date"
                      min={localDateIso()}
                      value={dueOn}
                      onChange={(event) => setDueOn(event.target.value)}
                    />
                  )}
                </Field>
              </Row>
            )}
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => handleOpenChange(false)}>
              Not yet
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? "Recording…"
                : isShort
                  ? "Record what went, and raise the rest"
                  : arriving ? "Mark delivered" : `Mark ${stage.label.toLowerCase()}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
