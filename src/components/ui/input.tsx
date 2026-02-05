import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-11 w-full rounded-xl border border-border bg-background px-4 py-2 text-base text-foreground transition-all duration-200",
        "placeholder:text-muted-foreground/60",
        "hover:border-border/80",
        "focus:border-foreground/20 focus:outline-none focus:ring-2 focus:ring-ring/10",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted",
        "aria-invalid:border-status-error/50 aria-invalid:ring-status-error/10",
        className
      )}
      {...props}
    />
  )
}

export { Input }
