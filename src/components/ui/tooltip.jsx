import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

import { cn } from "@/lib/utils";

/**
 * shadcn/ui Tooltip on Base UI: --inverse with --inverse-fg, 12/16, a 6px
 * radius, 6px by 10px. Used for nav icons when the sidebar is collapsed.
 */
function TooltipProvider({ delay = 300, ...props }) {
  return <TooltipPrimitive.Provider delay={delay} {...props} />;
}

function Tooltip(props) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger(props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({ className, side = "right", sideOffset = 8, children, ...props }) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner side={side} sideOffset={sideOffset} className="z-50">
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn("lsb-tip whitespace-nowrap rounded-md bg-inverse px-2.5 py-1.5 text-xs text-inverse-fg", className)}
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent };
