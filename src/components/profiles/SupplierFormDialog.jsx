import { useState } from "react";
import { Truck } from "../icons";
import ProfileFormCard, {
  FormField,
  TextAreaInput,
  TextInput,
} from "../shared/ProfileForm";
import ProfileFormDialog from "./ProfileFormDialog";

/**
 * LSB Handicrafts — Add / Edit Supplier
 * Figma: Screen #21
 *
 * Same shape as CustomerFormDialog, one field wider. See the note there on why
 * these moved from full pages into modals and what replaced ProfileSaved.
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
  if (!values.name.trim()) errors.name = "Supplier name is required.";
  if (!values.contactPerson.trim())
    errors.contactPerson = "Contact person is required.";
  if (!values.contactNumber.trim())
    errors.contactNumber = "Contact number is required.";
  if (!values.address.trim()) errors.address = "Address is required.";
  if (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()))
    errors.email = "Enter a valid email address.";
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
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  function handleOpenChange(next) {
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
    <ProfileFormDialog
      open={open}
      onOpenChange={handleOpenChange}
      saving={saving}
      icon={<Truck className="h-4 w-4" />}
      title={isEdit ? "Edit Supplier" : "Add Supplier"}
      description="Fields marked with * are required."
    >
      <ProfileFormCard
        variant="dialog"
        saveLabel="Save Supplier"
        onSubmit={handleSubmit}
        onCancel={() => handleOpenChange(false)}
        saving={saving}
      >
        <FormField label="Supplier Name" required error={errors.name} wide>
          <TextInput
            value={values.name}
            onChange={(e) => setField("name", e.target.value)}
            placeholder="Enter supplier name"
            error={errors.name}
          />
        </FormField>

        <FormField label="Contact Person" required error={errors.contactPerson}>
          <TextInput
            value={values.contactPerson}
            onChange={(e) => setField("contactPerson", e.target.value)}
            placeholder="Enter contact person"
            error={errors.contactPerson}
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

        <FormField label="Email Address" error={errors.email} wide>
          <TextInput
            type="email"
            value={values.email}
            onChange={(e) => setField("email", e.target.value)}
            placeholder="supplier@email.com"
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
