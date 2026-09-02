import { useState } from "react";
import { Truck } from "../icons";
import ManagementShell from "../layout/ManagementShell";
import ProfileFormCard, {
  FormBackLink,
  FormField,
  TextAreaInput,
  TextInput,
} from "../shared/ProfileForm";
import { ProfileSaved } from "../shared/ProfilePanels";

/**
 * LSB Handicrafts — Add / Edit Supplier
 * Figma: Screen #22, nodes 184:5375 (add), 184:5593 (edit, pre-filled),
 * 184:5847 (validation errors), 184:5996, 184:6214 (saved)
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

export default function SupplierFormPage({
  mode = "add",
  supplier,
  profile,
  onNavigate,
  onSignOut,
  onCancel,
  onSave,
  onView,
}) {
  const isEdit = mode === "edit";
  const [values, setValues] = useState(() =>
    isEdit && supplier
      ? {
          name: supplier.name ?? "",
          contactPerson: supplier.contactPerson ?? "",
          contactNumber: supplier.contactNumber ?? "",
          email: supplier.email ?? "",
          address: supplier.address ?? "",
        }
      : EMPTY
  );
  const [errors, setErrors] = useState({});
  const [savedId, setSavedId] = useState(null);
  const [saving, setSaving] = useState(false);

  const title = isEdit ? "Edit Supplier" : "Add Supplier";

  function setField(field, value) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
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
    // already said why. Staying on the form keeps the user's input, instead of
    // showing the "saved successfully" panel over a record that was never
    // stored -- which is exactly what this screen used to do.
    if (id !== null && id !== undefined) setSavedId(id);
  }

  return (
    <ManagementShell
      active="supplier-form"
      title={title}
      subtitle={`Supplier Profiles / ${title}`}
      profile={profile}
      onNavigate={onNavigate}
      onSignOut={onSignOut}
    >
      <div className="mx-auto w-full max-w-[680px]">
        {savedId !== null ? (
          <ProfileSaved
            label="Supplier"
            onView={() => onView(savedId)}
            onBackToList={onCancel}
          />
        ) : (
          <>
            <FormBackLink label="Supplier Profiles" onClick={onCancel} />
            <ProfileFormCard
              icon={<Truck className="h-[17px] w-[17px]" />}
              heading="Supplier Information"
              saveLabel="Save Supplier"
              onSubmit={handleSubmit}
              onCancel={onCancel}
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

              <FormField
                label="Contact Person"
                required
                error={errors.contactPerson}
              >
                <TextInput
                  value={values.contactPerson}
                  onChange={(e) => setField("contactPerson", e.target.value)}
                  placeholder="Enter contact person"
                  error={errors.contactPerson}
                />
              </FormField>

              <FormField
                label="Contact Number"
                required
                error={errors.contactNumber}
              >
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
          </>
        )}
      </div>
    </ManagementShell>
  );
}
