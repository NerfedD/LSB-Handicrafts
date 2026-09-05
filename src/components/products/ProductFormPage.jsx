import { useMemo, useState } from "react";

import { Info, Save } from "../icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mono } from "../shared/Chip";
import { InfoNote } from "../shared/Callout";
import {
  ChoiceButtons,
  Field,
  FormBand,
  FormFooter,
  PhotoSlot,
  Row,
} from "../shared/forms";
import { productChoiceIcon } from "../shared/productIcons";
import { PRODUCT_TYPE, PRODUCT_TYPE_OPTIONS, SELL_UNIT_OPTIONS } from "../../utils/constants";
import { suggestItemCode, suggestProductName } from "../../utils/productFormat";

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
 * screen collects both and the save handler in App.jsx writes both.
 */

const EMPTY = {
  productType: PRODUCT_TYPE.BALL,
  name: "",
  diameterIn: "",
  thicknessIn: "",
  lengthFt: "",
  widthFt: "",
  category: "",
  unitPrice: "",
  unit: "piece",
  packSize: "1",
  stock: "",
  lowStockThreshold: "",
};

const seed = (product, stock) => {
  if (!product) return EMPTY;
  return {
    productType: product.productType || PRODUCT_TYPE.OTHER,
    name: product.name ?? "",
    diameterIn: product.diameterIn ?? "",
    thicknessIn: product.thicknessIn ?? "",
    lengthFt: product.lengthFt ?? "",
    widthFt: product.widthFt ?? "",
    category: stock?.category ?? "",
    unitPrice: product.unitPrice ?? "",
    unit: product.unit || "piece",
    packSize: String(product.packSize ?? 1),
    stock: stock?.tracked ? String(stock.onHand) : "",
    lowStockThreshold: String(product.lowStockThreshold ?? stock?.threshold ?? ""),
  };
};

function validate(values) {
  const errors = {};
  if (!values.name.trim()) {
    errors.name = "Give it a name, so staff can find it.";
  }
  if (values.unitPrice === "" || Number(values.unitPrice) < 0) {
    errors.unitPrice = "Put in the price you sell it for. Use 0 if it is not for sale.";
  }
  if (values.productType === PRODUCT_TYPE.BALL && !values.diameterIn) {
    errors.diameterIn = "How wide across is it?";
  }
  if (
    (values.productType === PRODUCT_TYPE.SHEET || values.productType === PRODUCT_TYPE.BLOCK) &&
    !values.thicknessIn
  ) {
    errors.thicknessIn = "How thick is it?";
  }
  return errors;
}

