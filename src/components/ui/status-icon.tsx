import * as React from "react"
import { Check, AlertTriangle, X } from "lucide-react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const statusIconVariants = cva(
  "inline-flex items-center justify-center rounded-full",
  {
    variants: {
      status: {
        success: "text-status-success",
        warning: "text-status-warning",
        error: "text-status-error",
      },
      size: {
        sm: "size-4",
        default: "size-5",
        lg: "size-6",
      },
      withBackground: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      {
        status: "success",
        withBackground: true,
        className: "bg-status-success-muted",
      },
      {
        status: "warning",
        withBackground: true,
        className: "bg-status-warning-muted",
      },
      {
        status: "error",
        withBackground: true,
        className: "bg-status-error-muted",
      },
      {
        withBackground: true,
        size: "sm",
        className: "size-6 p-1",
      },
      {
        withBackground: true,
        size: "default",
        className: "size-7 p-1.5",
      },
      {
        withBackground: true,
        size: "lg",
        className: "size-9 p-2",
      },
    ],
    defaultVariants: {
      status: "success",
      size: "default",
      withBackground: false,
    },
  }
)

const iconMap = {
  success: Check,
  warning: AlertTriangle,
  error: X,
}

const statusLabels: Record<string, string> = {
  success: "Success",
  warning: "Warning",
  error: "Error",
}

interface StatusIconProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusIconVariants> {
  "aria-label"?: string
}

function StatusIcon({
  className,
  status = "success",
  size = "default",
  withBackground = false,
  "aria-label": ariaLabel,
  ...props
}: StatusIconProps) {
  const Icon = status ? iconMap[status] : Check
  const label = ariaLabel || (status ? statusLabels[status] : "Status")

  return (
    <span
      className={cn(statusIconVariants({ status, size, withBackground, className }))}
      role="img"
      aria-label={label}
      {...props}
    >
      <Icon className="size-full" strokeWidth={2.5} />
    </span>
  )
}

export { StatusIcon, statusIconVariants }
export type { StatusIconProps }
