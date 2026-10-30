import { cn } from "@/lib/utils";
import { ROLE_BLURB, roleLabel } from "../../utils/copy";
import { ROLES } from "../../utils/staffData";

/**
 * The role radios on the Account details board: each row a 16px radio, the
 * role's name and one line saying what it opens. The chosen row sits on
 * --muted with a --primary-text ring and dot.
 */
export function RoleChoices({ label, value, onChange, disabled = false }) {
  return (
    <div role="radiogroup" aria-label={label} aria-disabled={disabled || undefined} className="flex flex-col gap-0.5">
      {ROLES.map((role) => {
        const on = role === value;
        return (
          <button
            key={role}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(role)}
            className={cn(
              "flex w-full items-start gap-2.5 rounded-md border-0 p-2 text-left disabled:cursor-not-allowed disabled:opacity-60",
              on ? "bg-muted" : "bg-transparent enabled:hover:bg-surface-2"
            )}
          >
            <span aria-hidden="true" className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border bg-card shadow-xs", on ? "border-primary-text" : "border-border")}>
              {on ? <span data-radio-dot className="size-2 rounded-full bg-primary" /> : null}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{roleLabel(role)}</span>
              <span className="block text-13 text-muted-fg">{ROLE_BLURB[role]}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
