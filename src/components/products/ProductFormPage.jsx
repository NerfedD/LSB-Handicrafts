import FormError from "../shared/FormError";
import { guardForm, reportFormError } from "../../utils/formErrors";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChoiceButtons,
  Field,
  LockedField,
  Row,
} from "../shared/forms";
import { Page, PageHeader, SectionCard } from "../shared/page";
import { PRODUCT_TYPE, PRODUCT_TYPE_OPTIONS, SELL_UNIT_OPTIONS } from "../../utils/constants";
import { suggestItemCode, suggestProductName } from "../../utils/productFormat";
import { countProblem, measureProblem, moneyProblem, nameProblem, tidyLabel } from "../../utils/validation";
import useProductImage from "../../hooks/useProductImage";
import { ProductPhotoField } from "./ProductPhoto";

/** The value of the category select that opens the "new category" box. */
const NEW_CATEGORY = "__new";

/**
 * Add a product — screen 2g.
 *
 * A FULL SCREEN, NOT A DIALOG. Adding a customer is four fields and belongs in
 * a modal over the list you are adding to; adding a product is a decision with
 * a dozen inputs, a photograph and a generated code, and a modal that scrolls
 * is a form somebody loses their place in.
 *
 * THE FORM IS ADAPTIVE, which is the reason for the numbered bands. "What is
 * it?" has to be answered first because the answer changes what is asked next:
 * a ball has a diameter, a sheet has a thickness and two edge lengths, a block
 * has three dimensions. Showing every dimension field to everybody and letting
 * them work out which apply is how the catalogue ended up with sizes buried in
 * free text.
 *
 * THE SKU IS GENERATED AND SAID SO. The note in the right-hand column is not
 * decoration — a form with a read-only field somebody does not understand is a
 * form they stop and ask about. "You never have to invent a code" is the whole
 * message.
 *
 * ONE SCREEN WRITES TWO TABLES. "How many on the shelf now" belongs to the
 * inventory ledger and everything else to the catalogue, but that split is a
 * database fact and not a thing anybody should be asked to care about — so the
 * screen collects both and the save handler in App.jsx writes both. The count
 * is asked for once, when the product is added; after that it changes only
 * through recorded stock movements.
 */

const EMPTY = {
  productType: PRODUCT_TYPE.BALL,
  name: "",
  diameterIn: "",
  thicknessIn: "",
  lengthFt: "",
  widthFt: "",
  category: "",
  categoryNew: "",
  unitPrice: "",
  unit: "piece",
  packSize: "1",
  stock: "",
  lowStockThreshold: "",
};

const seed = (product, stock) => {
  if (!product) return EMPTY;
  return {
    revision: product.revision ?? 0,
    stockRevision: stock?.revision ?? 0,
    productType: product.productType || PRODUCT_TYPE.OTHER,
    name: product.name ?? "",
    diameterIn: product.diameterIn ?? "",
    thicknessIn: product.thicknessIn ?? "",
    lengthFt: product.lengthFt ?? "",
    widthFt: product.widthFt ?? "",
    category: stock?.category ?? "",
    categoryNew: "",
    unitPrice: product.unitPrice ?? "",
    unit: product.unit || "piece",
    packSize: String(product.packSize ?? 1),
    stock: stock?.tracked ? String(stock.onHand) : "",
    lowStockThreshold: String(product.lowStockThreshold ?? stock?.threshold ?? ""),
  };
};

/**
 * Every rule the database checks, said beside the field it is about. Sizes are
 * positive and within reason, counts are whole numbers, money has two decimal
 * places at most -- and "12" is a perfectly good price without ".00".
 */
