/**
 * The six avatar-chip colours used across the profile screens (Figma 158:240,
 * 164:60 and friends). Picked deterministically from the name so the same
 * person keeps the same colour on every screen and across reloads — the design
 * varies them per row, but nothing in the data says which one a row should get.
 */
const AVATAR_COLORS = [
  "bg-[#653eb5]",
  "bg-[#166b59]",
  "bg-[#8a5600]",
  "bg-[#1746d1]",
  "bg-[#1b3a6b]",
  "bg-[#b54747]",
];

export function avatarColorOf(name) {
  const key = String(name || "");
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) % 100003;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export default AVATAR_COLORS;
