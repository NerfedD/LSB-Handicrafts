import { Plus, Search, X } from "../icons";

/**
 * Search field + primary "Add X" button, the row above every profile list
 * (Figma 164:29; 167:380 is the cleared/no-results variant).
 *
 * The result count only appears once something has been typed, matching the
 * design — an untouched list doesn't announce "8 results".
 */
export default function ProfileSearchBar({
  value,
  onChange,
  placeholder,
  resultCount,
  addLabel,
  onAdd,
}) {
  const hasQuery = value.trim() !== "";

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative w-[436px] max-w-full">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-[#5f6875]/70" />
          <input
            type="search"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className="h-[38px] w-full rounded-lg border border-[#17263a1a] bg-white pl-10 pr-10 text-[13.5px] text-[#17263a] outline-none placeholder:text-[#5f6875]/70 focus:ring-2 focus:ring-[#1746d1]/25"
          />
          {hasQuery && (
            <button
              type="button"
              onClick={() => onChange("")}
              aria-label="Clear search field"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5f6875] transition hover:text-[#17263a]"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {hasQuery && (
          <span className="whitespace-nowrap text-[12.5px] text-[#5f6875]">
            {resultCount} {resultCount === 1 ? "result" : "results"}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="flex h-[38px] shrink-0 items-center gap-2 rounded-lg bg-[#1746d1] px-[18px] text-[13.5px] font-semibold text-white shadow-[0_1px_3px_rgba(23,70,209,0.3)] transition hover:bg-[#1238ad]"
      >
        <Plus className="h-3.5 w-3.5" />
        {addLabel}
      </button>
    </div>
  );
}
