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
 * THE VALUE SITS UNDER THE LABEL, NOT BESIDE IT, and that is the whole layout
 * decision. Every one of these lives in a detail rail 300–360px wide, and the
 * label used to take a fixed 42% of the row — which left about 137px for the
 * value once the icon and the gaps were paid for. At that width "Jose
 * Gonzales" broke across two lines, and an email address did not fit at all:
 * it overflowed the column and was cut off mid-letter by the card's own
 * overflow-hidden, with no ellipsis to say anything was missing. A value
 * silently losing its last characters is worse than any amount of wrapping,
 * because nothing on screen admits it happened.
 *
 * Stacking gives the value the full width of the row, which is enough for an
 * ordinary email on one line and for a name or a date on one line always. A
 * label above its value also reads as a pair without needing them aligned in a
 * column, which a fixed-width label was only ever there to achieve.
 *
 * `dt` and `dd` stay SIBLINGS rather than being wrapped in a shared div: the
 * icon is placed by the grid instead, spanning both rows. A dl's row grouping
 * is only allowed to contain dt and dd, and nesting a wrapper inside it would
 * be the kind of markup screen readers are entitled to give up on.
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
            className={cn(
              "grid min-h-15 items-center gap-x-3.5 px-5.5 py-3.5 first:pt-4 last:pb-4",
              row.icon ? "grid-cols-[auto_minmax(0,1fr)]" : "grid-cols-1"
            )}
          >
            {row.icon && (
              <IconChip
                icon={row.icon}
                tone={row.tone ?? "neutral"}
                size="sm"
                className="row-span-2 self-center"
              />
            )}
            <dt
              className={cn(
                "text-[15px] leading-[1.35] text-muted",
                row.icon && "col-start-2"
              )}
            >
              {row.label}
            </dt>
            <dd
              className={cn(
                // break-words is the belt to the stacking braces: a value with
                // no spaces in it and no room left still wraps rather than
                // walking out of the card.
                "min-w-0 break-words pt-0.5 text-[16.5px] font-bold leading-[1.35] text-ink",
                row.icon && "col-start-2",
                row.mono && "font-mono text-[15px]"
              )}
            >
              {/* An empty value is a dash rather than a blank cell: "we have
                  not been told" and "there is nothing here" look identical
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
 * us" and "Free to sell".
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
