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
import { cleanPhoneInput, phoneDoubt, phoneProblem } from "../../utils/phone";

/**
 * Add or edit a supplier.
 *
 * The same shape as the customer dialog, one field wider — see the note there
 * on why these are modals while the product form is a screen.
 *
 * "Who do you ask for" rather than "Contact person": the supplier list's second
 * line reads "Ask for Ramon", and a field labelled the way its output reads is
 * a field people fill in correctly.
 *
 * A REPEATED NAME IS A QUESTION, NOT A REFUSAL — the same treatment as the
 * customer dialog, for the same reason. Two branches of one supplier can share
 * a name, so there is no unique constraint and there should not be one; but a
 * second "Davao Foam Supply" is far more likely to be somebody adding a record
 * that already exists, and a duplicate leaves two phone numbers where one is
 * out of date and nobody knows which. So the first submit asks once.
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
  } else {
    // Only what cannot be a phone number at all — see utils/phone. A supplier
    // is the likeliest record in the system to hold a number in a shape nobody
    // here expected, which is exactly why this refuses so little.
    const problem = phoneProblem(values.contactNumber);
    if (problem) errors.contactNumber = problem;
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

/** Anybody else already filed under this name, case- and space-insensitively. */
const nameTwin = (name, suppliers, ownId) => {
  const wanted = String(name || "").trim().toLowerCase();
  if (!wanted) return null;
  return (
    suppliers.find(
      (one) => one.id !== ownId && String(one.name || "").trim().toLowerCase() === wanted
    ) ?? null
  );
};

export default function SupplierFormDialog({
  open,
  onOpenChange,
  mode = "add",
  supplier,
  suppliers = [],
  onSave,
}) {
  const isEdit = mode === "edit";
  const [values, setValues] = useState(() => seed(supplier, isEdit));
  const [errors, setErrors] = useState({});
  // Asked once per field, cleared when that field is edited — see the customer
  // dialog for the full reasoning.
  const [warnings, setWarnings] = useState({});
  const [asked, setAsked] = useState({});
  const [saving, setSaving] = useState(false);

  function setField(field, value) {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => (previous[field] ? { ...previous, [field]: undefined } : previous));
    setWarnings((previous) => (previous[field] ? { ...previous, [field]: undefined } : previous));
    setAsked((previous) => (previous[field] ? { ...previous, [field]: false } : previous));
  }

  /** Everything worth asking about, as field -> question. */
  function doubts(next) {
    const raised = {};
    const twin = nameTwin(next.name, suppliers, supplier?.id);
    if (twin) {
      raised.name = `There is already a supplier called ${twin.name}${
        twin.contactNumber ? ` on ${twin.contactNumber}` : ""
      }. Add this one anyway?`;
    }
    const doubt = phoneDoubt(next.contactNumber);
    if (doubt) raised.contactNumber = doubt;
    return raised;
  }

  function handleOpenChange(next) {
    if (saving) return;
    if (!next) {
      setValues(seed(supplier, isEdit));
      setErrors({});
      setWarnings({});
      setAsked({});
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

    const raised = doubts(values);
    const unanswered = Object.keys(raised).filter((field) => !asked[field]);
    setWarnings(raised);
    if (unanswered.length > 0) {
      setAsked((previous) => ({
        ...previous,
        ...Object.fromEntries(unanswered.map((field) => [field, true])),
      }));
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
            <Field label="Supplier name" required error={errors.name} warning={warnings.name}>
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

            <Field
              label="Phone number"
              required
              error={errors.contactNumber}
              warning={warnings.contactNumber}
            >
              {(props) => (
                <Input
                  {...props}
                  inputMode="tel"
                  value={values.contactNumber}
                  onChange={(event) => setField("contactNumber", cleanPhoneInput(event.target.value))}
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
              {saving
                ? "Saving…"
                : Object.keys(warnings).some((field) => warnings[field])
                  ? isEdit
                    ? "Save it anyway"
                    : "Add them anyway"
                  : isEdit
                    ? "Save the changes"
                    : "Add this supplier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
