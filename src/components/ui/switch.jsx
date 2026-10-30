import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

/**
 * shadcn/ui Switch on Base UI: a 32 x 18 track, --muted-strong off and
 * --primary on, with a 14px --thumb that springs across (index.css).
 */
function Switch({ className, ...props }) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "relative inline-flex h-[18px] w-8 shrink-0 cursor-pointer items-center rounded-full bg-muted-strong outline-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        "data-[checked]:bg-primary data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-switch-thumb
        className="pointer-events-none block size-3.5 translate-x-0.5 rounded-full bg-thumb shadow-[0_1px_2px_rgba(0,0,0,0.2)] data-[checked]:translate-x-4"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
