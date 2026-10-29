import logo from "../../assets/Logo-128.png";
import { FloppyDisk, Gear, Plus } from "../icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Field } from "../shared/forms";
import { Page, PageHeader } from "../shared/page";
import { NotStoredYet, SettingsSection } from "./SettingsParts";
import { OFFICE_PHONE, OFFICE_PHONE_IS_PLACEHOLDER } from "../../utils/office";

/**
 * Settings · General, drawn to the "8 · Settings · General" board: business
 * details, money and numbering, delivery, and working hours.
 *
 * The app has no table for any of this, so every control is disabled and
 * shows what the app actually uses today (the business name, the office
 * phone) or nothing. Nothing pretends to save.
 */
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function SettingsGeneralPage() {
  return (
    <Page>
      <PageHeader
        icon={Gear}
        title="General"
        description="How the business appears on receipts and order slips, and the defaults new orders start with."
        actions={
          <>
            <Button variant="outline" disabled>Discard</Button>
            <Button disabled>
              <FloppyDisk aria-hidden="true" />
              Save changes
            </Button>
          </>
        }
      />

      <NotStoredYet>
        These settings have no place in the database yet. They show what the app uses today; changing them needs a backend first.
      </NotStoredYet>

      <SettingsSection id="sg-biz" title="Business details" description="Printed on receipts, order slips and delivery run sheets.">
        <div className="mb-4 flex items-center gap-3">
          <img src={logo} alt="Current LSB Handicrafts logo" className="size-12 rounded-lg object-cover" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">Logo</div>
            <div className="text-13 text-muted-fg">Square PNG or JPG, at least 256 × 256</div>
          </div>
          <Button variant="outline" size="sm" disabled>Replace</Button>
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Business name">{(props) => <Input {...props} disabled defaultValue="LSB Handicrafts" />}</Field>
          <Field label="TIN">{(props) => <Input {...props} disabled placeholder="Not recorded" />}</Field>
          <Field label="Phone" hint={OFFICE_PHONE_IS_PLACEHOLDER ? "A placeholder until the office number is set up." : undefined}>
            {(props) => <Input {...props} disabled defaultValue={OFFICE_PHONE} />}
          </Field>
          <Field label="Email">{(props) => <Input {...props} disabled placeholder="Not recorded" />}</Field>
          <Field label="Workshop address" className="sm:col-span-2">
            {(props) => <Textarea {...props} disabled rows={2} placeholder="Not recorded" />}
          </Field>
        </div>
      </SettingsSection>

      <SettingsSection id="sg-money" title="Money and numbering" description="Tax on receipts and how order numbers count up.">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <label htmlFor="sg-vat" className="block text-sm font-medium">VAT registered</label>
            <span className="block text-13 text-muted-fg">Receipts show 12% VAT inside the price.</span>
          </div>
          <Switch id="sg-vat" disabled />
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
          <Field label="Delivery fee" hint="Each order sets its own fee today.">{(props) => <Input {...props} disabled placeholder="₱ set per order" />}</Field>
          <Field label="Free delivery from">{(props) => <Input {...props} disabled placeholder="Not set" />}</Field>
        </div>
        <div className="mt-4 flex flex-col gap-1.5">
          <span className="text-sm font-medium">Areas we deliver to</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">No areas recorded</Badge>
            <Button variant="outline" size="sm" disabled className="h-6 px-2 text-xs">
              <Plus aria-hidden="true" />
              Add area
            </Button>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection id="sg-hours" title="Working hours" description="Deliveries and pick-ups can only be booked inside these hours.">
        <div className="flex flex-wrap items-end gap-4">
          <div role="group" aria-label="Open days" className="inline-flex gap-1">
            {DAYS.map((day) => (
              <button key={day} type="button" disabled aria-pressed={false} className="h-7 rounded-md border border-border bg-card px-2.5 text-13 font-medium text-foreground disabled:opacity-60">
                {day}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <Field label="Opens at">{(props) => <Input {...props} disabled placeholder="Not set" className="w-28" />}</Field>
            <span className="pb-1.5 text-13 text-muted-fg">to</span>
            <Field label="Closes at">{(props) => <Input {...props} disabled placeholder="Not set" className="w-28" />}</Field>
          </div>
        </div>
      </SettingsSection>
    </Page>
  );
}
