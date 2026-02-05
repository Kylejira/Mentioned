"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Check, X, AlertCircle, Info } from "lucide-react"

type ToastType = "success" | "error" | "info"

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextValue {
  toasts: Toast[]
  showToast: (message: string, type?: ToastType) => void
  dismissToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, message, type }])

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3000)
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return context
}

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[]
  onDismiss: (id: string) => void
}) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg animate-fade-up",
            "bg-card border border-border min-w-[280px] max-w-[400px]"
          )}
        >
          <ToastIcon type={toast.type} />
          <span className="text-sm text-foreground flex-1">{toast.message}</span>
          <button
            onClick={() => onDismiss(toast.id)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

function ToastIcon({ type }: { type: ToastType }) {
  switch (type) {
    case "success":
      return (
        <div className="size-6 rounded-full bg-status-success-muted flex items-center justify-center">
          <Check className="size-3.5 text-status-success" />
        </div>
      )
    case "error":
      return (
        <div className="size-6 rounded-full bg-status-error-muted flex items-center justify-center">
          <AlertCircle className="size-3.5 text-status-error" />
        </div>
      )
    case "info":
      return (
        <div className="size-6 rounded-full bg-muted flex items-center justify-center">
          <Info className="size-3.5 text-muted-foreground" />
        </div>
      )
  }
}
