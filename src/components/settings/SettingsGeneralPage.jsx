import { useState } from "react";

import logo from "../../assets/Logo-128.png";
import { FloppyDisk, Gear, Plus, X } from "../icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import FormError from "../shared/FormError";
import { Field } from "../shared/forms";
import { Page, PageHeader } from "../shared/page";
import { LoadingState } from "../shared/PageStates";
import { SettingsSection } from "./SettingsParts";
import { roundMoney } from "../../utils/money";
import { formatShortDate } from "../../utils/profileFormat";

/**
 * Settings · General, drawn to the "8 · Settings · General" board: business
 * details, money and numbering, delivery, and working hours.
 *
 * Saved to public.business_settings, one row an administrator changes. What
 * it feeds:
 *   - the letterhead of the order slip, delivery slip and run sheet (name,
 *     address, phone, TIN), and the "VAT included" line on the order slip;
 *   - the delivery charge a new order starts with, and the order total from
 *     which delivery is free.
 * The logo, currency and order numbering are drawn but stay fixed: the app has
 * one logo file, sells in pesos and lets the database number its orders.
 */
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const fromSettings = (s) => ({
  businessName: s?.businessName ?? "LSB Handicrafts",
  tin: s?.tin ?? "",
  phone: s?.phone ?? "",
  email: s?.email ?? "",
  address: s?.address ?? "",
  vatRegistered: !!s?.vatRegistered,
  deliveryFee: s?.deliveryFee == null ? "" : String(s.deliveryFee),
  freeDeliveryFrom: s?.freeDeliveryFrom == null ? "" : String(s.freeDeliveryFrom),
  deliveryAreas: s?.deliveryAreas ?? [],
  openDays: s?.openDays ?? [],
  opensAt: s?.opensAt ?? "",
  closesAt: s?.closesAt ?? "",
});

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Field problems, said beside the field. The database checks each again. */
function problemsOf(v) {
  const out = {};
  const money = (value, { allowZero }) => {
    if (value === "") return null;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || (!allowZero && n === 0)) return allowZero ? "Use 0 or more." : "Use an amount above 0, or leave it empty.";
    if (roundMoney(n) !== n) return "Use at most two decimal places.";
    return null;
  };
  if (!v.businessName.trim()) out.businessName = "The business needs a name.";
  else if (v.businessName.trim().length > 120) out.businessName = "Keep the name to 120 characters.";
  if (v.tin.trim() && !/^\d{3}-?\d{3}-?\d{3}(-?\d{3,5})?$/.test(v.tin.trim())) out.tin = "Write the TIN as 123-456-789-000.";
  if (v.phone.trim() && (v.phone.trim().length < 7 || v.phone.trim().length > 40)) out.phone = "Write the number as it is dialled.";
  if (v.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) out.email = "That is not an email address.";
  if (v.address.trim().length > 300) out.address = "Keep the address to 300 characters.";
  const fee = money(v.deliveryFee, { allowZero: true });
  if (fee) out.deliveryFee = fee;
  const free = money(v.freeDeliveryFrom, { allowZero: false });
  if (free) out.freeDeliveryFrom = free;
  if (v.opensAt && v.closesAt && v.opensAt >= v.closesAt) out.closesAt = "Closing has to be after opening.";
  return out;
}

