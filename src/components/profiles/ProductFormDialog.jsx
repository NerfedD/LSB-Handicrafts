import { useState } from "react";
import { Box } from "../icons";
import ProfileFormCard, {
  FormField,
  SelectInput,
  TextInput,
} from "../shared/ProfileForm";
import ProfileFormDialog from "./ProfileFormDialog";
import {
  PRODUCT_TYPE,
  PRODUCT_TYPE_OPTIONS,
  SELL_UNIT_OPTIONS,
} from "../../utils/constants";
import { formatDimensions } from "../../utils/productFormat";

/**
 * LSB Handicrafts — Add / Edit Product
 * Figma: Screen #19, nodes 177:3392 (add), 177:3627 (edit / validation)
 *
 * The biggest of the three record dialogs: twelve-plus fields, dimension
 * inputs that appear only for the matching product type, a Status field only
 * shown when editing, and a payload transform on submit. All of that is
 * unchanged from when this was a page — only the wrapper moved, which is why
 * ProfileFormDialog's scrolling body is load-bearing here rather than optional.
 */

const EMPTY = {
  itemCode: "",
  name: "",
  size: "",
  unitPrice: "",
  lowStockThreshold: "",
  status: "Active",
  productType: PRODUCT_TYPE.BALL,
  diameterIn: "",
  thicknessIn: "",
  lengthFt: "",
  widthFt: "",
  unit: "piece",
  packSize: "1",
};

const isFlatType = (productType) =>
  productType === PRODUCT_TYPE.SHEET || productType === PRODUCT_TYPE.BLOCK;

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

  // Which dimensions are required depends on the type — a ball has a diameter
  // and no width, a sheet the other way round.
  const positive = (v) => v !== "" && !Number.isNaN(Number(v)) && Number(v) > 0;
  if (values.productType === PRODUCT_TYPE.BALL) {
    if (!positive(values.diameterIn)) errors.diameterIn = "Enter the diameter in inches.";
  } else if (isFlatType(values.productType)) {
    if (!positive(values.thicknessIn)) errors.thicknessIn = "Enter the thickness in inches.";
    if (!positive(values.lengthFt)) errors.lengthFt = "Enter the length in feet.";
    if (!positive(values.widthFt)) errors.widthFt = "Enter the width in feet.";
  }

  if (values.unit !== "piece") {
    const packSize = Number(values.packSize);
    if (!Number.isInteger(packSize) || packSize < 1)
      errors.packSize = "Enter a whole number of pieces per unit.";
  }

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

