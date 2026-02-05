"use client"

import { useState, type ReactNode } from "react"
import { Button } from "./button"
import { cn } from "@/lib/utils"
import { X, AlertTriangle } from "lucide-react"

interface ConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmText?: string
  confirmWord?: string // If set, user must type this word to confirm
  variant?: "danger" | "warning" | "default"
  loading?: boolean
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  confirmWord,
  variant = "default",
  loading = false,
}: ConfirmModalProps) {
  const [inputValue, setInputValue] = useState("")

  if (!open) return null

  const canConfirm = !confirmWord || inputValue.toUpperCase() === confirmWord.toUpperCase()

  const handleConfirm = () => {
    if (canConfirm) {
      onConfirm()
      setInputValue("")
    }
  }

  const handleClose = () => {
    setInputValue("")
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 animate-fade-in"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-card rounded-2xl shadow-xl animate-scale-in">
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-0">
          <div className="flex items-center gap-3">
            {variant === "danger" && (
              <div className="size-10 rounded-full bg-status-error-muted flex items-center justify-center">
                <AlertTriangle className="size-5 text-status-error" />
              </div>
            )}
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-muted-foreground mb-4">{description}</p>

          {confirmWord && (
            <div className="mb-4">
              <label className="text-sm font-medium text-foreground mb-2 block">
                Type <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{confirmWord}</span> to confirm
              </label>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className={cn(
                  "w-full h-11 rounded-xl border border-border bg-background px-4 text-foreground",
                  "focus:outline-none focus:ring-2 focus:ring-ring/10"
                )}
                placeholder={confirmWord}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant={variant === "danger" ? "destructive" : "default"}
              onClick={handleConfirm}
              disabled={!canConfirm || loading}
            >
              {loading ? "Processing..." : confirmText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
