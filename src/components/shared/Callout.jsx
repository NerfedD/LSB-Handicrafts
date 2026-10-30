import { cloneElement, isValidElement } from "react";

import { cn } from "@/lib/utils";

/**
 * An inline message, drawn like the boards' status notes (the "Your password
 * is changed" note on Forgot password): 12px in, a 6px radius and a soft tint,
 * border and text from one status token, a 16px icon, 13px type.
 *
 * Status colour stays inside these small notes, as it does in badges.
 * `tone`: red / danger, amber / warning, green / success, anything else is
 * neutral zinc.
 */
const TONES = {
  danger: "border-danger-bd bg-danger-bg text-danger-fg",
  warning: "border-warning-bd bg-warning-bg text-warning-fg",
  success: "border-success-bd bg-success-bg text-success-fg",
  neutral: "border-border bg-muted text-foreground",
};

const toneKey = (tone) =>
  ({ red: "danger", danger: "danger", amber: "warning", warning: "warning", green: "success", success: "success" }[tone] ?? "neutral");

export default function Callout({ tone = "neutral", icon, title, children, action, className, role }) {
  const key = toneKey(tone);
  return (
    <div role={role} className={cn("flex items-start gap-2.5 rounded-md border p-3 text-13", TONES[key], className)}>
      {icon && isValidElement(icon) ? cloneElement(icon, { className: cn("mt-px size-4 shrink-0", icon.props.className), "aria-hidden": true }) : null}
      <div className="min-w-0 flex-1">
        {title ? <p className="m-0 font-medium">{title}</p> : null}
        {children ? <div className={cn("text-fg-2", title && "mt-0.5")}>{children}</div> : null}
        {action ? <div className="mt-2.5 flex flex-wrap gap-2">{action}</div> : null}
      </div>
    </div>
  );
}

/**
 * The account-removal block on the Account details board: a --card row with a
 * --danger-bd-strong edge, a 14px title and 13px muted line on the left, and
 * an outline danger button on the right.
 */
export function DangerBlock({ title, children, action, className }) {
  return (
    <section className={cn("flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger-bd-strong bg-card px-4 py-3.5", className)}>
      <div className="min-w-0 flex-[1_1_320px]">
        <h2 className="m-0 text-sm font-semibold">{title}</h2>
        <div className="mt-0.5 text-13 text-muted-fg">{children}</div>
      </div>
      {action}
    </section>
  );
}
