import { Info } from "../icons";
import Callout from "../shared/Callout";
import { cn } from "@/lib/utils";

/** A settings section: a 14px title and 13px line, then its fields, as the Settings boards draw them. */
export function SettingsSection({ id, title, description, action, children, className }) {
  return (
    <section aria-labelledby={id} className={cn("rounded-lg border border-border bg-card shadow-xs", className)}>
      <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
        <div className="min-w-0">
          <h2 id={id} className="m-0 text-sm font-semibold">{title}</h2>
          {description ? <p className="m-0 text-13 text-muted-fg">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="border-t border-border px-4 py-4">{children}</div>
    </section>
  );
}

/**
 * Said once at the top of a settings screen the app has no backend for, so
 * the disabled controls under it read as "not yet" rather than as broken.
 */
export function NotStoredYet({ children }) {
  return (
    <Callout tone="neutral" icon={<Info />} title="Nothing on this screen can be saved yet">
      {children}
    </Callout>
  );
}
