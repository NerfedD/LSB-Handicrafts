import { DotsThree } from "../icons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Parts the four Production boards share.
 */

/** "1. Plan · 2. Make and check · 3. Finish": three steps in ruled cells. */
export function FlowStrip({ label, steps }) {
  return (
    <section
      aria-label={label}
      className="grid gap-px overflow-hidden rounded-lg border border-border bg-border [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]"
    >
      {steps.map(([title, text]) => (
        <div key={title} className="bg-card px-4 py-3">
          <div className="text-13 font-semibold">{title}</div>
          <div className="text-13 text-muted-fg">{text}</div>
        </div>
      ))}
    </section>
  );
}

/** The boards' 28px filter toggles: a word and a muted count, the chosen one on --muted. */
export function ToggleChips({ label, chips, value, onChange, className }) {
  return (
    <div role="group" aria-label={label} className={cn("inline-flex flex-wrap gap-1", className)}>
      {chips.map((chip) => (
        <button
          key={chip.value}
          type="button"
          aria-pressed={value === chip.value}
          onClick={() => onChange(chip.value)}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2.5 text-13 font-medium text-foreground",
            value === chip.value ? "bg-muted" : "bg-card hover:bg-surface-2"
          )}
        >
          {chip.label}
          {chip.count !== undefined ? <span className="text-xs text-muted-fg">{chip.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** A stage badge with its own look: `look` is { label, className, dot }. */
export function LookBadge({ look }) {
  return (
    <span className={cn("inline-flex h-5 items-center gap-[5px] whitespace-nowrap rounded border px-1.5 text-xs font-medium", look.className)}>
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", look.dot)} />
      {look.label}
    </span>
  );
}

/**
 * The actions a row has besides its next step, behind DotsThree. `items` is
 * [{ label, onClick, danger, separatorBefore }], already filtered to what the
 * person may do.
 */
export function MoreActions({ label, items }) {
  if (!items.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        className="inline-flex size-7 items-center justify-center rounded-md text-fg-2 hover:bg-muted data-[popup-open]:bg-muted"
      >
        <DotsThree weight="bold" className="size-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {items.map((item) => (
          <span key={item.label} className="contents">
            {item.separatorBefore ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem variant={item.danger ? "destructive" : undefined} onClick={item.onClick}>
              {item.icon}
              {item.label}
            </DropdownMenuItem>
          </span>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
