"use client"

import { Infinity, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface ScansRemainingProps {
  plan: "free" | "starter" | "pro"
  scansUsed: number
  scansLimit: number | null
  scansRemaining: number | null
  nextResetDate: string | null
  className?: string
}

export function ScansRemaining({
  plan,
  scansUsed,
  scansLimit,
  scansRemaining,
  nextResetDate,
  className,
}: ScansRemainingProps) {
  // Pro plan - unlimited
  if (plan === "pro") {
    return (
      <div className={cn("flex items-center gap-2 text-sm", className)}>
        <div className="flex items-center gap-1.5 text-blue-600">
          <Infinity className="size-4" />
          <span className="text-xs font-medium">Unlimited scans</span>
        </div>
      </div>
    )
  }

  // Starter plan
  if (plan === "starter" && scansLimit) {
    const remaining = scansRemaining ?? 0
    const percentUsed = (scansUsed / scansLimit) * 100
    const isLow = remaining <= 2
    const isEmpty = remaining === 0

    const formatResetDate = () => {
      if (!nextResetDate) return null
      return new Date(nextResetDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    }

    return (
      <div className={cn("text-sm", className)}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className={cn(
            "font-medium",
            isEmpty ? "text-red-600" : isLow ? "text-amber-600" : "text-[#1E293B]"
          )}>
            {remaining} of {scansLimit} scans remaining
          </span>
          {isLow && !isEmpty && (
            <AlertCircle className="size-3.5 text-amber-500" />
          )}
        </div>
        
        {/* Progress bar */}
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden w-32">
          <div 
            className={cn(
              "h-full rounded-full transition-all duration-300",
              isEmpty ? "bg-red-500" : isLow ? "bg-amber-500" : "bg-[#2563EB]"
            )}
            style={{ width: `${Math.min(percentUsed, 100)}%` }}
          />
        </div>

        {nextResetDate && (
          <p className="text-xs text-[#9CA3AF] mt-1">
            Resets {formatResetDate()}
          </p>
        )}
      </div>
    )
  }

  // Free plan
  const hasFreeScan = scansRemaining === 1

  return (
    <div className={cn("text-sm", className)}>
      <div className="flex items-center gap-2">
        <span className={cn(
          "font-medium",
          hasFreeScan ? "text-[#1E293B]" : "text-[#9CA3AF]"
        )}>
          {hasFreeScan ? "1 free scan available" : "Free scan used"}
        </span>
      </div>
      {!hasFreeScan && (
        <p className="text-xs text-[#64748B] mt-0.5">
          Upgrade to run more scans
        </p>
      )}
    </div>
  )
}

// Compact version for header/navbar
export function ScansRemainingBadge({
  plan,
  scansRemaining,
  scansLimit,
}: {
  plan: "free" | "starter" | "pro"
  scansRemaining: number | null
  scansLimit: number | null
}) {
  if (plan === "pro") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#10B981] bg-emerald-50 px-2 py-1 rounded-full">
        <Infinity className="size-3" />
        Unlimited
      </span>
    )
  }

  if (plan === "starter" && scansLimit) {
    const remaining = scansRemaining ?? 0
    const isLow = remaining <= 2
    const isEmpty = remaining === 0

    return (
      <span className={cn(
        "inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
        isEmpty 
          ? "text-red-600 bg-red-50" 
          : isLow 
            ? "text-amber-600 bg-amber-50"
            : "text-[#64748B] bg-gray-100"
      )}>
        {remaining}/{scansLimit} scans
      </span>
    )
  }

  // Free
  const hasFreeScan = scansRemaining === 1
  return (
    <span className={cn(
      "inline-flex items-center text-xs font-medium px-2 py-1 rounded-full",
      hasFreeScan ? "text-[#64748B] bg-gray-100" : "text-[#9CA3AF] bg-gray-50"
    )}>
      {hasFreeScan ? "1 free scan" : "Free"}
    </span>
  )
}
