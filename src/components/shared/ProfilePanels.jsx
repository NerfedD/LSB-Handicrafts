import { AlertCircle, CheckCircle2, ChevronLeft, Search } from "../icons";
import { primaryButton, secondaryButton } from "./profileButtonStyles";

/**
 * The full-card states the profile screens share: an empty/no-results panel
 * (Figma 169:901, 167:380), a "record not found" panel (169:766, 174:3247),
 * and the post-save success panel (171:1676, 184:6214).
 *
 * All three are the same white card with a circled icon, a heading, a line of
 * copy and one or two buttons — kept together so the spacing stays identical.
 */

function Panel({ children }) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-[#17263a14] bg-white px-8 py-16 text-center shadow-[0_1px_4px_rgba(23,38,58,0.05)]">
      {children}
    </div>
  );
}

function Circle({ children, tone = "muted" }) {
  const tones = {
    muted: "bg-[#17263a0a] text-[#5f6875]",
    success: "bg-[#287a5517] text-[#287a55]",
  };
  return (
    <div
      className={`mb-5 flex size-12 items-center justify-center rounded-full ${tones[tone]}`}
    >
      {children}
    </div>
  );
}

/**
 * Covers both the never-populated case ("No customer records yet" + Add) and
 * the filtered-to-nothing case ("No customers found" + Clear Search). Which
 * one shows is decided by the caller passing `query`.
 */
export function ProfileEmptyState({
  icon,
  title,
  description,
  query,
  onClearSearch,
  addLabel,
  onAdd,
}) {
  const isSearch = Boolean(query);

  return (
    <Panel>
      <Circle>{isSearch ? <Search className="h-5 w-5" /> : icon}</Circle>
      <p className="text-[19px] font-bold tracking-tight text-[#17263a]">
        {isSearch ? `No ${title} found` : `No ${title} records yet`}
      </p>
      <p className="mt-1.5 max-w-[340px] text-[13.5px] leading-relaxed text-[#5f6875]">
        {isSearch ? (
          <>
            No records match &ldquo;<span className="font-semibold">{query}</span>&rdquo;.
          </>
        ) : (
          description
        )}
      </p>
      <div className="mt-5">
        {isSearch ? (
          <button type="button" onClick={onClearSearch} className={secondaryButton}>
            Clear Search
          </button>
        ) : (
          <button type="button" onClick={onAdd} className={primaryButton}>
            {addLabel}
          </button>
        )}
      </div>
    </Panel>
  );
}

/** Shown when a detail screen is opened for a record that no longer exists. */
export function ProfileNotFound({ label, onBack }) {
  return (
    <Panel>
      <Circle>
        <AlertCircle className="h-5 w-5" />
      </Circle>
      <p className="text-[19px] font-bold tracking-tight text-[#17263a]">
        {label} Record Not Found
      </p>
      <p className="mt-1.5 text-[13.5px] text-[#5f6875]">
        The {label.toLowerCase()} information could not be loaded.
      </p>
      <button type="button" onClick={onBack} className={`${secondaryButton} mt-5`}>
        <ChevronLeft className="h-3.5 w-3.5" />
        Back to {label} List
      </button>
    </Panel>
  );
}

/** Shown after a successful save, in place of the form. */
export function ProfileSaved({ label, onView, onBackToList }) {
  return (
    <Panel>
      <Circle tone="success">
        <CheckCircle2 className="h-6 w-6" />
      </Circle>
      <p className="text-[22px] font-bold tracking-tight text-[#17263a]">
        {label} profile saved successfully.
      </p>
      <p className="mt-1.5 text-[13.5px] text-[#5f6875]">
        The {label.toLowerCase()} information has been added to the system.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={onView} className={primaryButton}>
          View {label}
        </button>
        <button type="button" onClick={onBackToList} className={secondaryButton}>
          Back to {label} List
        </button>
      </div>
    </Panel>
  );
}
