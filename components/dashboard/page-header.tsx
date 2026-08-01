"use client"

import { Menu, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSidebar } from "@/components/dashboard/sidebar-context"
import Link from "next/link"

export type Breadcrumb = { label: string; href?: string }

export function PageHeader({
  title,
  breadcrumbs,
  actions,
}: {
  title: string
  breadcrumbs?: Breadcrumb[]
  /** @deprecated no longer rendered here — user menu now lives in the persistent masthead. Kept optional for callers that still pass it. */
  user?: unknown
  actions?: React.ReactNode
}) {
  const { setMobileOpen } = useSidebar()

  return (
    <header className="sticky top-14 z-30 flex h-[68px] shrink-0 items-center gap-4 border-b border-(--border-subtle) bg-(--bg-surface) px-4 md:px-8">
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
      >
        <Menu />
      </Button>

      <div className="min-w-0 flex-1">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <ol className="mb-0.5 flex items-center gap-1.5 text-[13px] text-(--text-secondary)">
            {breadcrumbs.map((crumb, i) => (
              <li key={i} className="flex items-center gap-1.5">
                {i > 0 ? <ChevronRight className="size-3" /> : null}
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-(--text-primary)">
                    {crumb.label}
                  </Link>
                ) : (
                  <span>{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        ) : null}
        <h1 className="flex items-center gap-2.5 truncate text-[18px] leading-[1.2] font-semibold tracking-[-0.015em] text-(--text-primary)">
          <span className="h-4 w-1 shrink-0 rounded-full bg-(--accent-500)" aria-hidden="true" />
          <span className="truncate">{title}</span>
        </h1>
      </div>

      {actions}
    </header>
  )
}
