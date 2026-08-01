"use client"

import Link from "next/link"
import { ChevronsUpDown, User, KeyRound, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getInitials } from "@/lib/utils"
import { authClient } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ROLE_LABELS, type StaffRole } from "@/components/dashboard/nav-config"

export type SidebarUser = {
  name: string
  email: string
  image?: string | null
  role: StaffRole
}

const TONE_CLASSES = {
  default: {
    trigger: "hover:bg-(--bg-card-hover)",
    name: "text-(--text-primary)",
    role: "text-(--text-secondary)",
    chevron: "text-(--text-secondary)",
  },
  chrome: {
    trigger: "hover:bg-(--sidebar-chrome-hover)",
    name: "text-(--sidebar-chrome-fg)",
    role: "text-(--sidebar-chrome-fg-muted)",
    chevron: "text-(--sidebar-chrome-fg-muted)",
  },
  onBrand: {
    trigger: "hover:bg-white/15",
    name: "text-white",
    role: "text-white/75",
    chevron: "text-white/75",
  },
} as const

export function UserMenu({
  name,
  email,
  image,
  role,
  variant = "full",
  tone = "default",
}: SidebarUser & { variant?: "full" | "compact"; tone?: keyof typeof TONE_CLASSES }) {
  const compact = variant === "compact"
  const router = useRouter()
  const t = TONE_CLASSES[tone]

  async function handleLogout() {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          toast.success("Logged out successfully")
          router.push("/auth/sign-in")
        },
        onError: (ctx) => {
          toast.error(ctx.error.message || "Failed to logout")
        },
      },
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-2.5 rounded-[0.625rem] p-2 text-left transition-colors",
          t.trigger,
          !compact && "w-full"
        )}
      >
        <Avatar className="size-9 shrink-0">
          <AvatarImage src={image ?? undefined} alt={name} />
          <AvatarFallback>{getInitials(name || email)}</AvatarFallback>
        </Avatar>
        {!compact ? (
          <>
            <span className="min-w-0 flex-1">
              <span className={cn("block truncate text-sm font-medium", t.name)}>
                {name}
              </span>
              <span className={cn("block truncate text-xs", t.role)}>
                {ROLE_LABELS[role]}
              </span>
            </span>
            <ChevronsUpDown className={cn("size-4 shrink-0", t.chevron)} />
          </>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side={compact ? "bottom" : "top"} className="w-56">
        <DropdownMenuItem render={<Link href="/profile" />}>
          <User />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/auth/change-password" />}>
          <KeyRound />
          Change password
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={handleLogout}>
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
