import { cn } from "@/lib/utils";
import { avatarFill, tone as toneOf } from "./tones";
import { initialsOf } from "../../utils/staffData";

/**
 * A tinted square holding one icon.
 *
 * The most repeated shape in the system: it fronts every attention row, every
 * activity entry, every product row, every fact-table row and every stat. Its
 * job is to make a row scannable before any of it is read — you find the amber
 * warning chip before you find the sentence next to it.
 *
 * Sizes are the handoff's, and each has a job:
 *   sm  36px  activity rows, callout headers, small facts
 *   md  44px  product rows, supplier rows, role cards
 *   lg  46px  attention rows, customer contact rows
 *   xl  52px  the "where it is now" card, destructive confirm dialogs
 *   2xl 60px  destination tiles on the large-text dashboard
 */
const SIZES = {
  sm: "size-9 rounded-btn text-[17px]",
  md: "size-11 rounded-field text-[20px]",
  lg: "size-11.5 rounded-tile text-[22px]",
  xl: "size-13 rounded-tile2 text-[24px]",
  "2xl": "size-15 rounded-[15px] text-[28px]",
};

export default function IconChip({ icon, tone = "neutral", size = "md", className }) {
  const t = toneOf(tone);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        SIZES[size] ?? SIZES.md,
        t.tint,
        t.text,
        className
      )}
    >
      {icon}
    </span>
  );
}

/**
 * A person's initials in a filled circle.
 *
 * Colour is derived from the name (see tones.avatarTone) so the same person is
 * the same colour on every screen and across reloads — the design varies it
 * per row, but nothing in the data says which row gets which.
 *
 * `tone` overrides that when the colour has to mean something instead: a
 * customer's own colour on their detail screen, navy for the order's customer
 * card.
 */
const AVATAR_SIZES = {
  sm: "size-9 text-[13px]",
  md: "size-11 text-[15px]",
  lg: "size-12 text-[16.5px]",
  xl: "size-15 text-[21px]",
  "2xl": "size-22 text-[30px]",
};

export function Avatar({ name, tone, size = "md", className }) {
  const fill = tone ? toneOf(tone).fill : avatarFill(name);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-extrabold text-white",
        AVATAR_SIZES[size] ?? AVATAR_SIZES.md,
        fill,
        className
      )}
    >
      {initialsOf(name)}
    </span>
  );
}

/**
 * A SKU, an item code or an order number.
 *
 * Monospaced and 13.5px, which is the one place small type is allowed outside
 * a tracked uppercase signpost: an identifier is matched character by character
 * against a label on a shelf, not read as a word, and a monospace face at that
 * size is easier to match than proportional text at 16px.
 */
export function Mono({ children, className }) {
  return (
    <span className={cn("font-mono text-[13.5px] text-muted", className)}>
      {children}
    </span>
  );
}
