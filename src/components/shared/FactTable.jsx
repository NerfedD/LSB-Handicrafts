import { cn } from "@/lib/utils";
import IconChip from "./Chip";

/**
 * The label-and-value list every detail screen is mostly made of: a product's
 * facts, a customer's contact details, where a delivery is going.
 *
 * A <dl>, not a grid of divs. The relationship between "Phone" and the number
 * beside it is the whole content of the row, and a screen reader that cannot
 * hear that relationship gets a list of unattached strings.
 *
 * Values are 16.5px/700 against 15px muted labels, so the value is what reads
 * first — on a detail screen the labels are already predictable and it is the
 * values somebody came for.
 *
 * `rows` is [{ label, value, icon, tone, mono }]. An `icon` promotes the row
 * to the leading-chip treatment used for contact details, where the glyph
 * makes a phone number findable without reading the label.
 */
export default function FactTable({ rows, className }) {
  return (
    <dl className={cn("divide-y divide-hair", className)}>
      {rows
        .filter((row) => row && row.value !== undefined)
        .map((row) => (
          <div
            key={row.label}
            className="flex min-h-15 items-center gap-4 px-5.5 py-3.5 first:pt-4 last:pb-4"
          >
            {row.icon && <IconChip icon={row.icon} tone={row.tone ?? "neutral"} size="sm" />}
            <dt className="w-[42%] shrink-0 text-[15px] text-muted">
              {row.label}
            </dt>
            <dd
              className={cn(
                "min-w-0 flex-1 text-[16.5px] font-bold text-ink",
                row.mono && "font-mono text-[15px]"
              )}
            >
              {/* An empty value is a dash rather than a blank cell: "we have
                  not been told"and"there is nothing here" look identical
                  otherwise, and a blank row reads as a rendering fault. */}
              {row.value === null || row.value === "" ? (
                <span className="font-normal text-muted-2">Not recorded</span>
              ) : (
                row.value
              )}
            </dd>
          </div>
        ))}
    </dl>
  );
}

/**
 * Two or three bordered figures side by side — "Orders placed", "Spent with
 * us","Free to sell".
 *
 * Distinct from the dashboard's stat strip: these sit inside a record's own
 * card and describe that one record, so they are bordered tiles rather than
 * cells divided by rules.
 */
export function StatTiles({ tiles, className }) {
  return (
    <div className={cn("grid gap-3.5", className)} style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}>
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="rounded-tile2 border border-card px-4.5 py-4"
        >
          <p className="text-[14.5px] font-bold text-muted">{tile.label}</p>
          <p className="pt-1.5 text-[26px] font-extrabold leading-none tracking-[-0.02em] tabular-nums text-ink">
            {tile.value}
          </p>
          {tile.hint && (
            <p className="pt-1.5 text-[14px] text-muted">{tile.hint}</p>
          )}
        </div>
      ))}
    </div>
  );
}
