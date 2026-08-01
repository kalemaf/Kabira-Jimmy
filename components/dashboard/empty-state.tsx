import type { LucideIcon } from "lucide-react"

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-4 py-16 text-center">
      <div className="mb-4 flex size-18 items-center justify-center rounded-full bg-(--bg-card-hover)">
        <Icon className="size-12 text-(--text-muted)" strokeWidth={1.75} />
      </div>
      <h3 className="text-[18px] font-semibold text-(--text-primary)">{title}</h3>
      {description ? (
        <p className="max-w-[400px] text-sm text-(--text-secondary)">{description}</p>
      ) : null}
      {action ? <div className="mt-8">{action}</div> : null}
    </div>
  )
}
