import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-11 w-full rounded-lg border border-gray-300 bg-background px-4 py-2 text-base text-foreground transition-all duration-200",
        "placeholder:text-muted-foreground/60",
        "hover:border-gray-400",
        "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted",
        "aria-invalid:border-status-error/50 aria-invalid:ring-status-error/10",
        className
      )}
      {...props}
    />
  )
}

export { Input }
