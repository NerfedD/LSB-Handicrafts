import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * shadcn/ui Button on Base UI, New York style.
 *
 * Each view has ONE `default` (blue) button: Sign in, New order, Add user.
 * Every other button is `outline` or `ghost`. Compose with `render`, never
 * `asChild`: `<Button render={<a href="…" />}>`.
 */
const buttonVariants = cva(
  [
    "inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-sm font-medium",
    "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
    "disabled:pointer-events-none disabled:opacity-50 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        default: "border-primary bg-primary text-on-primary shadow-xs hover:border-primary-hover hover:bg-primary-hover dark:hover:border-primary-press dark:hover:bg-primary-press",
        outline: "border-border bg-card text-foreground shadow-xs hover:bg-muted",
        secondary: "border-transparent bg-muted text-foreground hover:bg-muted-strong",
        ghost: "border-transparent bg-transparent text-foreground hover:bg-muted",
        destructive: "border-danger bg-danger text-on-primary shadow-xs hover:opacity-90",
        "destructive-outline": "border-border bg-card text-danger-fg shadow-xs hover:bg-danger-bg",
        link: "h-auto border-transparent px-0 text-primary-text underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 px-3",
        sm: "h-7 gap-1 px-2.5 text-13",
        lg: "h-9 px-4",
        icon: "size-8 p-0",
        "icon-sm": "size-7 p-0",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "default", size: "default", block: false },
  }
);

function Button({ className, variant, size, block, type, render, ...props }) {
  return (
    <ButtonPrimitive
      data-slot="button"
      type={render ? type : type ?? "button"}
      render={render}
      nativeButton={render ? false : undefined}
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
