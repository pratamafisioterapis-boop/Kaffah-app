import React, { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const PasswordInput = React.forwardRef(({ className, ...props }, ref) => {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input
        ref={ref}
        type={visible ? "text" : "password"}
        className={cn("pr-10", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600"
        aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
        tabIndex={-1}
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  )
})
PasswordInput.displayName = "PasswordInput"

export { PasswordInput }
