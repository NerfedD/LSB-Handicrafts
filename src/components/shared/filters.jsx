import { ChevronDown, Filter, Search, X } from "../icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { tone as toneOf } from "./tones";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * The filter row every list screen wears: a search field, some dropdowns, then
 * a row of counted chips.
 *
 * THE RULES THESE ENCODE, from the handoff:
 *
 *  - Chips are mutually exclusive within their row. It is a segmented filter,
 *    not a set of checkboxes, so exactly one is always on and "no filter" is a
 *    chip of its own ("All 148", "Everyone 312", "Everything 48").
 *  - Every chip carries its count, computed from the UNFILTERED set. That is
 *    the point of putting it there: nobody should apply a filter to discover
 *    it was empty.
 *  - Dropdowns are independent and combine with the active chip.
 *  - A control that prints its own label ("Kind: All") does not need a
 *    separate label above it, and reads as a filter rather than as a field
 *    somebody could type into.
 */

/**
 * The list search box: a leading 20px icon, and a clear button once used.
 *
 * IT IS THE `Input` PRIMITIVE, not a field that looks like one. This used to
 * hand-copy `fieldBase` — the same border, radius, hover, focus ring and
 * placeholder colour, written out a second time — and had already drifted two
 * pixels short: `h-13` where every other field in the app is `h-13.5`. So the
 * search box on all five list screens was 52px while the fields on every form
 * were 54px, which is exactly the sort of difference nobody can name and
 * everybody can see. Copying the styling was what made the drift possible;
 * importing it is what stops it happening again.
 */
export function SearchField({
  value,
  onChange,
  placeholder,
  className,
  id = "list-search",
}) {
  const hasQuery = String(value ?? "").trim() !== "";
  return (
    <div className={cn("relative min-w-[280px] flex-1", className)}>
      <Search
        className="pointer-events-none absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
      <Input
        id={id}
        type="search"
        hasLeadingIcon
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        // The native clear affordance is hidden because there is a labelled
        // one beside it, and two clear buttons in one field is a guess.
        className="pr-12 [&::-webkit-search-cancel-button]:hidden"
      />
      {hasQuery && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onChange("")}
          aria-label="Clear the search box"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
        >
          <X className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}

/**
 * "Kind: All ⌄" — a filter dropdown that names what it filters.
 *
 * The label is 500-weight muted and the value 700-weight ink, so the value is
 * what the eye lands on while the label stays available to anyone who needs to
 * know what the control does.
 */
export function FilterSelect({ label, value, onChange, options, className }) {
  const current = options.find((o) => o.value === value);
  return (
    <Select value={value} onValueChange={onChange}>
      {/* No height override: the trigger keeps the primitive's 54px, so the
          dropdown and the search box beside it are the same control height.
          This used to force `h-13` and sit 2px shorter than every other
          field. */}
      <SelectTrigger
        aria-label={label}
        className={cn("w-auto gap-2.5 px-4 text-[15.5px] font-bold", className)}
      >
        <span className="flex items-center gap-2 truncate">
          <span className="font-medium text-muted">{label}:</span>
          <SelectValue>{current?.label ?? value}</SelectValue>
        </span>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * The segmented chip row.
 *
 * `chips` is [{ value, label, count, tone }]. The selected chip inverts to a
 * solid ink fill with white text — in dark mode it inverts the other way, to
 * near-white with ink text, because a dark fill on a dark surface is not a
 * selection.
 *
 * Rendered as a radiogroup rather than a row of buttons: it IS a single choice
 * among several, and saying so is what lets arrow keys move between them.
 */
export function FilterChips({ chips, value, onChange, label = "Filter", className }) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("flex flex-wrap gap-2.5", className)}
    >
      {chips.map((chip) => {
        const selected = chip.value === value;
        const t = toneOf(chip.tone ?? "neutral");
        const showDot = Boolean(chip.tone) && chip.tone !== "neutral";

        return (
          <button
            key={chip.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(chip.value)}
            className={cn(
              "inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-full border-[1.5px] px-4.5 text-[15px] font-bold transition duration-150",
              // `ink` and `surface` are theme roles, so the inversion states
              // itself: the chip fills with the text colour and prints in the
              // surface colour, which is dark-on-light in either theme without
              // a dark: variant restating all three.
              selected
                ? "border-ink bg-ink text-surface"
                : showDot
                  ? cn(t.tint, t.border, t.pillText, "hover:brightness-[0.97]")
                  : "border-chip bg-surface text-ink hover:bg-wash"
            )}
          >
            {showDot && (
              <span
                className={cn(
                  "size-2.5 shrink-0 rounded-full",
                  selected ? "bg-surface" : t.dot
                )}
                aria-hidden="true"
              />
            )}
            {chip.label}
            {chip.count !== undefined && chip.count !== null && (
              <span className="tabular-nums">{chip.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * "Showing deliveries due today · all of Davao · any driver" + one Clear.
 *
 * Worth its own element on the deliveries board, where three dropdowns and a
 * chip can silently combine into a confusing empty board. It states the
 * combined filter in a sentence, with the parts in bold, and offers one action
 * that resets everything — so nobody has to reverse three controls one at a
 * time to work out why nothing is showing.
 */
export function ActiveFilterSummary({ parts, onClear, className }) {
  const shown = parts.filter(Boolean);
  if (shown.length === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-field bg-tint-cobalt px-4 py-3",
        className
      )}
    >
      <Filter className="h-5 w-5 shrink-0 text-cobalt dark:text-dk-cobalt" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-[15.5px] leading-[1.45] text-ink-2">
        Showing{" "}
        {shown.map((part, index) => (
          <span key={part}>
            {index > 0 && <span className="text-muted"> · </span>}
            <strong className="font-extrabold text-ink">{part}</strong>
          </span>
        ))}
      </p>
      {onClear && (
        <Button
          variant="outline"
          size="sm"
          onClick={onClear}
          className="border-cobalt/30 bg-transparent text-cobalt-deep"
        >
          <X className="h-4.5 w-4.5" />
          Clear filters
        </Button>
      )}
    </div>
  );
}

/**
 * The pager under a list: "Showing 1–6 of 148 products" and two buttons.
 *
 * Both buttons always render, and the unavailable one is disabled rather than
 * hidden — a control that disappears at the end of a list makes the row jump,
 * and its absence is not an explanation.
 *
 * They are `Button`s at the 44px tap-target floor, like every other secondary
 * control in the app. They used to be a hand-rolled 46px, which was a fourth
 * interactive height answering to nothing.
 */
export function Pager({ from, to, total, noun, onPrevious, onNext, className }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      <p className="text-[15px] text-muted">
        {total === 0
          ? `No ${noun} to show`
          : `Showing ${from}–${to} of ${total} ${noun}`}
      </p>
      <div className="flex gap-2.5">
        <Button variant="outline" size="sm" onClick={onPrevious} disabled={!onPrevious}>
          <ChevronLeftIcon />
          Previous
        </Button>
        <Button variant="outline" size="sm" onClick={onNext} disabled={!onNext}>
          Next
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  );
}

// Kept local so Pager's two glyphs don't pull two more names into every file
// that imports from here.
function ChevronLeftIcon() {
  return <ChevronDown className="h-4.5 w-4.5 rotate-90" aria-hidden="true" />;
}
function ChevronRightIcon() {
  return <ChevronDown className="h-4.5 w-4.5 -rotate-90" aria-hidden="true" />;
}
