import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-blue-600 text-white hover:bg-blue-700",
        secondary:
          "border-transparent bg-slate-100 text-slate-900 hover:bg-slate-200",
        destructive:
          "border-transparent bg-red-100 text-red-700 hover:bg-red-200",
        outline: "text-slate-700 border-slate-200",
        success: "border-transparent bg-green-100 text-green-800 hover:bg-green-200",
        warning: "border-transparent bg-orange-100 text-orange-800 hover:bg-orange-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({ className, variant, ...props }) {
  return (
    <div className={cn(badgeVariants({ variant }), className || "")} {...props} />
  )
}

export { Badge, badgeVariants }