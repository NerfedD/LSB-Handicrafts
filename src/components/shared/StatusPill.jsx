import { Check, Clock, X } from "../icons";
import { cn } from "@/lib/utils";
import { tone as toneOf } from "./tones";

/**
 * The app's one status chip.
 *
 * There were six. `StatusPill`, a private `StatusBadge` copied into three
 * screens, and inline copies in two more — and the inline pair carried a real
 * bug: they were hardcoded to the green "Active" palette and printed
 * `profile.status` beside it, so a blocked user looking at their own profile
 * saw a green chip reading "Blocked". Deriving the tone from the state, in one
 * place, is what fixes that.
 *
 * The overhaul changes what a pill SAYS as much as how it looks. Status is
 * spelled out as an answer to a question rather than as a category: not
 * "Status: Active" but "Can sign in: Yes", not "LOW" but "Running low". The
 * mapping from stored value to those words lives in utils/copy.js; this
 * component only paints.
 *
 * A leading mark is not decoration either. Colour alone is not a distinction
 * for someone who cannot separate the amber chip from the green one, so every
 * pill that means a state carries a dot or a glyph as well.
 */

const MARKS = {
  check: Check,
  x: X,
  clock: Clock,
};

export default function StatusPill({
  label,
  tone = "neutral",
  /** "dot" | "check" | "x" | "clock" | false */
  mark = "dot",
  size = "default",
  className,
}) {
  const t = toneOf(tone);
  const Glyph = MARKS[mark];

  // The selected filter chip is the one pill that inverts to a solid ink fill,
  // so `neutral` on its own must not also mean "selected" — a neutral pill is
  // white with the standard chip border, like every other unselected control.
  const isNeutral = tone === "neutral";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap rounded-full border-[1.5px] font-bold",
        size === "sm" ? "h-9 px-3 text-[14px]" : "h-11 px-4 text-[15px]",
        isNeutral
          ? "border-chip bg-surface text-ink dark:bg-dk-chip"
          : cn(t.tint, t.border, t.pillText),
        className
      )}
    >
      {mark === "dot" && (
        <span className={cn("size-2.5 shrink-0 rounded-full", t.dot)} aria-hidden="true" />
      )}
      {Glyph && <Glyph className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />}
      {label}
    </span>
  );
}

/**
 * A count on a nav item or beside a heading.
 *
 * `attention` is the difference between "there are 12 orders" and "7 products
 * need restocking". A neutral count is information; an attention count is a
 * request, and it gets the clay fill that reads as one against the navy
 * sidebar.
 */
export function CountBadge({ count, attention = false, className }) {
  if (count === null || count === undefined) return null;
  return (
    <span
      className={cn(
        "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[12.5px] font-extrabold",
        attention ? "bg-nav-badge text-nav-badge-ink" : "bg-white/[0.18] text-white",
        className
      )}
    >
      {count}
    </span>
  );
}

/**
 * The small mark beside a person's name in the staff table — "Owner", "New".
 *
 * Deliberately not a role and not a status: it sits inline with the name
 * because it qualifies who the person is, where the "Can sign in" pill in its
 * own column answers what the account can do.
 */
export function InlineBadge({ label, tone = "cobalt", className }) {
  const t = toneOf(tone);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[13px] font-extrabold",
        t.tint,
        t.pillText,
        className
      )}
    >
      {label}
    </span>
  );
}

/**
 * The alert count on the header's Alerts button. Red fill, white text, a 22px
 * minimum-width pill so a two-digit count doesn't turn it into an oval.
 */
export function AlertBadge({ count, className }) {
  if (!count) return null;
  return (
    <span
      className={cn(
        "ml-0.5 inline-flex h-5.5 min-w-5.5 items-center justify-center rounded-full bg-red px-1.5 text-[12px] font-extrabold text-white",
        className
      )}
    >
      {count}
    </span>
  );
}
