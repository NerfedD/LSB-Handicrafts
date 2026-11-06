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
import { Input, Textarea } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Callout from "../shared/Callout";
import FormError from "../shared/FormError";
import { Field, RadioCards } from "../shared/forms";
import { DISPOSITION_OPTIONS, REPLACEMENT_REASON_OPTIONS } from "../../utils/copy";
import { committedOf, stockLines } from "../../utils/stockLedger";

const asUnits = (value) => (/^\d{1,9}$/.test(String(value).trim()) ? Number(value) : null);

/**
 * Replacing goods that came back, instead of giving the money back.
 *
 * WHAT MOVES. The goods that came back go on the shelf only if they can be sold
 * again; the replacement leaves the shelf once. The order's total, what was
 * paid and its status do not change -- the customer still has what they paid
 * for. The database works this out from the saved order (order_command
 * 'replace'), so the count here is a request, not the arithmetic.
 *
 * HOW MUCH. Only what the customer actually received on a line can come back,
 * less whatever has already been replaced on it, so lines with nothing left to
 * replace are not offered. The database works the same sum out from the saved
 * order and refuses anything above it; this is the courtesy copy, and the two
 * must agree.
 */
export default function ReplacementDialog({ open, onOpenChange, order, inventory = [], onSave }) {
  const lines = useMemo(
    () => {
      const replaced = new Map();
      for (const entry of order?.replacementHistory ?? []) {
        const at = Number(entry?.lineIndex);
        if (Number.isInteger(at)) replaced.set(at, (replaced.get(at) ?? 0) + (Number(entry?.quantity) || 0));
      }
      return stockLines(order)
        .map((line, index) => ({
          ...line,
          index,
          held: Math.max(0, committedOf(line) - (replaced.get(index) ?? 0)),
        }))
        .filter((line) => line.held > 0);
    },
    [order]
  );
  const shelf = useMemo(
    () => [...inventory].sort((a, b) => String(a.name).localeCompare(String(b.name))),
    [inventory]
  );

  const [lineIndex, setLineIndex] = useState(null);
  const [quantity, setQuantity] = useState("");
  const [disposition, setDisposition] = useState("");
  const [reason, setReason] = useState("");
  const [replacementId, setReplacementId] = useState(null);
  const [replacementQuantity, setReplacementQuantity] = useState("");
  const [note, setNote] = useState("");
  // The server's answer, in the banner; everything else is beside its field.
  const [error, setError] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const line = lines.find((one) => one.index === lineIndex) ?? (lines.length === 1 ? lines[0] : null);
  const chosenId = replacementId ?? (line?.productId != null ? String(line.productId) : "");
  const replacement = shelf.find((row) => String(row.id) === chosenId);
  const count = asUnits(quantity);
  const outCount = replacementQuantity === "" ? count : asUnits(replacementQuantity);

  // Closing by any route (Keep it, Esc, a click outside) puts the form back as
  // it opened: the dialog stays mounted on the order screen, so without this the
  // last attempt's numbers and error were waiting the next time it opened.
  function reset() {
    setLineIndex(null);
    setQuantity("");
    setDisposition("");
    setReason("");
    setReplacementId(null);
    setReplacementQuantity("");
    setNote("");
    setError(null);
    setErrors({});
  }

  function close(next) {
    if (saving) return;
    if (!next) reset();
    onOpenChange?.(next);
  }

  /** Clears one field's complaint as soon as it is touched. */
  const touch = (key) => setErrors((previous) => ({ ...previous, [key]: undefined }));

  async function handleSubmit(event) {
    event.preventDefault();
    const found = {};
    if (!line) found.line = "Choose which line came back.";
    if (count === null || count < 1) found.quantity = "Enter how many came back, as a whole number.";
    else if (line && count > line.held) found.quantity = `Only ${line.held} of ${line.name} reached the customer.`;
    if (!disposition) found.disposition = "Say whether what came back can be sold again.";
    if (!reason) found.reason = "Choose why it came back.";
    if (!replacement) found.replacement = "Choose what goes out as the replacement.";
    if (replacement && (outCount === null || outCount < 1)) {
      found.replacementQuantity = "Enter how many go out as the replacement, as a whole number.";
    } else if (replacement && outCount > replacement.stock) {
      found.replacementQuantity = `Only ${replacement.stock} of ${replacement.name} on the shelf.`;
    }
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setError(null);
      return;
    }
    setSaving(true);
    setError(null);
    setErrors({});
    const result = await onSave({
      lineIndex: line.index,
      quantity: count,
      disposition,
      reason,
      replacementProductId: replacement.id,
      replacementQuantity: outCount,
      note: note.trim() || undefined,
    });
    setSaving(false);
    if (result?.ok) {
      reset();
      onOpenChange?.(false);
    }
    else setError(result?.message || "The replacement was not recorded. Check the details and try again.");
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>Replace goods on order #{order?.id}</DialogTitle>
            <DialogDescription>
              For goods that came back broken or wrong, when the customer wants them replaced
              rather than their money back. No money moves.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="flex flex-col gap-3.5">
            <FormError message={error} />

            {lines.length === 0 ? (
              <Callout tone="amber" title="Nothing on this order has reached the customer yet">
                Only goods that went out can come back to be replaced.
              </Callout>
            ) : (
              <>
                {lines.length > 1 && (
                  <Field label="Which line came back" required error={errors.line}>
                    {(props) => (
                      <Select items={lines.map((one) => ({ value: String(one.index), label: `${one.name} — ${one.held} delivered` }))} value={line ? String(line.index) : ""} onValueChange={(next) => { setLineIndex(Number(next)); touch("line"); }}>
                        <SelectTrigger id={props.id}>
                          <SelectValue placeholder="Pick a line" />
                        </SelectTrigger>
                        <SelectContent>
                          {lines.map((one) => (
                            <SelectItem key={one.index} value={String(one.index)}>
                              {one.name} — {one.held} delivered
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </Field>
                )}

                <Field
                  label={line ? `How many ${line.name} came back` : "How many came back"}
                  required
                  error={errors.quantity}
                  hint={line ? `Up to ${line.held}, the number the customer received.` : undefined}
                >
                  {(props) => (
                    <Input {...props} type="number" inputMode="numeric" min={1} max={line?.held}
                      value={quantity} onChange={(event) => { setQuantity(event.target.value); touch("quantity"); }} placeholder="0" />
                  )}
                </Field>

                <Field label="Can what came back be sold again?" required error={errors.disposition}>
                  <RadioCards label="What happens to what came back" options={DISPOSITION_OPTIONS}
                    value={disposition} onChange={(next) => { setDisposition(next); touch("disposition"); }} />
                </Field>

                <Field label="Why it came back" required error={errors.reason}>
                  <RadioCards label="Why it came back" options={REPLACEMENT_REASON_OPTIONS} value={reason} onChange={(next) => { setReason(next); touch("reason"); }} />
                </Field>

                <Field label="What goes out instead" required error={errors.replacement} hint="Usually the same product. Pick another if that is what was agreed.">
                  {(props) => (
                    <Select items={shelf.map((row) => ({ value: String(row.id), label: `${row.name} — ${row.stock} on the shelf` }))} value={chosenId} onValueChange={(next) => { setReplacementId(next); touch("replacement"); }}>
                      <SelectTrigger id={props.id}>
                        <SelectValue placeholder="Pick a product" />
                      </SelectTrigger>
                      <SelectContent>
                        {shelf.map((row) => (
                          <SelectItem key={row.id} value={String(row.id)}>
                            {row.name} — {row.stock} on the shelf
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </Field>

                <Field label="How many go out" error={errors.replacementQuantity} hint="Leave it as the number that came back unless something else was agreed.">
                  {(props) => (
                    <Input {...props} type="number" inputMode="numeric" min={1}
                      value={replacementQuantity === "" && count !== null ? String(count) : replacementQuantity}
                      onChange={(event) => { setReplacementQuantity(event.target.value); touch("replacementQuantity"); }} placeholder="0" />
                  )}
                </Field>

                <Field label="Note" hint="Optional: anything the next person should know.">
                  {(props) => (
                    <Textarea {...props} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
                  )}
                </Field>
              </>
            )}
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => close(false)}>
              Keep it
            </Button>
            <Button type="submit" disabled={saving || lines.length === 0}>
              {saving ? "Working…" : "Record the replacement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
