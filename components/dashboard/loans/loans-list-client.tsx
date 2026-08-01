"use client"

import { useQuery } from "@tanstack/react-query"
import { HandCoins, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { PaginatedTable, type Column } from "@/components/dashboard/paginated-table"
import { EmptyState } from "@/components/dashboard/empty-state"
import { StatusBadge } from "@/components/status-badge"
import { useTableQuery } from "@/hooks/use-table-query"
import { formatUGX } from "@/lib/utils"
import type { LoanDisplayStatus } from "@/lib/loan-status"

type Loan = {
  id: string
  principal: number
  disbursedAt: string
  member: { firstName: string; lastName: string; memberNumber: string }
  branch: { name: string }
  displayStatus: LoanDisplayStatus
}

type Response = { data: Loan[]; total: number; page: number; totalPages: number }

export function LoansListClient() {
  const { page, search, setSearch, setPage } = useTableQuery()

  const { data, isLoading } = useQuery({
    queryKey: ["loans", { page, search }],
    queryFn: async () => {
      const url = new URL("/api/loans", window.location.origin)
      url.searchParams.set("page", String(page))
      url.searchParams.set("limit", "20")
      if (search) url.searchParams.set("search", search)
      const res = await fetch(url)
      if (!res.ok) throw new Error("Failed to load loans")
      return res.json() as Promise<Response>
    },
    staleTime: 15_000,
  })

  const columns: Column<Loan>[] = [
    {
      key: "member",
      header: "Member",
      render: (l) => (
        <span className="font-medium">
          {l.member.firstName} {l.member.lastName}
        </span>
      ),
    },
    { key: "memberNumber", header: "Member #", className: "font-mono tabular-nums", render: (l) => l.member.memberNumber },
    { key: "branch", header: "Branch", render: (l) => l.branch.name },
    {
      key: "principal",
      header: "Principal",
      align: "right",
      className: "font-mono tabular-nums",
      render: (l) => formatUGX(l.principal),
    },
    {
      key: "outstanding",
      header: "Outstanding",
      align: "right",
      className: "font-mono tabular-nums",
      render: (l) => formatUGX(l.displayStatus.outstandingBalance),
    },
    {
      key: "nextDueDate",
      header: "Next due date",
      render: (l) =>
        l.displayStatus.nextDueDate ? new Date(l.displayStatus.nextDueDate).toLocaleDateString("en-UG") : "—",
    },
    {
      key: "status",
      header: "Status",
      render: (l) => <StatusBadge status={l.displayStatus.label} tone={l.displayStatus.tone} />,
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

      <PaginatedTable
        columns={columns}
        rows={data?.data ?? []}
        page={page}
        totalPages={data?.totalPages ?? 1}
        total={data?.total ?? 0}
        onPageChange={setPage}
        isLoading={isLoading}
        rowHref={(l) => `/dashboard/loans/${l.id}`}
        emptyState={
          <EmptyState
            icon={HandCoins}
            title="No loans yet"
            description="Disbursed loans will appear here once applications clear approval."
          />
        }
      />
    </div>
  )
}
