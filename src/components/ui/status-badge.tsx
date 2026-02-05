import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const statusBadgeVariants = cva(
  "inline-flex items-center gap-2.5 rounded-full px-4 py-2 text-sm font-medium transition-colors",
  {
    variants: {
      status: {
        // Legacy statuses
        "not-mentioned": "bg-status-error-muted text-status-error-foreground",
        "low-visibility": "bg-status-warning-muted text-status-warning-foreground",
        recommended: "bg-status-success-muted text-status-success-foreground",
        // Score-based statuses
        "excellent": "bg-status-success-muted text-status-success-foreground",
        "good": "bg-status-success-muted text-status-success-foreground",
        "moderate": "bg-status-warning-muted text-status-warning-foreground",
        "low": "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
        "very-low": "bg-status-error-muted text-status-error-foreground",
      },
      size: {
        default: "px-4 py-2 text-sm",
        lg: "px-5 py-2.5 text-base",
      },
    },
    defaultVariants: {
      status: "not-mentioned",
      size: "default",
    },
  }
)

const statusDotVariants = cva("size-2 rounded-full", {
  variants: {
    status: {
      // Legacy statuses
      "not-mentioned": "bg-status-error",
      "low-visibility": "bg-status-warning",
      recommended: "bg-status-success",
      // Score-based statuses
      "excellent": "bg-status-success",
      "good": "bg-status-success",
      "moderate": "bg-status-warning",
      "low": "bg-orange-500",
      "very-low": "bg-status-error",
    },
  },
  defaultVariants: {
    status: "not-mentioned",
  },
})

const statusLabels: Record<string, string> = {
  // Legacy labels
  "not-mentioned": "Not Mentioned",
  "low-visibility": "Low Visibility",
  recommended: "Recommended",
  // Score-based labels
  "excellent": "Excellent",
  "good": "Good",
  "moderate": "Moderate",
  "low": "Low",
  "very-low": "Very Low",
}

/**
 * Get status based on visibility score
 */
export function getStatusFromScore(score: number): "excellent" | "good" | "moderate" | "low" | "very-low" | "not-mentioned" {
  if (score >= 80) return "excellent"
  if (score >= 60) return "good"
  if (score >= 40) return "moderate"
  if (score >= 20) return "low"
  if (score > 0) return "very-low"
  return "not-mentioned"
}

interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusBadgeVariants> {
  showLabel?: boolean
  customLabel?: string
}

function StatusBadge({
  className,
  status = "not-mentioned",
  size,
  showLabel = true,
  customLabel,
  ...props
}: StatusBadgeProps) {
  const label = customLabel || (status ? statusLabels[status] : "Unknown")

  return (
    <div
      className={cn(statusBadgeVariants({ status, size, className }))}
      role="status"
      aria-label={label}
      {...props}
    >
      <span
        className={cn(statusDotVariants({ status }))}
        aria-hidden="true"
      />
      {showLabel && <span>{label}</span>}
    </div>
  )
}

export { StatusBadge, statusBadgeVariants }
export type { StatusBadgeProps }
