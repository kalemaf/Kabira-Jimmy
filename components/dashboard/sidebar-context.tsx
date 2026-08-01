"use client"

import * as React from "react"

type SidebarContextValue = {
  collapsed: boolean
  toggleCollapsed: () => void
  mobileOpen: boolean
  setMobileOpen: (open: boolean) => void
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null)

const STORAGE_KEY = "sacco-sidebar-collapsed"

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)

  React.useEffect(() => {
    // Deferred to an effect (not a lazy initializer) so the client's first
    // render matches the server's, then corrects itself — reading
    // localStorage during render would cause a hydration mismatch.
    const stored = window.localStorage.getItem(STORAGE_KEY)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored === "1") setCollapsed(true)
  }, [])

  const toggleCollapsed = React.useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0")
      return next
    })
  }, [])

  return (
    <SidebarContext.Provider value={{ collapsed, toggleCollapsed, mobileOpen, setMobileOpen }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const ctx = React.useContext(SidebarContext)
  if (!ctx) throw new Error("useSidebar must be used within a SidebarProvider")
  return ctx
}
