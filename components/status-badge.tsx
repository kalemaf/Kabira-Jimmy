import { cn } from "@/lib/utils"

export type Tone = "success" | "warning" | "error" | "info" | "neutral" | "accent" | "defaulted"

// design-style-guide.md §3 — the six distinct loan-status colors, including
// "Due Soon" (accent/orange) and "Defaulted" (a dark red distinct from the
// regular error/Overdue red).
const TONE_CLASSES: Record<Tone, string> = {
  success: "bg-(--success-soft) text-(--success-600)",
  warning: "bg-(--warning-soft) text-(--warning-600)",
  error: "bg-(--error-soft) text-(--error-600)",
  info: "bg-(--info-soft) text-(--info-600)",
  neutral: "bg-(--bg-card-hover) text-(--text-secondary)",
  accent: "bg-(--accent-soft) text-(--accent-500)",
  defaulted: "bg-[#1A0908] text-[#C4453F]",
}

const DOT_CLASSES: Record<Tone, string> = {
  success: "bg-(--success-600)",
  warning: "bg-(--warning-600)",
  error: "bg-(--error-600)",
  info: "bg-(--info-600)",
  neutral: "bg-(--text-secondary)",
  accent: "bg-(--accent-500)",
  defaulted: "bg-[#C4453F]",
}

const MEMBER_STATUS_TONE: Record<string, Tone> = {
  Active: "success",
  Inactive: "neutral",
  Suspended: "error",
}

const GUARANTOR_STATUS_TONE: Record<string, Tone> = {
  Active: "success",
  Blocked: "error",
}

export function StatusBadge({
  status,
  tone,
  label,
}: {
  status: string
  tone?: Tone
  label?: string
}) {
  const resolvedTone =
    tone ?? MEMBER_STATUS_TONE[status] ?? GUARANTOR_STATUS_TONE[status] ?? "neutral"

  return (
    <span
      className={cn(
        "inline-flex h-[26px] items-center rounded-full px-3 text-xs font-medium",
        TONE_CLASSES[resolvedTone]
      )}
    >
      <span className={cn("mr-1.5 size-1.5 rounded-full", DOT_CLASSES[resolvedTone])} />
      {label ?? status}
    </span>
  )
}
