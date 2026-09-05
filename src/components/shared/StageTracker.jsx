import { Check } from "../icons";
import { cn } from "@/lib/utils";

/**
 * Where a record is, and what happens next.
 *
 * This replaces a status word, and that is the whole idea. "Pending" tells you
 * the state; it does not tell you that being made comes after being written,
 * or that there are two steps left. Anyone — including someone on their first
 * day — can read a tracker and know both.
 *
 * Three visual states, and they are distinguished by more than colour:
 *   done     green fill, a check glyph, and its date underneath
 *   current  cobalt fill, the number, "now" underneath
 *   future   white with a muted border and a transparent connector, so the
 *            line ahead reads as not yet drawn rather than as a step skipped
 *
 * `stages` is [{ label, at }] where `at` is the display date for a completed
 * stage. `current` is the index of the stage in progress; every earlier index
 * is done.
 */
export default function StageTracker({ stages, current, compact = false, className }) {
  return (
    <ol
      className={cn(
        compact ? "flex flex-col gap-3.5" : "flex items-start",
        className
      )}
    >
      {stages.map((stage, index) => {
        const done = index < current;
        const isCurrent = index === current;
        const last = index === stages.length - 1;

        const circle = cn(
          "flex shrink-0 items-center justify-center rounded-full border-2 font-extrabold tabular-nums",
          compact ? "size-10 text-[16px]" : "size-11.5 text-[17px]",
          done && "border-green bg-green text-white",
          isCurrent && "border-cobalt bg-cobalt text-white dark:border-dk-cobalt dark:bg-dk-cobalt dark:text-dk-on-cobalt",
          !done && !isCurrent && "border-chip bg-surface text-muted-2"
        );

        // The tablet layout puts the label and date beside the circle instead
        // of under it, because a four-stage horizontal tracker with stacked
        // labels does not fit an 834px viewport without the labels colliding.
        if (compact) {
          return (
            <li key={stage.label} className="flex items-center gap-3.5">
              <span className={circle} aria-hidden="true">
                {done ? <Check className="h-5 w-5" /> : index + 1}
              </span>
              <span className="min-w-0">
                <span
                  className={cn(
                    "block text-[16px] leading-tight",
                    isCurrent || done
                      ? "font-extrabold text-ink"
                      : "font-bold text-muted"
                  )}
                >
                  {stage.label}
                </span>
                <span className="block pt-0.5 text-[14px] text-muted">
                  {isCurrent ? "Now" : stage.at || (done ? "Done" : "Not yet")}
                </span>
              </span>
            </li>
          );
        }

        return (
          <li key={stage.label} className="flex items-start last:flex-none [&:not(:last-child)]:flex-1">
            <div className="flex w-24 shrink-0 flex-col items-center">
              <span className={circle} aria-hidden="true">
                {done ? <Check className="h-5.5 w-5.5" /> : index + 1}
              </span>
              <span
                className={cn(
                  "pt-2.5 text-center text-[15.5px] leading-tight",
                  isCurrent || done
                    ? "font-extrabold text-ink"
                    : "font-bold text-muted"
                )}
              >
                {stage.label}
              </span>
              <span className="pt-1 text-center text-[14px] text-muted">
                {isCurrent ? "Now" : stage.at || (done ? "Done" : "Not yet")}
              </span>
            </div>

            {!last && (
              <span
                aria-hidden="true"
                className={cn(
                  "mt-[21px] h-1 min-w-6 flex-1 rounded-full",
                  // A future connector is transparent, not grey: a grey line
                  // between two future circles reads as a completed link.
                  done ? "bg-green" : isCurrent ? "bg-cobalt/25" : "bg-transparent"
                )}
              />
            )}

            {/* The stage list is the record's real status, so it is stated
                once in words for anything not reading the circles. */}
            <span className="sr-only">
              {stage.label}: {done ? `done ${stage.at || ""}` : isCurrent ? "in progress now" : "not started"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
