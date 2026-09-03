/**
 * The two button treatments the profile screens use (Figma 171:1269 /
 * 171:1272): a filled #1746d1 primary and a hairline-outlined secondary.
 *
 * Plain strings in their own module rather than components, because the
 * screens apply them at several sizes — the detail cards use them as-is, the
 * form footer bumps them to h-11 / rounded-[9px].
 */
export const primaryButton =
  "flex h-9 items-center gap-2 rounded-lg bg-[#1746d1] px-4 text-[13.5px] font-semibold text-white shadow-[0_1px_3px_rgba(23,70,209,0.3)] transition hover:bg-[#1238ad]";

export const secondaryButton =
  "flex h-9 items-center gap-2 rounded-lg border border-[#17263a2e] bg-white px-4 text-[13.5px] font-semibold text-[#17263a] transition hover:bg-[#17263a08]";

/**
 * The small bordered View / Edit buttons in a list row.
 *
 * Was declared identically in CustomerListPage, SupplierListPage and
 * ProductListPage.
 */
export const rowAction =
  "rounded-md border border-[#17263a26] px-3 py-1 text-[12px] font-semibold transition";
