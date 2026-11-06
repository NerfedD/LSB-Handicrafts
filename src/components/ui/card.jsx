import { cn } from "@/lib/utils";

/**
 * Card: white on the page background, a 1px --border edge, 8px radius and
 * shadow-xs, which is the only elevation in the system.
 *
 * CardHeader is the board's section heading: 16px padding (12px under it), a
 * 14/20 semibold title, a 13/18 muted description and actions on the right.
 */
function Card({ className, ...props }) {
  return (
    <div
      data-slot="card"
      className={cn("rounded-lg border border-border bg-card text-foreground shadow-xs", className)}
      {...props}
    />
  );
}

function CardHeader({ className, title, description, action, children, ...props }) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex flex-wrap items-start justify-between gap-3 px-4 pb-3 pt-4", className)}
      {...props}
    >
      {title || description ? (
        <div className="min-w-0">
          {title ? <CardTitle>{title}</CardTitle> : null}
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
      ) : null}
      {children}
      {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}

function CardTitle({ className, as = "h2", ...props }) {
  const Comp = as;
  return <Comp data-slot="card-title" className={cn("m-0 text-sm font-semibold", className)} {...props} />;
}

function CardDescription({ className, ...props }) {
  return <p data-slot="card-description" className={cn("m-0 text-13 text-muted-fg", className)} {...props} />;
}

function CardContent({ className, ...props }) {
  return <div data-slot="card-content" className={cn("p-4", className)} {...props} />;
}

function CardFooter({ className, ...props }) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex flex-wrap items-center gap-2 border-t border-border px-4 py-2.5", className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
