"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Bell, LogOut, Menu } from "lucide-react"
import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { memberAuthClient } from "@/lib/member-auth-client"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const NAV_LINKS = [
  { href: "/member-portal/dashboard", label: "Overview" },
  { href: "/member-portal/dashboard/savings", label: "Savings" },
  { href: "/member-portal/dashboard/loans", label: "Loans" },
  { href: "/member-portal/dashboard/transactions", label: "Transactions" },
  { href: "/member-portal/dashboard/profile", label: "Profile" },
  { href: "/member-portal/dashboard/security", label: "Security" },
]

type NotificationItem = { id: string; message: string; at: string }

export function MemberHeader({ name }: { name: string }) {
  const router = useRouter()
  const pathname = usePathname()

  const { data } = useQuery({
    queryKey: ["member-notifications"],
    queryFn: async () => {
      const res = await fetch("/api/member-portal/notifications")
      if (!res.ok) throw new Error("Failed to load notifications")
      return res.json() as Promise<{ data: NotificationItem[] }>
    },
    staleTime: 30_000,
  })

  async function handleLogout() {
    await memberAuthClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          toast.success("Logged out successfully")
          router.push("/member-portal/auth/sign-in")
        },
        onError: (ctx) => {
          toast.error(ctx.error.message || "Failed to logout")
        },
      },
    })
  }

  return (
    <header className="sticky top-0 z-40 flex h-[68px] shrink-0 items-center justify-between border-b border-(--border-subtle) bg-(--bg-surface) px-4 md:px-8">
      <div className="flex items-center gap-6">
        <Logo badge="member" />
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
                pathname === link.href
                  ? "bg-(--bg-card-hover) text-(--text-primary)"
                  : "text-(--text-secondary) hover:bg-(--bg-card-hover) hover:text-(--text-primary)"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-(--text-secondary) transition-colors hover:bg-(--bg-card-hover) lg:hidden"
            aria-label="Menu"
          >
            <Menu className="size-[18px]" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 p-1.5">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm font-medium",
                  pathname === link.href ? "bg-(--bg-card-hover) text-(--text-primary)" : "text-(--text-secondary) hover:bg-(--bg-card-hover)"
                )}
              >
                {link.label}
              </Link>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="relative flex size-9 shrink-0 items-center justify-center rounded-full text-(--text-secondary) transition-colors hover:bg-(--bg-card-hover)"
            aria-label="Notifications"
          >
            <Bell className="size-[18px]" />
            {data && data.data.length > 0 ? (
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-(--error-600)" />
            ) : null}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-2">
            <p className="px-2 py-1.5 text-sm font-medium text-(--text-primary)">Recent activity</p>
            {!data || data.data.length === 0 ? (
              <p className="px-2 py-3 text-sm text-(--text-secondary)">You&apos;re all caught up.</p>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                {data.data.map((item) => (
                  <div key={item.id} className="rounded-md px-2 py-2 text-sm hover:bg-(--bg-card-hover)">
                    <p className="text-(--text-primary)">{item.message}</p>
                    <p className="text-xs text-(--text-secondary)">
                      {new Date(item.at).toLocaleString("en-UG", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="hidden text-sm text-(--text-secondary) sm:inline">{name}</span>
        <ThemeToggle />
        <Button variant="ghost" size="icon-sm" onClick={handleLogout} aria-label="Log out">
          <LogOut />
        </Button>
      </div>
    </header>
  )
}