function validate(values, { isEdit, stockTracked, categories }) {
  const errors = {};
  const put = (field, message) => { if (message) errors[field] = message; };
  put("name", values.name.trim() ? nameProblem(values.name, { label: "The name" }) : "Give it a name, so staff can find it.");
  put("unitPrice", values.unitPrice === ""
    ? "Put in the price you sell it for. Use 0 if it is not for sale."
    : moneyProblem(values.unitPrice, { label: "The price" }));
  const isBall = values.productType === PRODUCT_TYPE.BALL;
  const isFlat = values.productType === PRODUCT_TYPE.SHEET || values.productType === PRODUCT_TYPE.BLOCK;
  if (isBall) {
    put("diameterIn", values.diameterIn === "" ? "How wide across is it?"
      : measureProblem(values.diameterIn, { label: "The width across", max: 240, unit: "inches" }));
  }
  if (isFlat) {
    put("thicknessIn", values.thicknessIn === "" ? "How thick is it?"
      : measureProblem(values.thicknessIn, { label: "The thickness", max: 240, unit: "inches" }));
    put("lengthFt", measureProblem(values.lengthFt, { label: "The length", max: 200, unit: "feet" }));
    put("widthFt", measureProblem(values.widthFt, { label: "The width", max: 200, unit: "feet" }));
  }
  if (values.unit !== "piece") {
    put("packSize", countProblem(values.packSize, { min: 1, max: 100000, label: "The number in each" }));
  }
  if (!(isEdit && stockTracked) && values.stock !== "") {
    put("stock", countProblem(values.stock, { label: "The count" }));
  }
  if (values.lowStockThreshold !== "") {
    put("lowStockThreshold", countProblem(values.lowStockThreshold, { label: "The reorder point" }));
  }
  if (values.category === NEW_CATEGORY) {
    const name = tidyLabel(values.categoryNew);
    const clash = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (!name) put("categoryNew", "Write the name of the new category, or choose one from the list.");
    else if (name.length > 60) put("categoryNew", "Keep the category name to 60 characters.");
    else if (clash) put("categoryNew", `There is already a category called "${clash.name}". Choose it from the list instead.`);
  }
  return errors;
}

/**
 * The category, as a choice from the managed list. A new one is typed only
 * after choosing "Add a new category…", and a name that matches an existing one
 * in any capitalisation is pointed back to the list, so the catalogue does not
 * end up with "Styro Balls" and "styro balls".
 */