export default function SettingsGeneralPage({ settings, isLoaded = true, onSave }) {
  const [values, setValues] = useState(() => fromSettings(settings));
  const [base, setBase] = useState(() => fromSettings(settings));
  const [seenRevision, setSeenRevision] = useState(settings?.revision ?? null);
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [newArea, setNewArea] = useState("");

  // The row arriving (or changing under us after a save) resets the form,
  // unless somebody is part way through an edit.
  const incoming = settings?.revision ?? null;
  if (incoming !== seenRevision) {
    setSeenRevision(incoming);
    if (same(values, base)) setValues(fromSettings(settings));
    setBase(fromSettings(settings));
  }

  if (!isLoaded) return <LoadingState noun="settings" />;

  const dirty = !same(values, base);
  const set = (field, value) => {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => (previous[field] ? { ...previous, [field]: undefined } : previous));
  };
  const toggleDay = (day) => set("openDays", values.openDays.includes(day)
    ? values.openDays.filter((d) => d !== day)
    : DAYS.filter((d) => d === day || values.openDays.includes(d)));
  const addArea = () => {
    const name = newArea.trim().replace(/\s+/g, " ");
    if (!name) return;
    if (!values.deliveryAreas.some((area) => area.toLowerCase() === name.toLowerCase())) {
      set("deliveryAreas", [...values.deliveryAreas, name].sort((a, b) => a.localeCompare(b)));
    }
    setNewArea("");
  };

  async function save() {
    if (saving || !settings) return;
    setSaveError(null);
    const found = problemsOf(values);
    setErrors(found);
    if (Object.keys(found).length) {
      setSaveError(Object.keys(found).length === 1 ? Object.values(found)[0] : `Check the ${Object.keys(found).length} fields marked below.`);
      return;
    }
    setSaving(true);
    try {
      const result = await onSave({ ...values, revision: settings.revision });
      if (!result?.ok) setSaveError(result?.message || "The settings were not saved. Try again.");
    } catch {
      setSaveError("We could not reach the system, so nothing was saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page>
      <PageHeader
        icon={Gear}
        title="General"
        description="How the business appears on order slips and delivery sheets, and the defaults new orders start with."
        actions={
          <>
            <Button variant="outline" disabled={!dirty || saving} onClick={() => { setValues(base); setErrors({}); setSaveError(null); }}>Discard</Button>
            <Button disabled={!dirty || saving} onClick={save}>
              <FloppyDisk aria-hidden="true" />
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </>
        }
      />

      <FormError message={saveError} />
      {settings?.updatedBy && settings?.updatedAt ? (
        <p className="m-0 text-13 text-muted-fg">Last changed by {settings.updatedBy} on {formatShortDate(settings.updatedAt)}.</p>
      ) : null}

      <SettingsSection id="sg-biz" title="Business details" description="Printed at the head of order slips, delivery slips and run sheets.">
        <div className="mb-4 flex items-center gap-3">
          <img src={logo} alt="Current LSB Handicrafts logo" className="size-12 rounded-lg object-cover" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">Logo</div>
            <div className="text-13 text-muted-fg">Fixed in the app. Ask whoever maintains it to change the file.</div>
          </div>
          <Button variant="outline" size="sm" disabled>Replace</Button>
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Business name" required error={errors.businessName}>
            {(props) => <Input {...props} maxLength={120} value={values.businessName} onChange={(e) => set("businessName", e.target.value)} />}
          </Field>
          <Field label="TIN" error={errors.tin} hint="Printed on slips when filled in.">
            {(props) => <Input {...props} value={values.tin} onChange={(e) => set("tin", e.target.value)} placeholder="123-456-789-000" />}
          </Field>
          <Field label="Phone" error={errors.phone} hint="The number customers ring. Printed on every slip.">
            {/* Plain text, not the app's phone field: that keeps digits only, for
                staff mobiles, and this is printed exactly as written. */}
            {(props) => <Input {...props} autoComplete="tel" value={values.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(082) 123 4567" />}
          </Field>
          <Field label="Email" error={errors.email}>
            {(props) => <Input {...props} type="email" value={values.email} onChange={(e) => set("email", e.target.value)} placeholder="office@example.com" />}
          </Field>
          <Field label="Workshop address" className="sm:col-span-2" error={errors.address} hint="Printed under the name on slips.">
            {(props) => <Textarea {...props} rows={2} maxLength={300} value={values.address} onChange={(e) => set("address", e.target.value)} placeholder="Street, barangay, Davao City" />}
          </Field>
        </div>
      </SettingsSection>

      <SettingsSection id="sg-money" title="Money and numbering" description="Tax on slips and how order numbers count up.">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <label htmlFor="sg-vat" className="block text-sm font-medium">VAT registered</label>
            <span className="block text-13 text-muted-fg">Order slips show the 12% VAT inside the price.</span>
          </div>
          <Switch id="sg-vat" checked={values.vatRegistered} onCheckedChange={(next) => set("vatRegistered", !!next)} />
        </div>
        <div className="grid gap-3.5 sm:grid-cols-3">
          <Field label="Currency">
            {(props) => (
              <NativeSelect {...props} disabled defaultValue="php">
                <option value="php">₱ Philippine peso</option>
              </NativeSelect>
            )}
          </Field>
          <Field label="Order numbers start with">{(props) => <Input {...props} disabled defaultValue="#" />}</Field>
          <Field label="Next order number" hint="The database numbers orders itself.">{(props) => <Input {...props} disabled placeholder="Automatic" />}</Field>
        </div>
      </SettingsSection>

      <SettingsSection id="sg-del" title="Delivery" description="What new orders charge for delivery, and the areas drivers cover.">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Delivery fee" error={errors.deliveryFee} hint="New orders start with this. Each order can still change it.">
            {(props) => <Input {...props} type="number" inputMode="decimal" step="any" min="0" value={values.deliveryFee} onChange={(e) => set("deliveryFee", e.target.value)} placeholder="Set per order" />}
          </Field>
          <Field label="Free delivery from" error={errors.freeDeliveryFrom} hint="When the items come to this or more, delivery is free.">
            {(props) => <Input {...props} type="number" inputMode="decimal" step="any" min="0" value={values.freeDeliveryFrom} onChange={(e) => set("freeDeliveryFrom", e.target.value)} placeholder="Not set" />}
          </Field>
        </div>
        <div className="mt-4 flex flex-col gap-1.5">
          <span className="text-sm font-medium" id="sg-areas">Areas we deliver to</span>
          <div className="flex flex-wrap items-center gap-1.5" aria-labelledby="sg-areas">
            {values.deliveryAreas.length === 0 ? <Badge variant="outline">No areas recorded</Badge> : null}
            {values.deliveryAreas.map((area) => (
              <Badge key={area} variant="outline" className="gap-1">
                {area}
                <button type="button" aria-label={`Remove ${area}`} className="inline-flex border-0 bg-transparent p-0 text-muted-fg hover:text-foreground" onClick={() => set("deliveryAreas", values.deliveryAreas.filter((a) => a !== area))}>
                  <X className="size-3" aria-hidden="true" />
                </button>
              </Badge>
            ))}
            <Input
              aria-label="New area"
              value={newArea}
              onChange={(e) => setNewArea(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addArea(); } }}
              placeholder="Matina"
              className="h-6 w-32 text-xs"
              maxLength={60}
            />
            <Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={addArea} disabled={!newArea.trim()}>
              <Plus aria-hidden="true" />
              Add area
            </Button>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection id="sg-hours" title="Working hours" description="When the workshop is open, for the people answering the phone.">
        <div className="flex flex-wrap items-end gap-4">
          <div role="group" aria-label="Open days" className="inline-flex gap-1">
            {DAYS.map((day) => {
              const on = values.openDays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleDay(day)}
                  className={on
                    ? "h-7 rounded-md border border-primary bg-primary px-2.5 text-13 font-medium text-on-primary"
                    : "h-7 rounded-md border border-border bg-card px-2.5 text-13 font-medium text-foreground hover:bg-surface-2"}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <div className="flex items-end gap-2">
            <Field label="Opens at">{(props) => <Input {...props} type="time" value={values.opensAt} onChange={(e) => set("opensAt", e.target.value)} className="w-32" />}</Field>
            <span className="pb-1.5 text-13 text-muted-fg">to</span>
            <Field label="Closes at" error={errors.closesAt}>{(props) => <Input {...props} type="time" value={values.closesAt} onChange={(e) => set("closesAt", e.target.value)} className="w-32" />}</Field>
          </div>
        </div>
      </SettingsSection>
    </Page>
  );
}
