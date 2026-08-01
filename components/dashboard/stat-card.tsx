import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const ACCENT_COLORS = {
  neutral: { bar: "bg-(--accent-500)", chip: "bg-(--accent-soft) text-(--brand-blue)" },
  blue: { bar: "bg-(--brand-blue)", chip: "bg-[color-mix(in_srgb,var(--brand-blue)_14%,transparent)] text-(--brand-blue)" },
  green: { bar: "bg-(--brand-green)", chip: "bg-[color-mix(in_srgb,var(--brand-green)_14%,transparent)] text-(--brand-green)" },
  orange: { bar: "bg-(--brand-orange)", chip: "bg-[color-mix(in_srgb,var(--brand-orange)_16%,transparent)] text-(--brand-orange)" },
  purple: { bar: "bg-(--brand-purple)", chip: "bg-[color-mix(in_srgb,var(--brand-purple)_14%,transparent)] text-(--brand-purple)" },
} as const

export function StatCard({
  label,
  value,
  icon: Icon,
  color = "neutral",
}: {
  label: string
  value: string | number
  icon: LucideIcon
  /** Defaults to the plain neutral look — pass a brand color to make a card stand out (e.g. on the member dashboard). */
  color?: keyof typeof ACCENT_COLORS
}) {
  const accent = ACCENT_COLORS[color]
  return (
    <div className="relative overflow-hidden rounded-md border border-(--border-subtle) bg-(--bg-card) p-5">
      <span className={cn("absolute inset-y-0 left-0 w-1", accent.bar)} aria-hidden="true" />
      <div className="flex items-start justify-between pl-2">
        <p className="text-[11px] font-semibold tracking-[0.04em] text-(--text-secondary) uppercase">
          {label}
        </p>
        <span className={cn("flex size-7 items-center justify-center rounded-md", accent.chip)}>
          <Icon className="size-4" strokeWidth={1.75} />
        </span>
      </div>
      <p className="mt-2 pl-2 text-[26px] leading-[1.1] font-bold tracking-[-0.02em] text-(--text-primary) tabular-nums">
        {value}
      </p>
    </div>
  )
}