function CategoryField({ values, errors, categories, setField, placeholder }) {
  const known = categories.map((c) => c.name);
  // A label on an old stock row that is not in the list yet is still offered,
  // so editing that product does not silently drop its category.
  const current = values.category && values.category !== NEW_CATEGORY
    && !known.some((n) => n.toLowerCase() === values.category.toLowerCase())
    ? [values.category] : [];
  const options = [...known, ...current].sort((a, b) => a.localeCompare(b));
  return (
    <div className="flex flex-col gap-3">
      <Field label="Category" error={errors.category} hint="How it is grouped on the shelf and in the list.">
        {(props) => (
          <Select value={values.category || "__none"} onValueChange={(next) => setField("category", next === "__none" ? "" : next)}>
            <SelectTrigger id={props.id} aria-describedby={props["aria-describedby"]}>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">No category</SelectItem>
              {options.map((name) => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
              <SelectItem value={NEW_CATEGORY}>Add a new category…</SelectItem>
            </SelectContent>
          </Select>
        )}
      </Field>
      {values.category === NEW_CATEGORY && (
        <Field label="New category name" required error={errors.categoryNew} hint="It is added to the list when you save, and offered for every product after that.">
          {(props) => (
            <Input {...props} maxLength={60} value={values.categoryNew} onChange={(event) => setField("categoryNew", event.target.value)} placeholder={placeholder} />
          )}
        </Field>
      )}
    </div>
  );
}

export default function ProductFormPage({
  mode = "add",
  product,
  stock,
  /** Every item code already in use, so a generated one cannot collide. */
  takenCodes = [],
  /** The managed category list: [{ id, name }]. */
  categories = [],
  saving = false,
  onSave,
  onCancel,
}) {
  const isEdit = mode === "edit";
  const [values, setValues] = useState(() => seed(isEdit ? product : null, stock));
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState(null);
  const [submittedCode, setSubmittedCode] = useState(null);
  const [photo, setPhoto] = useState({ change: null, dataUrl: null });
  const saved = useProductImage(isEdit ? product?.id ?? null : null);

  function setField(field, value) {
    setValues((previous) => ({ ...previous, [field]: value }));
    // Clear the message as soon as they start fixing the field, rather than
    // making them submit again to find out whether they have.
    setErrors((previous) => (previous[field] ? { ...previous, [field]: undefined } : previous));
  }

  const isBall = values.productType === PRODUCT_TYPE.BALL;
  const isFlat =
    values.productType === PRODUCT_TYPE.SHEET || values.productType === PRODUCT_TYPE.BLOCK;

  // An existing product keeps the code it was given. Regenerating it on edit
  // would rename a code already written on a shelf label.
  const itemCode = useMemo(() => {
    if (submittedCode) return submittedCode;
    if (isEdit && product?.itemCode) return product.itemCode;
    return suggestItemCode(
      {
        productType: values.productType,
        diameterIn: values.diameterIn,
        thicknessIn: values.thicknessIn,
      },
      takenCodes
    );
  }, [submittedCode, isEdit, product?.itemCode, values.productType, values.diameterIn, values.thicknessIn, takenCodes]);

  // Offered, never imposed: the suggestion keeps the catalogue from drifting
  // into a dozen naming styles, and staff can still overwrite it.
  const suggestedName = suggestProductName({
    productType: values.productType,
    diameterIn: values.diameterIn,
    thicknessIn: values.thicknessIn,
    lengthFt: values.lengthFt,
    widthFt: values.widthFt,
  });

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;
    const formElement = event.currentTarget;
    setSaveError(null);
    const found = validate(values, { isEdit, stockTracked: Boolean(stock?.tracked), categories });
    if (Object.keys(found).length > 0) {
      setErrors(found);
      const count = Object.keys(found).length;
      reportFormError(event.currentTarget, count === 1 ? Object.values(found)[0] : `Check the ${count} fields marked below.`);
      return;
    }
    if (!guardForm(formElement)) return;
    setSubmittedCode(itemCode);
    try {
      const creating = values.category === NEW_CATEGORY;
      const result = await onSave({
        ...values,
        itemCode,
        category: creating ? tidyLabel(values.categoryNew) : values.category,
        categoryIsNew: creating,
        photo,
      });
      if (!result?.ok) {
        const message = result?.message || 'The product was not saved. Check your entries and retry.';
        setSaveError(message); reportFormError(formElement, message);
      }
    } catch {
      const message = 'The request failed. Your entries are still here; check your connection and retry.';
      setSaveError(message); reportFormError(formElement, message);
    }
  }

  const number = (field, extra = {}) => (props) => (
    <Input
      {...props}
      type="number"
      inputMode="decimal"
      value={values[field]}
      onChange={(event) => setField(field, event.target.value)}
      {...extra}
    />
  );

  const unitShort = SELL_UNIT_OPTIONS.find((option) => option.value === values.unit)?.label ?? values.unit;

  return (
    <Page>
      <PageHeader
        back={{ label: isEdit ? "Back to the product" : "Back to Inventory", onClick: onCancel }}
        title={isEdit ? `Edit ${product?.name ?? "product"}` : "Add product"}
        description={isEdit ? "Its stock count changes only through counts and write-offs, never here." : "Something the shop sells. Its stock is counted from here on."}
      />
      <form onSubmit={handleSubmit} noValidate className="w-full max-w-[640px]">
        <SectionCard
          title={isEdit ? "Product details" : "New product"}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onCancel} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : isEdit ? "Save changes" : "Add product"}
              </Button>
            </div>
          }
          bodyClassName="flex flex-col gap-3.5"
        >
          <FormError message={saveError} />

          <Field label="Kind" hint="This decides which measurements are asked for.">
            <ChoiceButtons
              label="Kind"
              value={values.productType}
              onChange={(next) => setField("productType", next)}
              options={PRODUCT_TYPE_OPTIONS}
            />
          </Field>

          <div className="grid gap-3.5 sm:grid-cols-[120px_minmax(0,1fr)]">
            <ProductPhotoField
              value={photo}
              current={saved.photo?.dataUrl ?? null}
              onChange={setPhoto}
              disabled={saving}
              name={values.name}
            />
            <div className="flex min-w-0 flex-col gap-3.5">
              <Field
                label="Name"
                required
                error={errors.name}
                hint={
                  suggestedName && values.name !== suggestedName
                    ? `The way staff say it out loud. Suggestion: ${suggestedName}`
                    : "The way staff say it out loud."
                }
              >
                {(props) => (
                  <Input
                    {...props}
                    value={values.name}
                    onChange={(event) => setField("name", event.target.value)}
                    placeholder={suggestedName || "Styro ball, 4 inch"}
                  />
                )}
              </Field>
              <LockedField
                label="Item code"
                value={itemCode}
                hint={isEdit ? "Kept as it is, so shelf labels stay right." : "Made for you from the kind and the size."}
              />
            </div>
          </div>

          {isBall && (
            <Row>
              <Field label="How wide across" required error={errors.diameterIn}>
                {(props) => (
                  <div className="relative">
                    {number("diameterIn", { step: "any", min: "0", placeholder: "4", className: "pr-14" })(props)}
                    <span aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-13 text-muted-fg">inches</span>
                  </div>
                )}
              </Field>
              <CategoryField values={values} errors={errors} categories={categories} setField={setField} placeholder="Styro Balls" />
            </Row>
          )}

          {isFlat && (
            <>
              <Row className="sm:grid-cols-3">
                <Field label="How thick" required error={errors.thicknessIn} hint="Inches.">
                  {number("thicknessIn", { step: "any", min: "0", placeholder: "1" })}
                </Field>
                <Field label="How long" error={errors.lengthFt} hint="Feet.">
                  {number("lengthFt", { step: "any", min: "0", placeholder: "4" })}
                </Field>
                <Field label="How wide" error={errors.widthFt} hint="Feet.">
                  {number("widthFt", { step: "any", min: "0", placeholder: "2" })}
                </Field>
              </Row>
              <CategoryField values={values} errors={errors} categories={categories} setField={setField} placeholder="Styro Sheets" />
            </>
          )}

          {!isBall && !isFlat && (
            <CategoryField values={values} errors={errors} categories={categories} setField={setField} placeholder="Custom shapes" />
          )}

          <Row>
            <Field label="Sold" hint="How one is counted at the counter.">
              {(props) => (
                <Select
                  items={SELL_UNIT_OPTIONS}
                  value={values.unit}
                  onValueChange={(next) => setField("unit", next)}
                >
                  <SelectTrigger id={props.id} aria-describedby={props["aria-describedby"]} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SELL_UNIT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>

            <Field label="Price" required error={errors.unitPrice} hint="What one costs a customer.">
              {(props) => (
                <div className="relative">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-13 text-muted-fg" aria-hidden="true">
                    ₱
                  </span>
                  <Input
                    {...props}
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    className="pl-6 pr-20"
                    value={values.unitPrice}
                    onChange={(event) => setField("unitPrice", event.target.value)}
                    placeholder="0.00"
                  />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-13 text-muted-fg" aria-hidden="true">
                    {String(unitShort).toLowerCase()}
                  </span>
                </div>
              )}
            </Field>
          </Row>

          {values.unit !== "piece" && (
            <Field
              label={`Pieces in one ${values.unit}`}
              error={errors.packSize}
              hint="So the shelf count can be told in actual pieces. A whole number."
            >
              {number("packSize", { step: "1", inputMode: "numeric", min: "1", placeholder: "25" })}
            </Field>
          )}

          <Row>
            {/* The opening count only. After that a count moves through recorded
                movements -- "Correct the count" and "Record damage" on the
                product's own screen -- so every change has a reason and a name. */}
            {isEdit && stock?.tracked ? (
              <LockedField
                label="On the shelf"
                value={String(stock.onHand)}
                hint="To change this, count it from the product's screen."
              />
            ) : (
              <Field
                label="On the shelf"
                error={errors.stock}
                hint={isEdit ? "Nobody is counting this one yet. Put in what is there to start." : "Count what is there today."}
              >
                {number("stock", { step: "1", inputMode: "numeric", min: "0", placeholder: "0" })}
              </Field>
            )}

            <Field
              label="Warn me below"
              error={errors.lowStockThreshold}
              hint="Below this number the product shows as running low."
            >
              {number("lowStockThreshold", { step: "1", inputMode: "numeric", min: "0", placeholder: "15" })}
            </Field>
          </Row>
        </SectionCard>
      </form>
    </Page>
  );
}
