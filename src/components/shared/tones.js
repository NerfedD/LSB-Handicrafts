/**
 * Tone -> classes.
 *
 * The handoff's standard pairing is "a tint surface plus the matching tone
 * colour", used by every pill, icon chip, callout, stat and stock bar in the
 * app. Written out once here, because the alternative is what the codebase had
 * before: the same six hexes retyped inline about 175 times, with a different
 * alpha each time somebody eyeballed it.
 *
 * Each entry is a plain object of class strings rather than one concatenated
 * blob, because the parts get used separately — a table cell wants only
 * `text`, a stock bar only `fill`, a pill wants `tint` + `border` + `pillText`.
 *
 * `pillText` exists apart from `text` for the two tones where the tone colour
 * itself does not hold contrast on its own tint: amber and clay both need to go
 * a step darker on the tint than they are as a foreground on white.
 *
 * WHAT EACH SLOT OWES THE DARK THEME. The surfaces and neutral text in this
 * system flip on their own — `tint`, and `pillText` for the tones whose
 * foreground is a `-deep`/`-text` token, resolve through CSS variables (see
 * src/index.css), so they need no `dark:` here. The BASE HUES do not flip,
 * because each of cobalt/clay/green/amber/red is a fill as often as it is a
 * foreground and `bg-cobalt text-white` has to stay a saturated button. So
 * `text`, `border`, `fill` and `dot` carry an explicit `dark:` on every tone.
 *
 * That "on every tone" is the point. This table used to pair only the tones
 * the two dark screens happened to use, which is how a clay supplier chip and
 * a purple activity chip went muddy the moment either appeared somewhere dark
 * — and a hairline at 25% of a dark hue on a dark chip is no hairline at all.
 */

export const TONES = {
  cobalt: {
    text: "text-cobalt dark:text-dk-cobalt",
    pillText: "text-cobalt-deep",
    tint: "bg-tint-cobalt",
    border: "border-cobalt/25 dark:border-dk-cobalt/25",
    fill: "bg-cobalt dark:bg-dk-cobalt",
    dot: "bg-cobalt dark:bg-dk-cobalt",
    hex: "#1462c8",
  },
  clay: {
    text: "text-clay dark:text-dk-clay",
    pillText: "text-clay-deep",
    tint: "bg-tint-clay",
    border: "border-clay/25 dark:border-dk-clay/25",
    fill: "bg-clay",
    dot: "bg-clay dark:bg-dk-clay",
    hex: "#b4531f",
  },
  green: {
    text: "text-green dark:text-dk-green",
    pillText: "text-green dark:text-dk-green",
    tint: "bg-tint-green",
    border: "border-green/25 dark:border-dk-green/25",
    fill: "bg-green dark:bg-dk-green",
    dot: "bg-green dark:bg-dk-green",
    hex: "#0f6b46",
  },
  amber: {
    text: "text-amber-icon",
    pillText: "text-amber-text",
    tint: "bg-tint-amber",
    // The handoff specifies status-chip borders as the tone at 40 alpha
    // (#8a500040 here), which is what /25 resolves to on the icon colour.
    // `amber-icon` is a foreground token, so this one flips on its own.
    border: "border-amber-icon/25",
    fill: "bg-amber dark:bg-dk-amber",
    dot: "bg-amber dark:bg-dk-amber",
    hex: "#c07800",
  },
  red: {
    text: "text-red dark:text-dk-red",
    pillText: "text-red-text",
    tint: "bg-tint-red",
    border: "border-red/25 dark:border-dk-red/25",
    fill: "bg-red dark:bg-dk-red",
    dot: "bg-red dark:bg-dk-red",
    hex: "#a8332f",
  },
  purple: {
    text: "text-purple dark:text-dk-purple",
    pillText: "text-purple dark:text-dk-purple",
    tint: "bg-tint-purple",
    border: "border-purple/25 dark:border-dk-purple/25",
    fill: "bg-purple",
    dot: "bg-purple dark:bg-dk-purple",
    hex: "#6b3fa0",
  },
  navy: {
    text: "text-navy dark:text-dk-navy",
    pillText: "text-navy dark:text-dk-navy",
    tint: "bg-tint-cobalt",
    border: "border-navy/25 dark:border-dk-navy/25",
    fill: "bg-navy",
    dot: "bg-navy dark:bg-dk-navy",
    hex: "#0e2f5c",
  },
  neutral: {
    text: "text-muted",
    pillText: "text-muted",
    tint: "bg-tint-neutral",
    border: "border-chip",
    fill: "bg-muted",
    dot: "bg-muted",
    hex: "#4b5768",
  },
};

/** Falls back to neutral rather than throwing on an unmapped tone. */
export const tone = (name) => TONES[name] ?? TONES.neutral;

/**
 * Deterministic tone for an avatar, picked from the person's name.
 *
 * The design varies avatar colour per row, but nothing in the data says which
 * colour a row should get — so it is derived from the name, which keeps the
 * same person the same colour on every screen and across reloads.
 *
 * Deliberately excludes amber and neutral: neither reads as an identity colour
 * at 36px with white initials on it.
 */
const AVATAR_TONES = ["navy", "cobalt", "clay", "green", "purple", "red"];

export function avatarTone(name) {
  const key = String(name || "");
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) % 100003;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

/** The solid fill + white text an avatar circle uses. */
export const avatarFill = (name) => tone(avatarTone(name)).fill;
