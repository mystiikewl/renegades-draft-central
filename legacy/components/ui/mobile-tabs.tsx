import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cn } from "@/lib/utils"
import { useResponsive } from "@/hooks/use-responsive"

const MobileTabs = TabsPrimitive.Root

const MobileTabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => {
  const { isMobile, tabLayout } = useResponsive()

  // Use horizontal scrolling for mobile, grid for desktop
  const layoutClass = isMobile
    ? "flex h-12 items-center justify-start overflow-x-auto snap-x snap-mandatory mobile-tabs-scroll px-2 gap-1"
    : "grid w-full grid-cols-4"

  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground mobile-tabs-container",
        layoutClass,
        className
      )}
      {...props}
    />
  )
})
MobileTabsList.displayName = TabsPrimitive.List.displayName

const MobileTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, ...props }, ref) => {
  const { isMobile } = useResponsive()

  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm transition-all mobile-tab-trigger",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        // Enhanced mobile-specific styling with animated gradients
        isMobile
          ? "px-4 py-3 min-w-[80px] h-10 text-sm snap-center flex-shrink-0 data-[state=active]:shadow-lg"
          : "px-3 py-1.5 text-sm font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
        className
      )}
      {...props}
    >
      {children}
    </TabsPrimitive.Trigger>
  )
})
MobileTabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const MobileTabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
MobileTabsContent.displayName = TabsPrimitive.Content.displayName

export { MobileTabs, MobileTabsList, MobileTabsTrigger, MobileTabsContent }