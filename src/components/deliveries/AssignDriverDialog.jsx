import { useState } from "react";

import { UserRound } from "../icons";
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

  function handleOpenChange(next) {
    if (saving) return;
    if (!next) setDriver(delivery?.driver ?? "");
    onOpenChange?.(next);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    const ok = await onSave(driver.trim());
    setSaving(false);
    if (ok !== false) handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[480px]">
        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>Who is taking this one out?</DialogTitle>
            <DialogDescription>
              It shows on the board so nobody has to ask, and it can be changed later.
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <Field
              label="Their name"
              hint="Anyone can be named here — they do not need an account in the system."
            >
              {(props) => (
                <>
                  <Input
                    {...props}
                    list="delivery-drivers"
                    value={driver}
                    onChange={(event) => setDriver(event.target.value)}
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
              <UserRound className="h-5 w-5" />
              {saving ? "Saving…" : driver.trim() ? "Give it to them" : "Leave it unassigned"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
