"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { navSectionsForRole, type StaffRole } from "@/components/dashboard/nav-config"

export function SidebarNav({
  role,
  collapsed = false,
  onNavigate,
}: {
  role: StaffRole
  collapsed?: boolean
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const sections = navSectionsForRole(role)

  return (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto py-4">
      {sections.map((section) => (
        <div key={section.label}>
          {!collapsed ? (
            <p className="mb-3 px-3.5 text-[11px] font-semibold tracking-[0.04em] text-(--sidebar-chrome-fg-muted) uppercase">
              {section.label}
            </p>
          ) : null}
          <ul className="flex flex-col gap-1">
            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
              const Icon = item.icon
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "group relative flex h-[42px] items-center gap-3 rounded-[0.625rem] px-3.5 text-sm font-medium transition-colors",
                      "text-(--sidebar-chrome-fg-muted) hover:bg-(--sidebar-chrome-hover)",
                      active && "bg-(--sidebar-chrome-hover) font-semibold text-(--sidebar-chrome-fg)",
                      collapsed && "justify-center px-0"
                    )}
                  >
                    {active && !collapsed ? (
                      <span className="size-1.5 shrink-0 rounded-full bg-(--accent-500)" />
                    ) : null}
                    <Icon
                      className={cn(
                        "size-[18px] shrink-0",
                        active ? "text-(--accent-500)" : "text-(--sidebar-chrome-fg-muted)"
                      )}
                      strokeWidth={1.75}
                    />
                    {!collapsed ? <span className="truncate">{item.label}</span> : null}
                    {active && collapsed ? (
                      <span className="absolute left-1 size-1.5 rounded-full bg-(--accent-500)" />
                    ) : null}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
