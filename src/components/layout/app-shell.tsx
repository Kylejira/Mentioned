"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { cn } from "@/lib/utils"
import { LogOut, Settings, ChevronDown, User, Menu, X } from "lucide-react"

interface AppShellProps {
  children: React.ReactNode
}

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/history", label: "History" },
  { href: "/settings", label: "Settings" },
]

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut } = useAuth()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    router.push("/")
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        {/* Navigation */}
        <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="flex h-14 items-center justify-between">
              {/* Logo */}
              <Link
                href="/dashboard"
                className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
              >
                <Image
                  src="/logo.png"
                  alt="Mentioned"
                  width={28}
                  height={28}
                  className="rounded-lg"
                />
                <span className="font-semibold text-foreground hidden sm:inline">Mentioned</span>
              </Link>

              {/* Desktop Navigation items */}
              <nav className="hidden sm:flex items-center gap-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "px-3 py-1.5 text-sm font-medium rounded-full transition-colors",
                        isActive
                          ? "text-foreground bg-muted"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </nav>

              <div className="flex items-center gap-2">
                {/* User menu (desktop) */}
                <div className="relative hidden sm:block">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted/50"
                  >
                    <div className="size-6 rounded-full bg-muted flex items-center justify-center">
                      <User className="size-3.5 text-muted-foreground" />
                    </div>
                    <span className="max-w-[120px] truncate">
                      {user?.email?.split("@")[0] || "Demo"}
                    </span>
                    <ChevronDown className="size-3.5" />
                  </button>

                  {/* Desktop Dropdown */}
                  {userMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setUserMenuOpen(false)}
                      />
                      <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-border bg-card shadow-lg z-50 overflow-hidden animate-fade-in">
                        <div className="px-3 py-2 border-b border-border">
                          <p className="text-xs text-muted-foreground">
                            {user ? "Signed in as" : "Demo mode"}
                          </p>
                          <p className="text-sm text-foreground truncate">
                            {user?.email || "No auth configured"}
                          </p>
                        </div>
                        <div className="py-1">
                          <Link
                            href="/settings"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          >
                            <Settings className="size-4" />
                            Settings
                          </Link>
                          {user && (
                            <button
                              onClick={handleSignOut}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            >
                              <LogOut className="size-4" />
                              Log out
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Mobile menu button */}
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="sm:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div className="sm:hidden border-t border-border bg-card animate-fade-in">
              <div className="px-4 py-3 space-y-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "block px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                        isActive
                          ? "text-foreground bg-muted"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </div>
              <div className="px-4 py-3 border-t border-border">
                <div className="flex items-center gap-3 mb-3">
                  <div className="size-8 rounded-full bg-muted flex items-center justify-center">
                    <User className="size-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {user?.email || "Demo mode"}
                    </p>
                  </div>
                </div>
                {user && (
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                  >
                    <LogOut className="size-4" />
                    Log out
                  </button>
                )}
              </div>
            </div>
          )}
        </header>

        {/* Main content */}
        <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-10">
          {children}
        </main>
      </div>
    </ProtectedRoute>
  )
}
