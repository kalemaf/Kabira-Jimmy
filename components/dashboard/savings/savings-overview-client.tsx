"use client"

import { useQuery } from "@tanstack/react-query"
import { PiggyBank, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/dashboard/empty-state"
import { StatusBadge } from "@/components/status-badge"
import { PaginatedTable, type Column } from "@/components/dashboard/paginated-table"
import { useTableQuery } from "@/hooks/use-table-query"
import { formatUGX } from "@/lib/utils"

type DayEntry = { date: string; saved: boolean }

type MemberSavingsRow = {
  memberId: string
  firstName: string
  lastName: string
  memberNumber: string
  status: string
  branchName: string
  totalBalance: number
  accountCount: number
  hasDailyAccount: boolean
  dailyStreak: DayEntry[]
}

type Response = { data: MemberSavingsRow[]; total: number; page: number; totalPages: number }

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function DailyStreak({ streak, hasDailyAccount }: { streak: DayEntry[]; hasDailyAccount: boolean }) {
  if (!hasDailyAccount) {
    return <span className="text-xs text-(--text-muted)">No daily plan</span>
  }
  const today = todayKey()
  return (
    <div className="flex items-center gap-[3px]" title="Last 14 days — green means saved, red means skipped">
      {streak.map((day) => {
        const isToday = day.date === today
        const color = day.saved
          ? "bg-(--success-600)"
          : isToday
            ? "bg-(--border-strong)"
            : "bg-(--error-600)"
        return <span key={day.date} className={`size-2 rounded-full ${color}`} title={`${day.date} — ${day.saved ? "saved" : isToday ? "not yet today" : "skipped"}`} />
      })}
    </div>
  )
}

export function SavingsOverviewClient() {
  const { page, search, setSearch, setPage } = useTableQuery()

  const { data, isLoading } = useQuery({
    queryKey: ["savings-overview", { page, search }],
    queryFn: async () => {
      const url = new URL("/api/savings/overview", window.location.origin)
      url.searchParams.set("page", String(page))
      url.searchParams.set("limit", "20")
      if (search) url.searchParams.set("search", search)
      const res = await fetch(url)
      if (!res.ok) throw new Error("Failed to load savings overview")
      return res.json() as Promise<Response>
    },
    staleTime: 30_000,
  })

  const columns: Column<MemberSavingsRow & { id: string }>[] = [
    {
      key: "member",
      header: "Member",
      render: (r) => (
        <div>
          <p className="font-medium text-(--text-primary)">{r.firstName} {r.lastName}</p>
          <p className="text-xs text-(--text-secondary)">{r.memberNumber} · {r.branchName}</p>
        </div>
      ),
    },
    {
      key: "accounts",
      header: "Accounts",
      render: (r) => <span>{r.accountCount}</span>,
    },
    {
      key: "streak",
      header: "Last 14 days",
      render: (r) => <DailyStreak streak={r.dailyStreak} hasDailyAccount={r.hasDailyAccount} />,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "total",
      header: "Total savings",
      align: "right",
      render: (r) => <span className="font-mono tabular-nums text-(--text-primary)">{formatUGX(r.totalBalance)}</span>,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-(--text-muted)" />
        <Input
          placeholder="Search member..."
          className="rounded-full pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <p className="text-xs text-(--text-secondary)">
        Green dots mean a deposit was recorded that day on a Daily savings account; red dots mean the member
        skipped it. Members without a Daily account show &quot;No daily plan&quot; instead.
      </p>

      <PaginatedTable
        columns={columns}
        rows={(data?.data ?? []).map((r) => ({ ...r, id: r.memberId }))}
        page={page}
        totalPages={data?.totalPages ?? 1}
        total={data?.total ?? 0}
        onPageChange={setPage}
        isLoading={isLoading}
        rowHref={(r) => `/dashboard/members/${r.memberId}`}
        emptyState={
          <EmptyState
            icon={PiggyBank}
            title="No members yet"
            description="Every registered member will appear here with their savings summary."
          />
        }
      />
    </div>
  )
}
