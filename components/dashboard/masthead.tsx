import { Bell } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { UserMenu, type SidebarUser } from "@/components/dashboard/user-menu"
import { GlobalSearch } from "@/components/dashboard/global-search"

export function Masthead({ user }: { user: SidebarUser }) {
  return (
    <div className="bg-brand-gradient sticky top-0 z-40 flex h-14 shrink-0 items-center gap-4 px-4 shadow-[var(--shadow-sm)] md:px-8">
      <span className="shrink-0 text-[19px] font-bold tracking-[-0.01em] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]">
        nexcgen
      </span>

      <div className="flex-1" />

      <GlobalSearch />

      <DropdownMenu>
        <DropdownMenuTrigger className="flex size-9 shrink-0 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15" aria-label="Notifications">
          <Bell className="size-[18px]" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72 p-3">
          <p className="text-sm font-medium text-(--text-primary)">Notifications</p>
          <p className="mt-1 text-sm text-(--text-secondary)">You&apos;re all caught up.</p>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="hidden md:block">
        <UserMenu name={user.name} email={user.email} image={user.image} role={user.role} variant="compact" tone="onBrand" />
      </div>
    </div>
  )
}
