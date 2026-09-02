import { AlertCircle, ChevronLeft } from "../icons";
import { primaryButton, secondaryButton } from "./profileButtonStyles";
import { Card } from "@/components/ui/card";

/**
 * The add/edit form card shared by Customer, Product and Supplier
 * (Figma 171:1211 for the card, 171:1438 for the error state).
 *
 * Layout is a two-column grid; a field spans both columns with `wide`. Errors
 * are per-field strings keyed by field name, matching what the validate()
 * helpers in each form page return.
 */

const inputBase =
  "h-11 w-full rounded-lg border bg-[#fafaf8] px-3.5 text-[14.5px] text-[#17263a] outline-none transition placeholder:text-[#17263a]/50 focus:ring-2";
const inputNormal =
  "border-[#17263a26] focus:border-[#1746d1] focus:ring-[#1746d1]/20";
const inputError = "border-[#b54747] focus:border-[#b54747] focus:ring-[#b54747]/20";

/** Back link above the card, e.g. "‹ Customer Profiles". */
export function FormBackLink({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-[22px] flex items-center gap-1.5 text-[13.5px] font-medium text-[#5f6875] transition hover:text-[#17263a]"
    >
      <ChevronLeft className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

/**
 * Label + control + error message.
 *
 * The control is nested inside the <label> rather than tied to it by id, so
 * every field is labelled without each caller having to invent and thread a
 * unique id through to its input.
 */
export function FormField({ label, required, error, wide, hint, children }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label className="block">
        <span className="block text-[13px] font-semibold tracking-[0.13px] text-[#17263a]">
          {label}
          {required && <span className="text-[#b54747]"> *</span>}
        </span>
        <span className="block pt-[7px]">{children}</span>
      </label>
      {hint && !error && (
        <p className="pt-1.5 text-[12px] text-[#5f6875]">{hint}</p>
      )}
      {error && (
        <p className="flex items-center gap-1.5 pt-1.5 text-[12px] text-[#b54747]">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

export function TextInput({ error, ...props }) {
  return (
    <input
      {...props}
      aria-invalid={error ? true : undefined}
      className={`${inputBase} ${error ? inputError : inputNormal}`}
    />
  );
}

export function SelectInput({ error, children, ...props }) {
  return (
    <select
      {...props}
      aria-invalid={error ? true : undefined}
      className={`${inputBase} ${error ? inputError : inputNormal}`}
    >
      {children}
    </select>
  );
}

export function TextAreaInput({ error, ...props }) {
  return (
    <textarea
      {...props}
      rows={3}
      aria-invalid={error ? true : undefined}
      className={`w-full resize-y rounded-lg border bg-[#fafaf8] px-3.5 py-3 text-[14.5px] leading-[23px] text-[#17263a] outline-none transition placeholder:text-[#17263a]/50 focus:ring-2 ${
        error ? inputError : inputNormal
      }`}
    />
  );
}

/**
 * The card itself. `icon` sits in the tinted tile beside the heading;
 * `onSubmit` is wired to the form element so Enter saves.
 */
export default function ProfileFormCard({
  icon,
  heading,
  saveLabel,
  onSubmit,
  onCancel,
  children,
  // True while the write is in flight. Saving is a real round-trip now that
  // it's one awaited row rather than a fire-and-forget whole-table upsert, so
  // the buttons have to stop a second submit creating a duplicate record.
  saving = false,
}) {
  return (
    <form onSubmit={onSubmit} noValidate>
      <Card>
        <div className="flex items-center gap-3.5 border-b border-[#17263a12] px-8 pb-5 pt-6">
          <div className="flex size-[38px] shrink-0 items-center justify-center rounded-[9px] bg-[#1746d114] text-[#1746d1]">
            {icon}
          </div>
          <div>
            <h2 className="text-[16px] font-bold tracking-[-0.16px] text-[#17263a]">
              {heading}
            </h2>
            <p className="text-[12.5px] text-[#5f6875]">
              Fields marked with <span className="text-[#b54747]">*</span> are
              required.
            </p>
          </div>
        </div>

        <div className="px-8 pb-8 pt-7">
          <div className="grid grid-cols-1 gap-x-6 gap-y-[22px] sm:grid-cols-2">
            {children}
          </div>

          <div className="mt-7 h-px w-full bg-[#17263a12]" />

          <div className="flex justify-end gap-3 pt-6">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className={`${secondaryButton} h-11 rounded-[9px] px-[22px] text-[14.5px] disabled:opacity-60`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`${primaryButton} h-11 rounded-[9px] px-7 text-[14.5px] disabled:opacity-60`}
            >
              {saving ? "Saving…" : saveLabel}
            </button>
          </div>
        </div>
      </Card>

      <p className="pl-1 pt-4 text-[12px] text-[#5f6875]/65">
        <span className="text-[#b54747]">*</span> Required fields
      </p>
    </form>
  );
}