export default function ProductFormDialog({
  open,
  onOpenChange,
  mode = "add",
  product,
  products = [],
  onSave,
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
          productType: product.productType ?? PRODUCT_TYPE.OTHER,
          diameterIn: product.diameterIn == null ? "" : String(product.diameterIn),
          thicknessIn: product.thicknessIn == null ? "" : String(product.thicknessIn),
          lengthFt: product.lengthFt == null ? "" : String(product.lengthFt),
          widthFt: product.widthFt == null ? "" : String(product.widthFt),
          unit: product.unit ?? "piece",
          packSize: product.packSize == null ? "1" : String(product.packSize),
        }
      : EMPTY
  );
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const takenCodes = products
    .filter((p) => p.id !== product?.id)
    .map((p) => String(p.itemCode || "").toLowerCase());

  function setField(field, value) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const found = validate(values, takenCodes);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    const isBall = values.productType === PRODUCT_TYPE.BALL;
    const isFlat = isFlatType(values.productType);
    const numOrNull = (v) => (v === "" || v === null ? null : Number(v));

    setSaving(true);
    const id = await onSave({
      ...values,
      itemCode: values.itemCode.trim(),
      unitPrice: Number(values.unitPrice),
      lowStockThreshold: Number(values.lowStockThreshold),
      diameterIn: isBall ? numOrNull(values.diameterIn) : null,
      thicknessIn: isFlat ? numOrNull(values.thicknessIn) : null,
      lengthFt: isFlat ? numOrNull(values.lengthFt) : null,
      widthFt: isFlat ? numOrNull(values.widthFt) : null,
      packSize: values.unit === "piece" ? 1 : Number(values.packSize),
      // `size` is no longer typed by hand — it's the dimensions rendered as a
      // label, kept on the row so anything still reading that column works.
      size: formatDimensions(values),
    });
    setSaving(false);
    // onSave resolves to null when the database rejected the write; a toast has
    // already said why. Staying open keeps the user's input instead of closing
    // over a record that was never stored.
    if (id !== null && id !== undefined) handleOpenChange(false);
  }

  // A dialog stays mounted between opens, so the fields have to be cleared on
  // close or add -> add -> add would show the previous entry. App also keys on
  // the record id; this covers the case where that key does not change.
  function handleOpenChange(next) {
    if (!next) {
      setValues(EMPTY);
      setErrors({});
    }
    onOpenChange?.(next);
  }

  return (
    <ProfileFormDialog
      open={open}
      onOpenChange={handleOpenChange}
      saving={saving}
      icon={<Box className="h-4 w-4" />}
      title={isEdit ? "Edit Product" : "Add Product"}
      description="Fields marked with * are required."
    >
      <ProfileFormCard
        variant="dialog"
        saveLabel="Save Product"
        onSubmit={handleSubmit}
        onCancel={() => handleOpenChange(false)}
        saving={saving}
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

            <FormField label="Product Type" required>
              <SelectInput
                value={values.productType}
                onChange={(e) => setField("productType", e.target.value)}
              >
                {PRODUCT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectInput>
            </FormField>

            {values.productType === PRODUCT_TYPE.BALL && (
              <FormField
                label="Diameter (inches)"
                required
                error={errors.diameterIn}
                hint={`Size: ${formatDimensions(values)}`}
              >
                <TextInput
                  type="number"
                  min="0"
                  step="0.25"
                  value={values.diameterIn}
                  onChange={(e) => setField("diameterIn", e.target.value)}
                  placeholder="4"
                  error={errors.diameterIn}
                />
              </FormField>
            )}

            {isFlatType(values.productType) && (
              <>
                <FormField
                  label="Thickness (inches)"
                  required
                  error={errors.thicknessIn}
                  hint={`Size: ${formatDimensions(values)}`}
                >
                  <TextInput
                    type="number"
                    min="0"
                    step="0.25"
                    value={values.thicknessIn}
                    onChange={(e) => setField("thicknessIn", e.target.value)}
                    placeholder="1"
                    error={errors.thicknessIn}
                  />
                </FormField>
                <FormField label="Length (feet)" required error={errors.lengthFt}>
                  <TextInput
                    type="number"
                    min="0"
                    step="0.5"
                    value={values.lengthFt}
                    onChange={(e) => setField("lengthFt", e.target.value)}
                    placeholder="8"
                    error={errors.lengthFt}
                  />
                </FormField>
                <FormField label="Width (feet)" required error={errors.widthFt}>
                  <TextInput
                    type="number"
                    min="0"
                    step="0.5"
                    value={values.widthFt}
                    onChange={(e) => setField("widthFt", e.target.value)}
                    placeholder="4"
                    error={errors.widthFt}
                  />
                </FormField>
              </>
            )}

            <FormField label="Unit of Sale" required>
              <SelectInput
                value={values.unit}
                onChange={(e) => setField("unit", e.target.value)}
              >
                {SELL_UNIT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectInput>
            </FormField>

            {values.unit !== "piece" && (
              <FormField
                label={`Pieces per ${values.unit}`}
                required
                error={errors.packSize}
              >
                <TextInput
                  type="number"
                  min="1"
                  step="1"
                  value={values.packSize}
                  onChange={(e) => setField("packSize", e.target.value)}
                  placeholder="25"
                  error={errors.packSize}
                />
              </FormField>
            )}

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
    </ProfileFormDialog>
  );
}
