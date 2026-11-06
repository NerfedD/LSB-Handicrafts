import { CaretRight } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * shadcn/ui Breadcrumb, as the TopBar draws it: 14px, the section in
 * --muted-fg, a 14px CaretRight in --muted-2, the page in --foreground medium.
 */
function Breadcrumb({ className, ...props }) {
  return <nav aria-label="Breadcrumb" className={cn("min-w-0", className)} {...props} />;
}

function BreadcrumbList({ className, ...props }) {
  return (
    <ol
      className={cn("m-0 flex list-none items-center gap-1.5 whitespace-nowrap p-0 text-sm", className)}
      {...props}
    />
  );
}

function BreadcrumbItem({ className, ...props }) {
  return <li className={cn("inline-flex min-w-0 items-center", className)} {...props} />;
}

function BreadcrumbLink({ className, ...props }) {
  return (
    <button
      type="button"
      className={cn("truncate text-muted-fg no-underline hover:text-foreground", className)}
      {...props}
    />
  );
}

function BreadcrumbPage({ className, ...props }) {
  return <span aria-current="page" className={cn("truncate font-medium text-foreground", className)} {...props} />;
}

function BreadcrumbSeparator({ className }) {
  return (
    <li aria-hidden="true" className={cn("flex text-muted-2", className)}>
      <CaretRight className="size-3.5" />
    </li>
  );
}

export { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator };
