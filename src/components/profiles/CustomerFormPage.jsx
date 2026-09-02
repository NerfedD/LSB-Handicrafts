import { useState } from "react";
import { UserRound } from "../icons";
import ManagementShell from "../layout/ManagementShell";
import ProfileFormCard, {
  FormBackLink,
  FormField,
  TextAreaInput,
  TextInput,
} from "../shared/ProfileForm";
import { ProfileSaved } from "../shared/ProfilePanels";

/**
 * LSB Handicrafts — Add / Edit Customer
 * Figma: Screen #16, nodes 171:1072 (add), 171:1438 (validation errors),
 * 171:1283 / 171:1831 (edit, pre-filled), 171:1676 (saved)
 *
 * One component covers add and edit, switched by `mode` — the same convention
 * views/ProductForm.jsx uses for the dashboard workspace. `onSave` returns the
 * saved record's id so the success panel's "View Customer" knows where to go.
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

export default function CustomerFormPage({
  mode = "add",
  customer,
  profile,
  onNavigate,
  onSignOut,
  onCancel,
  onSave,
  onView,
}) {
  const isEdit = mode === "edit";
  const [values, setValues] = useState(() =>
    isEdit && customer
      ? {
          name: customer.name ?? "",
          contactNumber: customer.contactNumber ?? "",
          email: customer.email ?? "",
          address: customer.address ?? "",
        }
      : EMPTY
  );
  const [errors, setErrors] = useState({});
  const [savedId, setSavedId] = useState(null);
  const [saving, setSaving] = useState(false);

  const title = isEdit ? "Edit Customer" : "Add Customer";

  function setField(field, value) {
    setValues((prev) => ({ ...prev, [field]: value }));
    // Clear the message as soon as they start fixing the field, rather than
    // making them submit again to find out.
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
      active="customer-form"
      title={title}
      subtitle={`Customer Profiles / ${title}`}
      profile={profile}
      onNavigate={onNavigate}
      onSignOut={onSignOut}
    >
      <div className="mx-auto w-full max-w-[680px]">
        {savedId !== null ? (
          <ProfileSaved
            label="Customer"
            onView={() => onView(savedId)}
            onBackToList={onCancel}
          />
        ) : (
          <>
            <FormBackLink label="Customer Profiles" onClick={onCancel} />
            <ProfileFormCard
              icon={<UserRound className="h-[17px] w-[17px]" />}
              heading="Customer Information"
              saveLabel="Save Customer"
              onSubmit={handleSubmit}
              onCancel={onCancel}
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
          </>
        )}
      </div>
    </ManagementShell>
  );
}
