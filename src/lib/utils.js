import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind class strings, with later classes winning conflicts.
 *
 * This is what the old `shared/profileButtonStyles.js` approach could not do.
 * It exported raw class strings that callers concatenated to override size —
 * `${secondaryButton} h-11 px-[22px]` — which only worked when the resulting
 * class order happened to favour the override. twMerge resolves the conflict
 * properly, so a variant and a one-off override can't fight.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
