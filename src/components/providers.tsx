"use client"

import { AuthProvider } from "@/lib/auth"
import { ToastProvider } from "@/components/ui/toast"
import type { ReactNode } from "react"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>{children}</ToastProvider>
    </AuthProvider>
  )
}
