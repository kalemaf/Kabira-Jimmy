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

export type MobileMoneyNetwork = "MTN" | "Airtel"

/**
 * Explicit MTN/Airtel picker for a Mobile Money number. Uganda's number
 * portability means the phone prefix alone doesn't reliably say which
 * network a number is on, so every Mobile Money form asks for this
 * directly instead of guessing from the digits.
 */
export function NetworkToggle({
  value,
  onChange,
  className,
}: {
  value: MobileMoneyNetwork | undefined
  onChange: (value: MobileMoneyNetwork) => void
  className?: string
}) {
  const options: { network: MobileMoneyNetwork; Badge: typeof MtnBadge }[] = [
    { network: "MTN", Badge: MtnBadge },
    { network: "Airtel", Badge: AirtelBadge },
  ]
  return (
    <div className={cn("flex gap-2", className)}>
      {options.map(({ network, Badge }) => (
        <button
          key={network}
          type="button"
          onClick={() => onChange(network)}
          className={cn(
            "rounded-md border-2 p-1 transition-colors",
            value === network
              ? "border-(--accent-500) bg-(--accent-soft)"
              : "border-transparent opacity-60 hover:opacity-100"
          )}
          aria-pressed={value === network}
        >
          <Badge />
        </button>
      ))}
    </div>
  )
}
