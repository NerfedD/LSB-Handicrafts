import { useState } from "react";
import { UserRound } from "../icons";
import ProfileFormCard, {
  FormField,
  TextAreaInput,
  TextInput,
} from "../shared/ProfileForm";
import ProfileFormDialog from "./ProfileFormDialog";

/**
 * LSB Handicrafts — Add / Edit Customer
 * Figma: Screen #16, nodes 171:1072 (add), 171:1438 (validation errors),
 * 171:1283 / 171:1831 (edit, pre-filled)
 *
 * One component covers add and edit, switched by `mode`.
 *
 * This was a full page. It is a dialog now so adding a customer no longer
 * navigates away from the list — the same move `CreateUserAccountDialog` made
 * for staff accounts, and for the same reason: you usually want to add several
 * in a row, and a round trip through a page each time is friction.
 *
 * `ProfileSaved` did not survive that move. On success the dialog closes and
 * App raises a toast carrying the "View" action the panel used to offer, so the
 * affordance is kept without a screen the user has to dismiss.
 */

const EMPTY = { name: "", contactNumber: "", email: "", address: "" };

function validate(values) {
  const errors = {};
  if (!values.name.trim()) errors.name = "Customer name is required.";
  if (!values.contactNumber.trim())
    errors.contactNumber = "Contact number is required.";
  if (!values.address.trim()) errors.address = "Address is required.";
  // Email is optional, but a typo in one that was filled in is still an error.
  if (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()))
    errors.email = "Enter a valid email address.";
  return errors;
}

const seed = (customer, isEdit) =>
  isEdit && customer
    ? {
        name: customer.name ?? "",
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
    setValues((prev) => ({ ...prev, [field]: value }));
    // Clear the message as soon as they start fixing the field, rather than
    // making them submit again to find out.
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  // As a page this was remounted per record by a `key`, which reset the fields
  // for free. A dialog stays mounted between opens, so add -> add -> add would
  // otherwise show the previous entry. App still keys on the record id; this
  // covers the case where the key does not change.
  function handleOpenChange(next) {
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
    // onSave resolves to null when the database rejected the write; a toast has
    // already said why. Staying open keeps the user's input instead of closing
    // over a record that was never stored.
    if (id !== null && id !== undefined) handleOpenChange(false);
  }

  return (
    <ProfileFormDialog
      open={open}
      onOpenChange={handleOpenChange}
      saving={saving}
      icon={<UserRound className="h-4 w-4" />}
      title={isEdit ? "Edit Customer" : "Add Customer"}
      description="Fields marked with * are required."
    >
      <ProfileFormCard
        variant="dialog"
        saveLabel="Save Customer"
        onSubmit={handleSubmit}
        onCancel={() => handleOpenChange(false)}
        saving={saving}
      >
        <FormField label="Customer Name" required error={errors.name} wide>
          <TextInput
            value={values.name}
            onChange={(e) => setField("name", e.target.value)}
            placeholder="Enter customer name"
            error={errors.name}
          />
        </FormField>

        <FormField label="Contact Number" required error={errors.contactNumber}>
          <TextInput
            value={values.contactNumber}
            onChange={(e) => setField("contactNumber", e.target.value)}
            placeholder="09XX XXX XXXX"
            inputMode="tel"
            error={errors.contactNumber}
          />
        </FormField>

        <FormField label="Email Address" error={errors.email}>
          <TextInput
            type="email"
            value={values.email}
            onChange={(e) => setField("email", e.target.value)}
            placeholder="customer@email.com"
            error={errors.email}
          />
        </FormField>

        <FormField label="Address" required error={errors.address} wide>
          <TextAreaInput
            value={values.address}
            onChange={(e) => setField("address", e.target.value)}
            placeholder="Enter complete address"
            error={errors.address}
          />
        </FormField>
      </ProfileFormCard>
    </ProfileFormDialog>
  );
}
