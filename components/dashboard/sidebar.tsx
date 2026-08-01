"use client"

import Link from "next/link"
import { ChevronLeft, ChevronRight, Plus, Building2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { SidebarNav } from "@/components/dashboard/sidebar-nav"
import { UserMenu } from "@/components/dashboard/user-menu"
import { useSidebar } from "@/components/dashboard/sidebar-context"
import type { SidebarUser } from "@/components/dashboard/user-menu"
import { HEAD_OFFICE_ROLES } from "@/components/dashboard/nav-config"
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet"

const APP_VERSION = "v0.1.0"

export type { SidebarUser }

function SidebarBody({
  user,
  collapsed,
  onNavigate,
}: {
  user: SidebarUser
  collapsed: boolean
  onNavigate?: () => void
}) {
  const isHeadOffice = HEAD_OFFICE_ROLES.includes(user.role)

  return (
    <div className="flex h-full flex-col px-4 py-5">
      <div
        className={cn(
          "flex h-16 shrink-0 items-center justify-between border-b border-(--sidebar-chrome-border) pb-4",
          collapsed && "justify-center"
        )}
      >
        <Link href="/dashboard" className="flex items-center gap-2">
          {collapsed ? (
            <span className="flex size-8 items-center justify-center rounded-md bg-(--sidebar-chrome-hover) text-sm font-semibold text-(--sidebar-chrome-fg)">
              NG
            </span>
          ) : (
            <Logo badge="admin" variant="chrome" />
          )}
        </Link>
        {!collapsed ? <ThemeToggle className="text-(--sidebar-chrome-fg-muted) hover:bg-(--sidebar-chrome-hover) hover:text-(--sidebar-chrome-fg)" /> : null}
      </div>

      {!collapsed && isHeadOffice ? (
        <button
          type="button"
          className="mt-4 flex h-10 shrink-0 items-center gap-2 rounded-[0.625rem] border border-(--sidebar-chrome-border) bg-(--sidebar-chrome-surface) px-3 text-sm text-(--sidebar-chrome-fg-muted) transition-colors hover:bg-(--sidebar-chrome-hover)"
          title="Branch filtering lands in Phase 2"
          disabled
        >
          <Building2 className="size-4" strokeWidth={1.75} />
          <span className="flex-1 truncate text-left">All branches (head office)</span>
        </button>
      ) : null}

      <SidebarNav role={user.role} collapsed={collapsed} onNavigate={onNavigate} />

      {!collapsed ? (
        <Button
          variant="outline"
          className="mb-3 w-full justify-center gap-1.5 border-(--sidebar-chrome-border) text-(--sidebar-chrome-fg) hover:bg-(--sidebar-chrome-hover)"
        >
          <Plus className="size-4" />
          Add new
        </Button>
      ) : null}

      <div className="shrink-0 border-t border-(--sidebar-chrome-border) pt-3">
        <UserMenu
          name={user.name}
          email={user.email}
          image={user.image}
          role={user.role}
          variant={collapsed ? "compact" : "full"}
          tone="chrome"
        />
        {!collapsed ? (
          <p className="mt-3 px-2 text-[11px] font-semibold tracking-[0.04em] text-(--sidebar-chrome-fg-muted) uppercase">
            Nexcgen {APP_VERSION}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export function Sidebar({ user }: { user: SidebarUser }) {
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebar()

  return (
    <>
      <aside
        className={cn(
          "relative hidden shrink-0 border-r border-(--sidebar-chrome-border) bg-(--sidebar-chrome-bg) transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] lg:block",
          collapsed ? "w-[72px]" : "w-[260px]"
        )}
      >
        <SidebarBody user={user} collapsed={collapsed} />
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute top-6 -right-3 flex size-6 items-center justify-center rounded-full border border-(--sidebar-chrome-border) bg-(--sidebar-chrome-surface) text-(--sidebar-chrome-fg-muted) shadow-[var(--shadow-sm)] transition-colors hover:bg-(--sidebar-chrome-hover)"
        >
          {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
        </button>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[260px] bg-(--sidebar-chrome-bg) p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarBody user={user} collapsed={false} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  )
}
