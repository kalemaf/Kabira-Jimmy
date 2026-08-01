import Link from "next/link"
import {
  ChevronRight,
  HandCoins,
  PiggyBank,
  Users,
  Landmark,
  Activity,
  type LucideIcon,
} from "lucide-react"
import { REPORT_TYPES } from "@/lib/reports"

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Loans: HandCoins,
  Savings: PiggyBank,
  Members: Users,
  Finance: Landmark,
  Operations: Activity,
}

export function ReportsLanding() {
  const categories = Array.from(new Set(REPORT_TYPES.map((r) => r.category)))

  return (
    <div className="space-y-6">
      {categories.map((category) => {
        const CategoryIcon = CATEGORY_ICONS[category] ?? Activity
        return (
          <div key={category} className="overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-card)">
            <div className="flex items-center gap-2.5 border-b border-(--border-subtle) bg-(--bg-card-hover) px-5 py-3">
              <span className="h-4 w-1 shrink-0 rounded-full bg-(--accent-500)" aria-hidden="true" />
              <CategoryIcon className="size-4 text-(--accent-500)" strokeWidth={1.75} />
              <h3 className="text-[13px] font-semibold tracking-wide text-(--text-primary) uppercase">{category}</h3>
            </div>
            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {REPORT_TYPES.filter((r) => r.category === category).map((r) => (
                <Link
                  key={r.type}
                  href={`/dashboard/reports/${r.type}`}
                  className="group relative flex items-center gap-3 overflow-hidden rounded-md border border-(--border-subtle) bg-(--bg-canvas) p-4 transition-colors hover:border-(--accent-500)/40 hover:bg-(--bg-card-hover)"
                >
                  <span className="absolute inset-y-0 left-0 w-0.5 bg-(--accent-500) opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-(--accent-soft)">
                    <CategoryIcon className="size-[18px] text-(--accent-500)" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium text-(--text-primary)">{r.label}</span>
                  <ChevronRight className="size-4 shrink-0 text-(--text-muted) transition-transform group-hover:translate-x-0.5" strokeWidth={1.75} />
                </Link>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
