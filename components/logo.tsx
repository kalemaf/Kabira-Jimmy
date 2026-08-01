import Image from "next/image"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

const SIZES = {
  default: "size-9",
  lg: "size-14",
  xl: "size-16",
} as const

const PX_SIZES = {
  default: "36px",
  lg: "56px",
  xl: "64px",
} as const

export function Logo({
  className,
  badge,
  variant = "default",
  size = "default",
}: {
  className?: string
  badge?: "admin" | "member"
  /** "chrome" renders on the permanently-dark sidebar/masthead — the logo
   * artwork has an opaque light background, so it sits inside a white chip
   * there instead of floating directly on dark chrome. */
  variant?: "default" | "chrome"
  size?: keyof typeof SIZES
}) {
  const badgeColor = variant === "chrome" ? "text-(--sidebar-chrome-fg-muted) border-(--sidebar-chrome-border)" : "text-(--text-secondary)"

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className={cn(
          "relative block shrink-0 overflow-hidden rounded-lg",
          SIZES[size],
          variant === "chrome" && "bg-white p-1"
        )}
      >
        <Image
          src="/nexcgen.png"
          alt="Nexcgen"
          fill
          sizes={PX_SIZES[size]}
          priority
          className={cn("object-cover object-top", variant === "chrome" && "rounded-[5px]")}
        />
      </span>
      {badge ? (
        <Badge variant="outline" className={badgeColor}>
          {badge}
        </Badge>
      ) : null}
    </span>
  )
}
