import { clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge has to be told about the sizes tailwind.config.js adds.
 * Without this `text-13` reads as a text COLOUR, so `cn("text-13", "text-muted-fg")`
 * would quietly drop the size.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["2xs", "13"] }],
      shadow: [{ shadow: ["xs", "menu", "dialog", "seg"] }],
    },
  },
});

/**
 * Merge Tailwind class strings, with later classes winning conflicts, so a
 * variant and a one-off override can't fight.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
