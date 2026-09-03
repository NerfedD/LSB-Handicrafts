import { AlertCircle, CheckCircle2, ChevronLeft, Search } from "../icons";
import { primaryButton, secondaryButton } from "./profileButtonStyles";
import { Card } from "@/components/ui/card";

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
    <Card clip={false} className="flex min-h-[280px] flex-col items-center justify-center px-8 py-16 text-center">
      {children}
    </Card>
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
 * Shown while the first read is still in flight.
 *
 * Without this the lists rendered ProfileEmptyState during loading, telling the
 * user "No customer records yet" over a table that was about to arrive. A
 * skeleton says "wait", an empty state says "there is nothing" -- they are not
 * interchangeable, and the loading flag to tell them apart already existed and
 * was simply never used.
 */
export function ProfileLoadingState({ rows = 5 }) {
  return (
    <Card aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading records…</span>
      <div className="h-11 border-b border-[#17263a0f] bg-[#fafaf8]" />
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-[#17263a0f] px-7 py-4 last:border-b-0"
        >
          <div className="size-9 animate-pulse rounded-full bg-[#17263a0f]" />
          <div className="h-4 w-1/4 animate-pulse rounded bg-[#17263a0f]" />
          <div className="h-4 w-1/5 animate-pulse rounded bg-[#17263a0a]" />
          <div className="ml-auto h-4 w-16 animate-pulse rounded bg-[#17263a0a]" />
        </div>
      ))}
    </Card>
  );
}

/**
 * Shown when the read itself failed.
 *
 * A failed read and an empty table used to be indistinguishable and permanent:
 * the hook swallowed the error, left the list empty, and offered no way to try
 * again short of reloading the page.
 */
export function ProfileErrorState({ onRetry }) {
  return (
    <Panel>
      <Circle>
        <AlertCircle className="h-5 w-5" />
      </Circle>
      <p className="text-[19px] font-bold tracking-tight text-[#17263a]">
        Couldn&rsquo;t load these records
      </p>
      <p className="mt-2 max-w-[340px] text-[13.5px] leading-relaxed text-[#5f6875]">
        The database couldn&rsquo;t be reached. Check your connection and try
        again.
      </p>
      <div className="mt-5">
        <button type="button" onClick={onRetry} className={primaryButton}>
          Try Again
        </button>
      </div>
    </Panel>
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
      <p className="mt-2 max-w-[340px] text-[13.5px] leading-relaxed text-[#5f6875]">
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
      <p className="mt-2 text-[13.5px] text-[#5f6875]">
        The {label.toLowerCase()} information could not be loaded.
      </p>
      <button type="button" onClick={onBack} className={`${secondaryButton} mt-5`}>
        <ChevronLeft className="h-4 w-4" />
        Back to {label} List
      </button>
    </Panel>
  );
}

/** Shown after a successful save, in place of the form. */
