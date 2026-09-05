import { useState } from "react";

import { Building2, UserRound } from "../icons";
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
import { ChoiceButtons, Field } from "../shared/forms";

/**
 * Add or edit a customer.
 *
 * A DIALOG, unlike the product form. Four fields over the list you are adding
 * to, because customers are usually added several at a time, at a counter,
 * mid-conversation — and a round trip through a full screen for each one is
 * friction where the product form's screen is a considered decision.
 *
 * A SINGLE COLUMN INSIDE IT, still. Rule 5 does not stop applying because the
 * form is in a modal; a two-column grid in a 560px dialog is just a wall with
 * less room.
 *
 * On success the dialog closes and App raises a toast carrying a "View" action,
 * which is what replaced the full success panel this screen used to show — an
 * extra screen to dismiss after every save.
 */

const EMPTY = { name: "", kind: "walk-in", contactNumber: "", email: "", address: "" };

const KINDS = [
  { value: "walk-in", label: "Walk-in", icon: <UserRound className="h-5 w-5" /> },
  { value: "business", label: "Business", icon: <Building2 className="h-5 w-5" /> },
];

function validate(values) {
  const errors = {};
  if (!values.name.trim()) errors.name = "We need a name to file them under.";
  if (!values.contactNumber.trim()) {
    errors.contactNumber = "A phone number is how anyone reaches them later.";
  }
  // Email is optional, but a typo in one that WAS filled in is still an error —
  // an address that bounces is worse than no address, because nobody finds out.
  if (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = "That does not look like an email address. Check for a missing @ or dot.";
  }
  return errors;
}

const seed = (customer, isEdit) =>
  isEdit && customer
    ? {
        name: customer.name ?? "",
        kind: customer.kind ?? "walk-in",
        contactNumber: customer.contactNumber ?? "",
        email: customer.email ?? "",
        address: customer.address ?? "",
      }
    : EMPTY;

export default function CustomerFormDialog({
  open,
  onOpenChange,
  mode = "add",
  customer,
  onSave,
}) {
  const isEdit = mode === "edit";
  const [values, setValues] = useState(() => seed(customer, isEdit));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  function setField(field, value) {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => (previous[field] ? { ...previous, [field]: undefined } : previous));
  }

  // A dialog stays mounted between opens, so add -> add -> add would otherwise
  // show the previous entry. App also keys on the record id; this covers the
  // case where the key does not change.
  function handleOpenChange(next) {
    if (saving) return;
    if (!next) {
      setValues(seed(customer, isEdit));
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
    // onSave resolves to null when the database rejected the write, and a toast
    // has already said why. Staying open keeps what they typed instead of
    // closing over a record that was never stored.
    if (id !== null && id !== undefined) handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit this customer" : "Add a customer"}</DialogTitle>
            <DialogDescription>
              The name and a phone number are all we really need. Everything else can be
              filled in later.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="flex flex-col gap-5.5">
            <Field label="Their name" required error={errors.name}>
              {(props) => (
                <Input
                  {...props}
                  value={values.name}
                  onChange={(event) => setField("name", event.target.value)}
                  placeholder="Ana Reyes, or Reyes Events"
                />
              )}
            </Field>

            <Field
              label="What kind of customer"
              hint="Businesses get grouped together so sales staff can plan calls."
            >
              <ChoiceButtons
                label="What kind of customer"
                options={KINDS}
                value={values.kind}
                onChange={(next) => setField("kind", next)}
              />
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
                  placeholder="12 Mabini St, Poblacion, Davao City"
                />
              )}
            </Field>
          </DialogBody>

          <DialogFooter className="justify-between">
            <Button variant="outline" size="lg" disabled={saving} onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="cobalt" size="lg" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Save the changes" : "Add this customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
