import * as React from "react"
import { cn } from "@/lib/utils"

const Progress = React.forwardRef(({ className, value, indicatorClassName, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative h-4 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800",
      className
    )}
    {...props}
    role="progressbar"
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={value}
  >
    <div
      className={cn("h-full w-full flex-1 bg-slate-900 transition-all dark:bg-slate-50", indicatorClassName)}
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </div>
))
Progress.displayName = "Progress"

export { Progress }