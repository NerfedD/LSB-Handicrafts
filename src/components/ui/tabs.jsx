import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";

import { cn } from "@/lib/utils";

/**
 * shadcn/ui Tabs on Base UI, drawn as the boards' segmented control: a
 * --muted track 2px inside, 28px tabs, and one --card highlight that slides
 * between them (Tabs.Indicator) on the spring curve. The selected tab is
 * neutral, never blue.
 */
function Tabs({ className, ...props }) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col gap-4", className)} {...props} />;
}

function TabsList({ className, children, ...props }) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn("relative inline-flex w-fit items-center gap-0.5 rounded-md bg-muted p-0.5", className)}
      {...props}
    >
      {children}
      <TabsPrimitive.Indicator className="absolute left-[var(--active-tab-left)] top-[var(--active-tab-top)] h-[var(--active-tab-height)] w-[var(--active-tab-width)] rounded bg-card shadow-seg transition-[left,width] duration-[260ms] ease-spring" />
    </TabsPrimitive.List>
  );
}

function TabsTrigger({ className, ...props }) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative z-[1] inline-flex h-7 items-center justify-center gap-1.5 whitespace-nowrap rounded px-2.5 text-13 font-medium text-muted-fg outline-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        "data-[selected]:text-foreground data-[disabled]:opacity-50 [&_svg]:size-4",
        className
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }) {
  return <TabsPrimitive.Panel data-slot="tabs-content" className={cn("outline-none", className)} {...props} />;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
