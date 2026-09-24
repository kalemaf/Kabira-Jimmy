import * as React from "react"
import { cn } from "@/lib/utils"

/** Colored provider badges so members can recognize their Mobile Money network at a glance, instead of a generic phone icon. */
function ProviderBadge({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        "flex h-8 min-w-11 items-center justify-center rounded-md px-1.5 text-[11px] font-extrabold tracking-tight",
        className
      )}
    >
      {children}
    </span>
  )
}

export function MtnBadge({ className }: { className?: string }) {
  return (
    <ProviderBadge className={cn("bg-[#FFCC08] text-black", className)}>
      MTN
    </ProviderBadge>
  )
}

export function AirtelBadge({ className }: { className?: string }) {
  return (
    <ProviderBadge
      className={cn(
        "bg-[#ED1C24] font-serif text-sm text-white lowercase italic",
        className
      )}
    >
      airtel
    </ProviderBadge>
  )
}

export function MobileMoneyBadges({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-1.5", className)}>
      <MtnBadge />
      <AirtelBadge />
    </span>
  )
}
