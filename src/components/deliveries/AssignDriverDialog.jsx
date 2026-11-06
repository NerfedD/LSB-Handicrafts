import { useState } from "react";

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
import { Field } from "../shared/forms";
import { nameProblem } from "../../utils/validation";

/**
 * Assign someone to a delivery.
 *
 * A NAME, NOT A PICKER. Deliveries are sometimes taken by somebody without a
 * system account — an owner, a hired van — and a dropdown restricted to staff
 * would make those undeliverable, which staff would work around by writing the
 * name into the address. The staff list is offered as suggestions instead, so
 * the common case is one click and the uncommon one is still possible.
 *
 * Clearing the field is a real action: "nobody yet" is a state the board has a
 * chip for, and taking somebody off a delivery has to be as easy as putting
 * them on it.
 */
export default function AssignDriverDialog({
  open,
  onOpenChange,
  delivery,
  staff = [],
  onSave,
}) {
  const [driver, setDriver] = useState(delivery?.driver ?? "");
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState(null);

  function handleOpenChange(next) {
    if (saving) return;
    if (!next) {
      setDriver(delivery?.driver ?? "");
      setProblem(null);
    }
    onOpenChange?.(next);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    // Empty is a real answer ("nobody yet"); anything typed must fit a name.
    const tooLong = driver.trim() ? nameProblem(driver, { label: "The name", max: 120 }) : null;
    setProblem(tooLong);
    if (tooLong) return;
    setSaving(true);
    const ok = await onSave(driver.trim());
    setSaving(false);
    if (ok !== false) handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>{delivery ? `Driver for delivery #${delivery.id}` : "Assign driver"}</DialogTitle>
            <DialogDescription>
              It shows on the board so nobody has to ask. It can be changed later.
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <Field
              label="Driver"
              error={problem}
              hint="Anyone can be named here — they do not need an account in the system."
            >
              {(props) => (
                <>
                  <Input
                    {...props}
                    list="delivery-drivers"
                    value={driver}
                    onChange={(event) => {
                      setDriver(event.target.value);
                      setProblem(null);
                    }}
                    placeholder="Leave empty for nobody yet"
                  />
                  <datalist id="delivery-drivers">
                    {staff.map((person) => (
                      <option key={person.id} value={person.name} />
                    ))}
                  </datalist>
                </>
              )}
            </Field>
          </DialogBody>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : driver.trim() ? "Assign driver" : "Leave it unassigned"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
