/**
 * Staff activity entries and their per-action-type styling.
 *
 * Still the hardcoded sample set the Staff Activity Log screen was built
 * against — nothing writes activity rows yet. It lives here rather than in
 * that page because the Dashboard's Recent Activity panel and its "Activity
 * Entries" count read the same list, and the two must not drift.
 *
 * ACTION_STYLES keys the Activity Log's outlined pills; ACTION_PILL_STYLES is
 * the flatter, borderless variant the Dashboard panel uses (Figma 158:339).
 */

export const ACTION_TYPES = ["Login", "Account Change", "Stock Edit", "Price Edit"];

export const ACTION_STYLES = {
  Login: "bg-[#1b3a6b12] border-[#1b3a6b29] text-[#1b3a6b]",
  "Account Change": "bg-[#653eb512] border-[#653eb52e] text-[#653eb5]",
  "Stock Edit": "bg-[#9a610012] border-[#9a61002e] text-[#8a5600]",
  "Price Edit": "bg-[#166b5912] border-[#166b592e] text-[#166b59]",
};

export const ACTION_PILL_STYLES = {
  Login: "bg-[#1b3a6b14] text-[#1b3a6b]",
  "Account Change": "bg-[#653eb514] text-[#653eb5]",
  "Stock Edit": "bg-[#9a610014] text-[#8a5600]",
  "Price Edit": "bg-[#166b5914] text-[#166b59]",
};

export const SAMPLE_ENTRIES = [
  { id: 1, staff: "Maria Santos", action: "Logged in", type: "Login", date: "August 22, 2026", time: "8:02 AM" },
  { id: 2, staff: "Juan Dela Cruz", action: "Updated user account", type: "Account Change", date: "August 22, 2026", time: "8:15 AM" },
  { id: 3, staff: "Ramon Garcia", action: "Edited stock information", type: "Stock Edit", date: "August 22, 2026", time: "9:04 AM" },
  { id: 4, staff: "Ana Reyes", action: "Updated product price", type: "Price Edit", date: "August 22, 2026", time: "9:31 AM" },
  { id: 5, staff: "Maria Santos", action: "Logged in", type: "Login", date: "August 21, 2026", time: "7:58 AM" },
  { id: 6, staff: "Carlos Mendoza", action: "Updated product price", type: "Price Edit", date: "August 21, 2026", time: "10:22 AM" },
  { id: 7, staff: "Liza Villanueva", action: "Logged in", type: "Login", date: "August 21, 2026", time: "11:05 AM" },
  { id: 8, staff: "Juan Dela Cruz", action: "Edited stock information", type: "Stock Edit", date: "August 21, 2026", time: "2:14 PM" },
  { id: 9, staff: "Maria Santos", action: "Updated user account", type: "Account Change", date: "August 20, 2026", time: "8:30 AM" },
  { id: 10, staff: "Ramon Garcia", action: "Logged in", type: "Login", date: "August 20, 2026", time: "9:00 AM" },
  { id: 11, staff: "Ana Reyes", action: "Edited stock information", type: "Stock Edit", date: "August 20, 2026", time: "3:45 PM" },
  { id: 12, staff: "Carlos Mendoza", action: "Logged in", type: "Login", date: "August 20, 2026", time: "8:15 AM" },
];
