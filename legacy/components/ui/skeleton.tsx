import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-shimmer rounded-md bg-gradient-to-r from-muted via-card to-muted bg-[length:1000px_100%]", className)}
      {...props}
    />
  )
}

export { Skeleton }
