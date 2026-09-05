import { cn } from "@/lib/utils";
import { tone as toneOf } from "./tones";
import IconChip from "./Chip";

/**
 * A tinted block that explains a situation and offers the way out of it.
 *
 * Every one of these in the design follows the same three-part shape, and the
 * shape is the rule: a heading that names WHAT HAPPENED, a line that says WHAT
 * TO DO, and — where there is something to do — one button that does it.
 *
 *   "That username and password do not match"
 *   "Check for capital letters and extra spaces. After five tries the account
 *    locks for fifteen minutes."
 *
 * A callout that only states a problem is a dead end, which is what "You don't
 * have access to this screen" was.
 */
export default function Callout({
  tone = "cobalt",
  icon,
  title,
  children,
  action,
  className,
}) {
  const t = toneOf(tone);
  return (
    <div className={cn("rounded-field border-[1.5px] p-4.5", t.tint, t.border, className)}>
      <div className="flex items-start gap-3.5">
        {/* The chip sits ON the callout's own tint, so it lifts to white rather
            than repeating the same colour twice — and in dark mode it drops to
            the dark chip surface instead, where white would be a hole. */}
        {icon && (
          <IconChip
            icon={icon}
            tone={tone}
            size="sm"
            className="bg-white/60 dark:bg-white/[0.08]"
          />
        )}
        <div className="min-w-0 flex-1">
          {title && (
            <p className={cn("text-[16.5px] font-extrabold leading-[1.35]", t.pillText)}>
              {title}
            </p>
          )}
          {children && (
            <div
              className={cn(
                "text-[15px] leading-[1.5] text-ink-2",
                title && "pt-1.5"
              )}
            >
              {children}
            </div>
          )}
          {action && <div className="flex flex-wrap gap-3 pt-4">{action}</div>}
        </div>
      </div>
    </div>
  );
}

/**
 * Destructive actions live here and nowhere else.
 *
 * Rule 6: never a red trash icon in a table row. A row-level icon is a
 * one-click irreversible action sitting a few pixels from "Edit", triggered
 * before it is read. Removing an account is instead its own card at the bottom
 * of that account's screen, which:
 *
 *   - names the thing ("Remove Ana Reyes"),
 *   - states exactly what happens AND what survives ("Orders and stock records
 *     they made stay exactly as they are"),
 *   - and says it cannot be undone.
 *
 * The consequences copy is a required prop rather than an optional one on
 * purpose. A destructive block with no explanation is the thing this replaces.
 */
export function DangerBlock({ title, children, action, className }) {
  return (
    <section
      className={cn(
        "rounded-card border-[1.5px] border-red/[0.27] bg-surface p-5.5",
        className
      )}
    >
      <h3 className="text-[18px] font-extrabold text-red-text">{title}</h3>
      <div className="pt-2 text-[15.5px] leading-[1.55] text-muted">
        {children}
      </div>
      <div className="pt-4.5">{action}</div>
    </section>
  );
}

/**
 * A quiet note beside a form — "the SKU is generated from kind and size, you
 * never have to invent a code".
 *
 * Lower contrast than a Callout and with no action, because it is not
 * reporting a situation: it is answering the question a field would otherwise
 * prompt.
 */
export function InfoNote({ icon, title, children, className }) {
  return (
    <div className={cn("rounded-field bg-tint-cobalt p-4.5 dark:bg-dk-chip", className)}>
      <div className="flex items-start gap-3">
        {icon && <span className="mt-0.5 shrink-0 text-cobalt dark:text-dk-cobalt">{icon}</span>}
        <div className="min-w-0">
          {title && (
            <p className="text-[15.5px] font-extrabold text-cobalt-deep">{title}</p>
          )}
          <div className={cn("text-[15px] leading-[1.5] text-ink-2", title && "pt-1")}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
