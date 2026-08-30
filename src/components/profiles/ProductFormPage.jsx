import { useState } from "react";
import { Box } from "../icons";
import ManagementShell from "../layout/ManagementShell";
import ProfileFormCard, {
  FormBackLink,
  FormField,
  SelectInput,
  TextInput,
} from "../shared/ProfileForm";
import { ProfileSaved } from "../shared/ProfilePanels";

/**
 * LSB Handicrafts — Add / Edit Product
 * Figma: Screen #19, nodes 177:3392 (add), 177:3627 (edit / validation),
 * 177:3906 (saved)
 */

const PRODUCT_SIZES = ["Small", "Medium", "Large"];

const EMPTY = {
  itemCode: "",
  name: "",
  size: "",
  unitPrice: "",
  lowStockThreshold: "",
  status: "Active",
};

/**
 * `takenCodes` is every other product's item code — the column is unique in
 * Postgres, so catching a duplicate here turns a failed upsert into a field
 * message instead of a silent save that never lands.
 */
function validate(values, takenCodes) {
  const errors = {};
  const code = values.itemCode.trim();

  if (!code) errors.itemCode = "Item code is required.";
  else if (takenCodes.includes(code.toLowerCase()))
    errors.itemCode = "That item code is already in use.";

  if (!values.name.trim()) errors.name = "Product name is required.";
  if (!values.size) errors.size = "Size is required.";

  const price = Number(values.unitPrice);
  if (values.unitPrice === "") errors.unitPrice = "Unit price is required.";
  else if (Number.isNaN(price) || price < 0)
    errors.unitPrice = "Enter a valid unit price.";

  const threshold = Number(values.lowStockThreshold);
  if (values.lowStockThreshold === "")
    errors.lowStockThreshold = "Low-stock threshold is required.";
  else if (!Number.isInteger(threshold) || threshold < 0)
    errors.lowStockThreshold = "Enter a whole number of units.";

  return errors;
}

export default function ProductFormPage({
  mode = "add",
  product,
  products = [],
  profile,
  onNavigate,
  onSignOut,
  onCancel,
  onSave,
  onView,
}) {
  const isEdit = mode === "edit";
  const [values, setValues] = useState(() =>
    isEdit && product
      ? {
          itemCode: product.itemCode ?? "",
          name: product.name ?? "",
          size: product.size ?? "",
          unitPrice:
            product.unitPrice === null || product.unitPrice === undefined
              ? ""
              : String(product.unitPrice),
          lowStockThreshold:
            product.lowStockThreshold === null ||
            product.lowStockThreshold === undefined
              ? ""
              : String(product.lowStockThreshold),
          status: product.status ?? "Active",
        }
      : EMPTY
  );
  const [errors, setErrors] = useState({});
  const [savedId, setSavedId] = useState(null);

  const title = isEdit ? "Edit Product" : "Add Product";
  const takenCodes = products
    .filter((p) => p.id !== product?.id)
    .map((p) => String(p.itemCode || "").toLowerCase());

  function setField(field, value) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const found = validate(values, takenCodes);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setSavedId(
      onSave({
        ...values,
        itemCode: values.itemCode.trim(),
        unitPrice: Number(values.unitPrice),
        lowStockThreshold: Number(values.lowStockThreshold),
      })
    );
  }

  return (
    <ManagementShell
      active="product-form"
      title={title}
      subtitle={`Product / Item Profiles / ${title}`}
      profile={profile}
      onNavigate={onNavigate}
      onSignOut={onSignOut}
    >
      <div className="mx-auto w-full max-w-[680px]">
        {savedId !== null ? (
          <ProfileSaved
            label="Product"
            onView={() => onView(savedId)}
            onBackToList={onCancel}
          />
        ) : (
          <>
            <FormBackLink label="Product / Item Profiles" onClick={onCancel} />
            <ProfileFormCard
              icon={<Box className="h-[17px] w-[17px]" />}
              heading="Product Information"
              saveLabel="Save Product"
              onSubmit={handleSubmit}
              onCancel={onCancel}
            >
              <FormField label="Item Code" required error={errors.itemCode}>
                <TextInput
                  value={values.itemCode}
                  onChange={(e) => setField("itemCode", e.target.value)}
                  placeholder="Enter item code"
                  error={errors.itemCode}
                />
              </FormField>

              <FormField label="Product Name" required error={errors.name}>
                <TextInput
                  value={values.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="Enter product name"
                  error={errors.name}
                />
              </FormField>

              <FormField label="Size" required error={errors.size}>
                <SelectInput
                  value={values.size}
                  onChange={(e) => setField("size", e.target.value)}
                  error={errors.size}
                >
                  <option value="">Select size</option>
                  {PRODUCT_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </SelectInput>
              </FormField>

              <FormField label="Unit Price" required error={errors.unitPrice}>
                <TextInput
                  type="number"
                  min="0"
                  step="0.01"
                  value={values.unitPrice}
                  onChange={(e) => setField("unitPrice", e.target.value)}
                  placeholder="0.00"
                  error={errors.unitPrice}
                />
              </FormField>

              <FormField
                label="Low-Stock Threshold"
                required
                error={errors.lowStockThreshold}
                hint="A low-stock alert will be triggered when inventory falls below this level."
              >
                <TextInput
                  type="number"
                  min="0"
                  step="1"
                  value={values.lowStockThreshold}
                  onChange={(e) => setField("lowStockThreshold", e.target.value)}
                  placeholder="Enter minimum stock level"
                  error={errors.lowStockThreshold}
                />
              </FormField>

              {/* Not on the Add mockup — the list and detail screens both show a
                  status, and without this an Inactive product could never be
                  reactivated. */}
              {isEdit && (
                <FormField label="Status">
                  <SelectInput
                    value={values.status}
                    onChange={(e) => setField("status", e.target.value)}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </SelectInput>
                </FormField>
              )}
            </ProfileFormCard>
          </>
        )}
      </div>
    </ManagementShell>
  );
}
