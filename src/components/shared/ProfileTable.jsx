/**
 * The white record table shared by the Customer, Product and Supplier list
 * screens (Figma 164:39, 172:2075, 179:4091): uppercase tracked header strip
 * on #fafaf8, hairline-separated rows, and a muted "N customers total" footer.
 *
 * `columns` is [{ key, label, className }] — `className` sets the column width
 * and any alignment, and is applied to both the header cell and the body cell
 * so the two can't drift. `renderCell(row, key)` returns the cell contents.
 */
export default function ProfileTable({ columns, rows, rowKey, renderCell, footer }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#17263a14] bg-white shadow-[0_1px_4px_rgba(23,38,58,0.05)]">
      <div className="overflow-x-auto">
        <div className="min-w-[860px]">
          <div className="flex items-center gap-4 border-b border-[#17263a12] bg-[#fafaf8] px-6 py-2.5">
            {columns.map((column) => (
              <div
                key={column.key}
                className={`text-[10.5px] font-bold uppercase tracking-[0.945px] text-[#5f6875] ${column.className}`}
              >
                {column.label}
              </div>
            ))}
          </div>

          {rows.map((row, index) => (
            <div
              key={rowKey(row)}
              className={`flex items-center gap-4 px-6 py-3.5 ${
                index > 0 ? "border-t border-[#17263a0d]" : ""
              }`}
            >
              {columns.map((column) => (
                <div key={column.key} className={`min-w-0 ${column.className}`}>
                  {renderCell(row, column.key)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {footer ? (
        <p className="border-t border-[#17263a0f] bg-[#fafaf8] px-6 py-3 text-[12px] text-[#5f6875]/60">
          {footer}
        </p>
      ) : null}
    </div>
  );
}
