import { cn } from "@/lib/utils";
import { tone as toneOf } from "./tones";

/**
 * The stock bar in a products-table row.
 *
 * 9px tall, pill radius, capped at 170px wide. The point of it is stated in
 * the handoff as "readable from across the room", and that is literal: the
 * products list is read standing up, at a distance, by someone deciding what
 * to make next. A number alone requires focusing on it; a bar's length is
 * apparent before you focus on anything.
 *
 * It is deliberately NOT labelled or given a tooltip — the number and the
 * status word sit directly above it, so the bar adds a second, faster channel
 * for information that is already stated in words. `aria-hidden` for that
 * reason: a screen reader gets the number, not a redundant meter.
 */
export default function StockBar({ value, max, tone = "neutral", className }) {
  const ceiling = Number(max) > 0 ? Number(max) : 0;
  const pct = ceiling ? Math.min(100, Math.max(0, (Number(value) / ceiling) * 100)) : 0;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "h-[9px] w-full max-w-42 overflow-hidden rounded-full bg-rule",
        className
      )}
    >
      <div
        // WIDTH, NOT scaleX, AND DELIBERATELY. Transform is the cheaper property
        // and the usual advice, but scaling a pill horizontally squashes the
        // radius on its leading end into an ellipse, and this bar is a pill at
        // both ends at every length. The cost that normally makes width the
        // wrong answer — reflowing everything around it — is not paid here
        // either: the track is a fixed box and nothing outside it moves.
        className={cn("h-full rounded-full transition-[width] duration-200", toneOf(tone).fill)}
        // A percentage width is the one value here that cannot be a class:
        // it is data, and Tailwind cannot generate a class per stock level.
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/**
 * The product-detail bar: one shelf split three ways.
 *
 * free to sell · set aside for orders · room to fill
 *
 * Three segments rather than three numbers, because the question a stock story
 * answers is proportional — "have we got enough spare" is a glance at how much
 * green there is next to how much amber. The numbers are still printed above
 * it; this is what makes their relationship visible.
 */
export function SegmentedBar({ segments, className }) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, Number(s.value) || 0), 0);

  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex h-3.5 w-full overflow-hidden rounded-full bg-rule",
        className
      )}
    >
      {total > 0 &&
        segments.map((segment) => {
          const pct = (Math.max(0, Number(segment.value) || 0) / total) * 100;
          // An empty segment stays MOUNTED at zero width rather than being
          // dropped. Unmounting it is the same picture at rest and a different
          // one in motion: a segment that arrives from nothing pops into the
          // bar at its full share, where one that grows from zero shows the
          // boundary sliding across — which is the only version that tells you
          // what moved. A zero-width div inside a clipped track draws nothing.
          return (
            <div
              key={segment.label}
              // Matched to StockBar above, and for the same reason it matters
              // more here: the three segments are ONE shelf being re-divided.
              // Receiving a delivery does not lengthen this bar, it moves the
              // boundaries inside it — free to sell gives ground to reserved,
              // or room to fill gives ground to both — and a boundary that
              // travels is the whole story. Switching the widths instantly
              // shows the answer and hides the trade.
              className={cn(
                "h-full transition-[width] duration-200",
                segment.tone ? toneOf(segment.tone).fill : "bg-transparent"
              )}
              style={{ width: `${pct}%` }}
            />
          );
        })}
    </div>
  );
}

/**
 * The legend under a segmented bar. A swatch, a word and the number — the word
 * being non-negotiable, since a colour key with no words is a colour key
 * nobody can use.
 */
export function BarLegend({ segments, className }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-6 gap-y-2", className)}>
      {segments.map((segment) => (
        <li key={segment.label} className="flex items-center gap-2.5">
          <span
            className={cn(
              "size-3 shrink-0 rounded-full",
              segment.tone ? toneOf(segment.tone).fill : "bg-rule"
            )}
            aria-hidden="true"
          />
          <span className="text-[15px] text-muted">{segment.label}</span>
          <span className="text-[15px] font-bold tabular-nums text-ink">
            {segment.value}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The stock cell: a tone-coloured count, the status in words, then the bar.
 *
 * Bundled because the three parts have to agree — a green number over an amber
 * bar is worse than either alone, and keeping them in one component means the
 * tone is decided once.
 */
export function StockCell({ count, label, tone = "neutral", value, max, className }) {
  return (
    <div className={className}>
      <div className="flex items-baseline gap-2">
        <span className={cn("text-[20px] font-extrabold tabular-nums", toneOf(tone).text)}>
          {count}
        </span>
        <span className="text-[14px] text-muted">{label}</span>
      </div>
      <StockBar value={value} max={max} tone={tone} className="mt-1.5" />
    </div>
  );
}
