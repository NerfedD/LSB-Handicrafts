import { useMemo, useState } from "react";

import { Hammer, TriangleAlert } from "../icons";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Callout from "../shared/Callout";
import { Field } from "../shared/forms";
import { shelfItems } from "../../utils/productStock";
import { stockLabel } from "../../utils/copy";

/**
 * Record what we made.
 *
 * The production dashboard's primary action, and the only way stock goes UP in
 * this system — everything else moves it down by selling it. Without this the
 * make list is a list of complaints nobody can close.
 *
 * TWO QUESTIONS AND NOTHING ELSE: which product, and how many. A production
 * worker recording a morning's output should not have to think about item
 * codes, warn levels or units; the dialog shows the shelf count before and
 * after so the number they typed can be checked against the shelf in front of
 * them.
 *
 * It writes an activity entry as well as the new count, which is what makes the
 * product's "Stock movements" table real rather than decorative.
 */
export default function RecordMadeDialog({
  open,
  onOpenChange,
  products = [],
  inventory = [],
  orders = [],
  /** Pre-selected when opened from a product's own screen. */
  productId,
  onSave,
}) {
  const shelf = useMemo(
    () => shelfItems(products, inventory, orders),
    [products, inventory, orders]
  );
  const [selected, setSelected] = useState(productId ? String(productId) : "");
  const [made, setMade] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const match = shelf.find(({ product }) => String(product.id) === selected);
  const count = Number(made);
  const valid = match?.stock.tracked && Number.isFinite(count) && count > 0;

  function handleOpenChange(next) {
    if (saving) return;
    if (!next) {
      setSelected(productId ? String(productId) : "");
      setMade("");
      setError(null);
    }
    onOpenChange?.(next);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!selected) {
      setError("Pick which product was made.");
      return;
    }
    if (!match?.stock.tracked) {
      setError(
        "Nobody is counting this product yet, so there is nothing to add to. Set a shelf count on the product first."
      );
      return;
    }
    if (!valid) {
      setError("Put in how many were made. It has to be more than zero.");
      return;
    }

    setSaving(true);
    const ok = await onSave({ product: match.product, made: count });
    setSaving(false);
    if (ok !== false) handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[520px]">
        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>Record what we made</DialogTitle>
            <DialogDescription>
              This adds to the shelf count so everyone sees the same number.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="flex flex-col gap-5.5">
            {error && (
              <Callout tone="red" icon={<TriangleAlert />} title="Not recorded.">
                {error}
              </Callout>
            )}

            <Field label="What did you make" required>
              {(props) => (
                <Select value={selected} onValueChange={setSelected}>
                  <SelectTrigger id={props.id}>
                    <SelectValue placeholder="Pick a product" />
                  </SelectTrigger>
                  <SelectContent>
                    {shelf.map(({ product, stock }) => (
                      <SelectItem key={product.id} value={String(product.id)}>
                        {product.name}
                        {stock.tracked ? ` — ${stock.onHand} on the shelf` : " — not counted"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>

            <Field label="How many did you make" required hint="Count what you finished today.">
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  value={made}
                  onChange={(event) => setMade(event.target.value)}
                  placeholder="0"
                />
              )}
            </Field>

            {/* Before and after, so the number typed can be checked against the
                shelf standing in front of them. */}
            {match?.stock.tracked && (
              <div className="rounded-field bg-paper-2 p-4">
                <p className="text-[15px] text-muted">
                  On the shelf now:{" "}
                  <strong className="font-bold text-ink tabular-nums">
                    {match.stock.onHand}
                  </strong>{" "}
                  — {stockLabel(match.stock.status).toLowerCase()}
                </p>
                {valid && (
                  <p className="pt-1.5 text-[16px] font-bold text-green dark:text-dk-green">
                    After this: {match.stock.onHand + count} on the shelf
                  </p>
                )}
              </div>
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
            <Button type="submit" variant="clay" size="lg" disabled={saving}>
              <Hammer className="h-5 w-5" />
              {saving ? "Recording…" : "Record it"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
