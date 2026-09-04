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
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "../shared/forms";

/**
 * Add or edit a supplier.
 *
 * The same shape as the customer dialog, one field wider — see the note there
 * on why these are modals while the product form is a screen.
 *
 * "Who do you ask for" rather than "Contact person": the supplier list's second
 * line reads "Ask for Ramon", and a field labelled the way its output reads is
 * a field people fill in correctly.
 */

const EMPTY = {
  name: "",
  contactPerson: "",
  contactNumber: "",
  email: "",
  address: "",
};

function validate(values) {
  const errors = {};
  if (!values.name.trim()) errors.name = "We need the supplier's name.";
  if (!values.contactNumber.trim()) {
    errors.contactNumber = "A phone number is the whole reason to have this record.";
  }
  if (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = "That does not look like an email address. Check for a missing @ or dot.";
  }
  return errors;
}

const seed = (supplier, isEdit) =>
  isEdit && supplier
    ? {
        name: supplier.name ?? "",
        contactPerson: supplier.contactPerson ?? "",
        contactNumber: supplier.contactNumber ?? "",
        email: supplier.email ?? "",
        address: supplier.address ?? "",
      }
    : EMPTY;

export default function SupplierFormDialog({
  open,
  onOpenChange,
  mode = "add",
  supplier,
  onSave,
}) {
  const isEdit = mode === "edit";
  const [values, setValues] = useState(() => seed(supplier, isEdit));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  function setField(field, value) {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => (previous[field] ? { ...previous, [field]: undefined } : previous));
  }

  function handleOpenChange(next) {
    if (saving) return;
    if (!next) {
      setValues(seed(supplier, isEdit));
      setErrors({});
    }
    onOpenChange?.(next);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const found = validate(values);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setSaving(true);
    const id = await onSave(values);
    setSaving(false);
    if (id !== null && id !== undefined) handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit this supplier" : "Add a supplier"}</DialogTitle>
            <DialogDescription>
              So anyone can find their number without having to ask around.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="flex flex-col gap-5.5">
            <Field label="Supplier name" required error={errors.name}>
              {(props) => (
                <Input
                  {...props}
                  value={values.name}
                  onChange={(event) => setField("name", event.target.value)}
                  placeholder="Davao Foam Supply"
                />
              )}
            </Field>

            <Field label="Who do you ask for" hint="The person who picks up the phone.">
              {(props) => (
                <Input
                  {...props}
                  value={values.contactPerson}
                  onChange={(event) => setField("contactPerson", event.target.value)}
                  placeholder="Ramon"
                />
              )}
            </Field>

            <Field label="Phone number" required error={errors.contactNumber}>
              {(props) => (
                <Input
                  {...props}
                  inputMode="tel"
                  value={values.contactNumber}
                  onChange={(event) => setField("contactNumber", event.target.value)}
                  placeholder="09XX XXX XXXX"
                />
              )}
            </Field>

            <Field label="Email address" error={errors.email} hint="Only if they have one.">
              {(props) => (
                <Input
                  {...props}
                  type="email"
                  value={values.email}
                  onChange={(event) => setField("email", event.target.value)}
                  placeholder="them@example.com"
                />
              )}
            </Field>

            <Field
              label="Where they are"
              hint="Put the district or city last — it is what the area filter reads."
            >
              {(props) => (
                <Textarea
                  {...props}
                  value={values.address}
                  onChange={(event) => setField("address", event.target.value)}
                  placeholder="Km 7, Lanang, Davao City"
                />
              )}
            </Field>
          </DialogBody>

          <DialogFooter className="justify-between">
            <Button variant="outline" size="lg" disabled={saving} onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="clay" size="lg" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Save the changes" : "Add this supplier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