export default function ProductFormPage({
  mode = "add",
  product,
  stock,
  /** Every item code already in use, so a generated one cannot collide. */
  takenCodes = [],
  saving = false,
  onSave,
  onCancel,
}) {
  const isEdit = mode === "edit";
  const [values, setValues] = useState(() => seed(isEdit ? product : null, stock));
  const [errors, setErrors] = useState({});

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
    if (isEdit && product?.itemCode) return product.itemCode;
    return suggestItemCode(
      {
        productType: values.productType,
        diameterIn: values.diameterIn,
        thicknessIn: values.thicknessIn,
      },
      takenCodes
    );
  }, [isEdit, product?.itemCode, values.productType, values.diameterIn, values.thicknessIn, takenCodes]);

  // Offered, never imposed: the suggestion keeps the catalogue from drifting
  // into a dozen naming styles, and staff can still overwrite it.
  const suggestedName = suggestProductName({
    productType: values.productType,
    diameterIn: values.diameterIn,
    thicknessIn: values.thicknessIn,
    lengthFt: values.lengthFt,
    widthFt: values.widthFt,
  });

  function handleSubmit(event) {
    event.preventDefault();
    const found = validate(values);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    onSave({ ...values, itemCode });
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

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="min-w-0">
        <FormBand step={1} title="What is it?">
          <Field
            label="Kind of product"
            hint="This decides which measurements we ask for next."
          >
            <ChoiceButtons
              label="Kind of product"
              value={values.productType}
              onChange={(next) => setField("productType", next)}
              className="sm:grid-cols-4"
              options={PRODUCT_TYPE_OPTIONS.map((option) => ({
                ...option,
                icon: productChoiceIcon(option.value),
              }))}
            />
          </Field>

          <Field
            label="Product name"
            required
            error={errors.name}
            hint={
              suggestedName && values.name !== suggestedName
                ? `Write it the way staff say it out loud. Suggestion: ${suggestedName}`
                : "Write it the way staff say it out loud."
            }
          >
            {(props) => (
              <Input
                {...props}
                value={values.name}
                onChange={(event) => setField("name", event.target.value)}
                placeholder={suggestedName || "Styro Ball 4 inch"}
              />
            )}
          </Field>

          {isBall && (
            <Row>
              <Field label="How wide across" required error={errors.diameterIn} hint="In inches.">
                {number("diameterIn", { step: "0.25", min: "0", placeholder: "4" })}
              </Field>
              <Field label="Category" hint="How it is grouped on the shelf.">
                {(props) => (
                  <Input
                    {...props}
                    value={values.category}
                    onChange={(event) => setField("category", event.target.value)}
                    placeholder="Styro Balls"
                  />
                )}
              </Field>
            </Row>
          )}

          {isFlat && (
            <>
              <Row>
                <Field label="How thick" required error={errors.thicknessIn} hint="In inches.">
                  {number("thicknessIn", { step: "0.25", min: "0", placeholder: "1" })}
                </Field>
                <Field label="Category" hint="How it is grouped on the shelf.">
                  {(props) => (
                    <Input
                      {...props}
                      value={values.category}
                      onChange={(event) => setField("category", event.target.value)}
                      placeholder="Styro Sheets"
                    />
                  )}
                </Field>
              </Row>
              <Row>
                <Field label="How long" hint="In feet.">
                  {number("lengthFt", { step: "0.5", min: "0", placeholder: "4" })}
                </Field>
                <Field label="How wide" hint="In feet.">
                  {number("widthFt", { step: "0.5", min: "0", placeholder: "2" })}
                </Field>
              </Row>
            </>
          )}

          {!isBall && !isFlat && (
            <Field label="Category" hint="How it is grouped on the shelf.">
              {(props) => (
                <Input
                  {...props}
                  value={values.category}
                  onChange={(event) => setField("category", event.target.value)}
                  placeholder="Custom shapes"
                />
              )}
            </Field>
          )}
        </FormBand>

        <FormBand step={2} title="How is it sold and counted?" tinted>
          <Row>
            <Field label="Price" required error={errors.unitPrice} hint="What one costs a customer.">
              {(props) => (
                <div className="relative">
                  <span
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[16px] font-bold text-muted"
                    aria-hidden="true"
                  >
                    ₱
                  </span>
                  <Input
                    {...props}
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    className="pl-10"
                    value={values.unitPrice}
                    onChange={(event) => setField("unitPrice", event.target.value)}
                    placeholder="0.00"
                  />
                </div>
              )}
            </Field>

            <Field label="Sold by" hint="How you count one of them at the counter.">
              {(props) => (
                <Select
                  value={values.unit}
                  onValueChange={(next) => setField("unit", next)}
                >
                  <SelectTrigger id={props.id} aria-describedby={props["aria-describedby"]}>
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
          </Row>

          {values.unit !== "piece" && (
            <Field
              label={`How many pieces in one ${values.unit}`}
              hint="So we can tell how many actual pieces are on the shelf."
            >
              {number("packSize", { step: "1", min: "1", placeholder: "25" })}
            </Field>
          )}

          <Row>
            <Field
              label="How many on the shelf now"
              hint="Count what is actually there today. You can correct it any time."
            >
              {number("stock", { step: "1", min: "0", placeholder: "0" })}
            </Field>

            <Field
              label="Warn me when it drops below"
              hint="Below this, it appears on the make list as running low."
            >
              {number("lowStockThreshold", { step: "1", min: "0", placeholder: "15" })}
            </Field>
          </Row>
        </FormBand>

        <FormFooter
          left={
            <Button variant="outline" size="lg" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
          }
          right={
            <Button type="submit" variant="cobalt" size="lg" disabled={saving}>
              <Save className="h-5 w-5" />
              {saving ? "Saving…" : isEdit ? "Save the changes" : "Save this product"}
            </Button>
          }
        />
      </Card>

      <div className="flex flex-col gap-4">
        <Card className="p-4">
          <PhotoSlot label="Product photo" hint="800 × 800" />
        </Card>

        <InfoNote icon={<Info className="h-5 w-5" />} title="The code is made for you">
          This one will be <Mono className="text-[14.5px] text-cobalt-deep">{itemCode}</Mono> — built
          from the kind and the size. You never have to invent a code, and two people adding
          the same product will not end up with two different ones.
        </InfoNote>
      </div>
    </form>
  );
}
