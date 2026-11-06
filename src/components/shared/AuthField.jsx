import { useId, useState } from "react";

import { Eye, EyeSlash } from "../icons";
import { Checkbox as CheckboxBox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/**
 * A field on the sign-in and password screens, as the Login board draws it:
 * a 14/500 label 6px above a 32px input, with a 12px muted hint or a 12px
 * danger error under it.
 *
 * A password field keeps the app's reveal control: a word ("Show" / "Hide")
 * inside the field's right edge, so the password can be checked before
 * submitting. `labelAction` sits on the label's row (the board puts
 * "Forgot password?" there).
 */
export default function AuthField({
  label,
  labelAction,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  invalid = false,
  disabled = false,
  hint,
  error,
}) {
  const id = useId();
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">{label}</label>
        {labelAction}
      </div>
      <div className="relative">
        <input
          id={id}
          type={isPassword && revealed ? "text" : type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-invalid={invalid || Boolean(error) || undefined}
          aria-describedby={describedBy}
          className={cn(
            "lsb-field h-8 w-full rounded-md border border-border bg-card px-2.5 text-sm text-foreground shadow-xs placeholder:text-muted-2",
            "aria-[invalid=true]:border-danger disabled:cursor-not-allowed disabled:opacity-60",
            isPassword && "pr-[68px]"
          )}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setRevealed((previous) => !previous)}
            disabled={disabled}
            data-slot="text-link"
            className="absolute inset-y-0 right-1 my-auto inline-flex h-6 items-center gap-1 rounded px-1.5 text-xs font-medium text-muted-fg hover:bg-muted hover:text-foreground"
          >
            {revealed ? <EyeSlash className="size-3.5" aria-hidden="true" /> : <Eye className="size-3.5" aria-hidden="true" />}
            {revealed ? "Hide" : "Show"}
            <span className="sr-only"> the password</span>
          </button>
        ) : null}
      </div>
      {error ? (
        <p id={`${id}-error`} className="m-0 text-xs font-medium text-danger-fg">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="m-0 text-xs text-muted-fg">{hint}</p>
      ) : null}
    </div>
  );
}

/** A checkbox with its label beside it: "Keep me signed in on this computer". */
export function Checkbox({ checked, onChange, label, id: providedId, disabled }) {
  const generated = useId();
  const id = providedId ?? generated;
  return (
    <span className="inline-flex items-center gap-2">
      <CheckboxBox id={id} checked={checked} disabled={disabled} onCheckedChange={(next) => onChange(Boolean(next))} />
      <label htmlFor={id} className="cursor-pointer text-sm">{label}</label>
    </span>
  );
}
