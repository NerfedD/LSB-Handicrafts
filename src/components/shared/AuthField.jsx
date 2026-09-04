import { useId, useState } from "react";

import { Eye, EyeOff } from "../icons";
import { cn } from "@/lib/utils";

/**
 * The 56px field the auth screens use.
 *
 * Taller than the 54px form field elsewhere, and that is the handoff's spec
 * rather than drift: signing in is done once, often on a shared machine, often
 * by somebody who is not confident, and the two fields on the screen can
 * afford to be the biggest things on it.
 *
 * THE PASSWORD TOGGLE SAYS "SHOW". An eye glyph on its own is the single most
 * common icon-only control on the web and still nobody is sure whether it
 * means "it is currently hidden" or "it is currently shown" — so it gets the
 * word beside it, and the word changes with the state. That is rule 3 applied
 * where it is least convenient and most needed.
 */
export default function AuthField({
  label,
  icon,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  invalid = false,
  disabled = false,
  hint,
}) {
  const id = useId();
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && revealed ? "text" : type;

  return (
    <div>
      <label htmlFor={id} className="block pb-2 text-[15.5px] font-bold text-ink">
        {label}
      </label>
      <div
        className={cn(
          "flex h-14 items-center gap-3 rounded-field border-[1.5px] bg-surface px-4 transition duration-150",
          "focus-within:border-cobalt focus-within:shadow-[0_0_0_4px_#1462c826]",
          invalid ? "border-red" : "border-field",
          disabled && "bg-tint-neutral"
        )}
      >
        {icon && (
          <span className="shrink-0 text-[20px] text-muted" aria-hidden="true">
            {icon}
          </span>
        )}
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          className="min-w-0 flex-1 bg-transparent text-[17px] text-ink outline-none placeholder:text-muted-2 disabled:cursor-not-allowed"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((previous) => !previous)}
            disabled={disabled}
            className="-mr-1.5 inline-flex h-11 shrink-0 items-center gap-1.5 rounded-btn px-2 text-[14.5px] font-bold text-cobalt dark:text-dk-cobalt transition duration-150 hover:bg-tint-cobalt"
          >
            {revealed ? (
              <EyeOff className="h-4.5 w-4.5" aria-hidden="true" />
            ) : (
              <Eye className="h-4.5 w-4.5" aria-hidden="true" />
            )}
            {revealed ? "Hide" : "Show"}
            <span className="sr-only"> the password</span>
          </button>
        )}
      </div>
      {hint && <p className="pt-2 text-[14.5px] leading-[1.45] text-muted">{hint}</p>}
    </div>
  );
}

/**
 * "Keep me signed in" — a 24px box with a 6px radius.
 *
 * A real checkbox under a styled span rather than a div pretending to be one,
 * so it is keyboard-reachable and announces its own state.
 */
export function Checkbox({ checked, onChange, label, id: providedId }) {
  const generated = useId();
  const id = providedId ?? generated;

  return (
    <span className="inline-flex items-center gap-2.5">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className={cn(
          "size-6 shrink-0 cursor-pointer appearance-none rounded-[6px] border-2 border-field bg-surface",
          "checked:border-cobalt checked:bg-cobalt",
          // The tick is drawn with a background image so the control stays a
          // real <input> — no wrapper div, no synced state to get wrong.
          "checked:bg-[url('data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22white%22%20stroke-width%3D%223%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M20%206%209%2017l-5-5%22%2F%3E%3C%2Fsvg%3E')]",
          "checked:bg-[length:15px_15px] checked:bg-center checked:bg-no-repeat"
        )}
      />
      <label htmlFor={id} className="cursor-pointer text-[15.5px] font-semibold text-ink">
        {label}
      </label>
    </span>
  );
}
