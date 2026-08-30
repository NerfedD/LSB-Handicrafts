import { ChevronLeft } from "../icons";
import { primaryButton, secondaryButton } from "./profileButtonStyles";

/**
 * The record-detail furniture shared by the Customer, Product and Supplier
 * detail screens (Figma 169:533, 174:3021, 184:4992): a back link, a header
 * card carrying the record's identity and its two actions, then one or more
 * labelled info cards.
 */

/** "‹ Customer Profiles" above the header card. */
export function DetailBackLink({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-4 flex items-center gap-1.5 text-[13.5px] font-medium text-[#5f6875] transition hover:text-[#17263a]"
    >
      <ChevronLeft className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

/**
 * `badge` is the identity chip on the left — an initials avatar for people,
 * a tinted icon tile for products and suppliers.
 */
export function DetailHeaderCard({
  badge,
  eyebrow,
  title,
  meta,
  editLabel,
  onEdit,
  backLabel,
  onBack,
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-5 rounded-xl border border-[#17263a14] bg-white px-7 py-6 shadow-[0_1px_4px_rgba(23,38,58,0.05)]">
      <div className="flex min-w-0 items-center gap-4">
        {badge}
        <div className="min-w-0">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.945px] text-[#5f6875]">
            {eyebrow}
          </p>
          <h2 className="mt-0.5 truncate text-[24px] font-bold tracking-[-0.48px] text-[#17263a]">
            {title}
          </h2>
          {meta && <div className="mt-1 text-[13px] text-[#5f6875]">{meta}</div>}
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-2.5">
        <button type="button" onClick={onEdit} className={primaryButton}>
          {editLabel}
        </button>
        <button type="button" onClick={onBack} className={secondaryButton}>
          {backLabel}
        </button>
      </div>
    </div>
  );
}

/** A white card with a tinted icon tile, a title, and a hairline under it. */
export function DetailCard({ icon, title, children, className = "" }) {
  return (
    <div
      className={`rounded-xl border border-[#17263a14] bg-white px-7 pb-7 pt-6 shadow-[0_1px_4px_rgba(23,38,58,0.05)] ${className}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#1746d114] text-[#1746d1]">
          {icon}
        </div>
        <h3 className="text-[14px] font-bold tracking-[-0.14px] text-[#17263a]">
          {title}
        </h3>
      </div>
      <div className="mt-4 border-t border-[#17263a12] pt-5">{children}</div>
    </div>
  );
}

/** Uppercase label over its value — the repeating unit inside a DetailCard. */
export function DetailField({ label, children }) {
  return (
    <div className="min-w-0">
      <p className="text-[10.5px] font-bold uppercase tracking-[0.945px] text-[#5f6875]">
        {label}
      </p>
      <div className="mt-1 break-words text-[14.5px] text-[#17263a]">
        {children || "—"}
      </div>
    </div>
  );
}
