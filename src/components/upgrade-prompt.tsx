"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Sparkles, Lock, Zap, ArrowRight, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface UpgradePromptProps {
  feature: "scan" | "generate"
  onClose?: () => void
  inline?: boolean
  className?: string
}

const featureMessages = {
  scan: {
    title: "Unlock Unlimited Scans",
    description: "You've used your free scan. Upgrade to Pro to run unlimited visibility scans and track your progress over time.",
    icon: Zap,
  },
  generate: {
    title: "Unlock AI Content Generation",
    description: "Upgrade to Pro to generate comparison pages, FAQ content, and homepage copy with AI — all tailored to your product.",
    icon: Sparkles,
  },
}

export function UpgradePrompt({ feature, onClose, inline = false, className }: UpgradePromptProps) {
  const router = useRouter()
  const message = featureMessages[feature]
  const Icon = message.icon

  const handleUpgrade = () => {
    router.push("/pricing")
  }

  if (inline) {
    // Inline version for embedding in page
    return (
      <div className={cn("bg-muted/50 border border-border rounded-xl p-6", className)}>
        <div className="flex items-start gap-4">
          <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Lock className="size-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">{message.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{message.description}</p>
            <Button onClick={handleUpgrade} className="mt-4" size="sm">
              <Sparkles className="size-4 mr-2" />
              Upgrade to Pro
              <ArrowRight className="size-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Modal/overlay version
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <Card className="relative w-full max-w-md animate-fade-up z-10">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-5" />
          </button>
        )}
        
        <CardContent className="p-8 text-center">
          <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Icon className="size-8 text-primary" />
          </div>
          
          <h2 className="text-xl font-semibold text-foreground">
            {message.title}
          </h2>
          
          <p className="text-muted-foreground mt-3">
            {message.description}
          </p>
          
          <div className="mt-8 space-y-3">
            <Button onClick={handleUpgrade} className="w-full" size="lg">
              <Sparkles className="size-4 mr-2" />
              Upgrade to Pro
            </Button>
            
            {onClose && (
              <Button variant="ghost" onClick={onClose} className="w-full">
                Maybe later
              </Button>
            )}
          </div>
          
          <p className="text-xs text-muted-foreground mt-6">
            Pro plan: $29/month • Cancel anytime
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Button wrapper that shows upgrade prompt if feature is locked
 */
interface GatedButtonProps {
  feature: "scan" | "generate"
  canAccess: boolean
  onClick: () => void
  children: React.ReactNode
  className?: string
  variant?: "default" | "secondary" | "ghost" | "outline"
  size?: "default" | "sm" | "lg" | "icon"
  disabled?: boolean
}

export function GatedButton({
  feature,
  canAccess,
  onClick,
  children,
  className,
  variant = "default",
  size = "default",
  disabled = false,
}: GatedButtonProps) {
  const router = useRouter()

  const handleClick = () => {
    if (canAccess) {
      onClick()
    } else {
      router.push("/pricing")
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={disabled}
      className={cn(className, !canAccess && "opacity-90")}
    >
      {!canAccess && <Lock className="size-3.5 mr-1.5" />}
      {children}
    </Button>
  )
}
