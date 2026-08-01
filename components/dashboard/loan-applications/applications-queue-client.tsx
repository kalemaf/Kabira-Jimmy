"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { FileText, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PaginatedTable, type Column } from "@/components/dashboard/paginated-table"
import { EmptyState } from "@/components/dashboard/empty-state"
import { StatusBadge } from "@/components/status-badge"
import { useTableQuery } from "@/hooks/use-table-query"
import { formatUGX } from "@/lib/utils"
import { STATUS_LABELS, type ApplicationStatus } from "@/lib/loan-workflow"

type Application = {
  id: string
  amount: number
  status: ApplicationStatus
  riskScore: number
  createdAt: string
  member: { firstName: string; lastName: string; memberNumber: string }
  loanProduct: { name: string }
  preparedBy: { name: string } | null
  submittedByMemberUser: { name: string } | null
}

type Response = { data: Application[]; total: number; page: number; totalPages: number }

const STATUS_TONE: Record<string, "success" | "warning" | "error" | "info" | "neutral"> = {
  Disbursed: "success",
  Rejected: "error",
  Returned: "warning",
};

export function ApplicationsQueueClient({
  scopedStatus,
  title,
  canCreate,
}: {
  scopedStatus?: ApplicationStatus | ApplicationStatus[]
  title: string
  canCreate: boolean
}) {
  const { page, search, setSearch, setPage } = useTableQuery()
  const statusParam = Array.isArray(scopedStatus) ? scopedStatus.join(",") : scopedStatus

  const { data, isLoading } = useQuery({
    queryKey: ["loan-applications", { page, search, statusParam }],
    queryFn: async () => {
      const url = new URL("/api/loan-applications", window.location.origin)
      url.searchParams.set("page", String(page))
      url.searchParams.set("limit", "20")
      if (statusParam) url.searchParams.set("status", statusParam)
      const res = await fetch(url)
      if (!res.ok) throw new Error("Failed to load applications")
      return res.json() as Promise<Response>
    },
    staleTime: 15_000,
  })

  const filtered = search
    ? data?.data.filter((a) =>
        `${a.member.firstName} ${a.member.lastName} ${a.member.memberNumber}`
          .toLowerCase()
          .includes(search.toLowerCase())
      )
    : data?.data

  const columns: Column<Application>[] = [
    {
      key: "member",
      header: "Member",
      render: (a) => (
        <span className="font-medium">
          {a.member.firstName} {a.member.lastName}
        </span>
      ),
    },
    { key: "product", header: "Product", render: (a) => a.loanProduct.name },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      className: "font-mono tabular-nums",
      render: (a) => formatUGX(a.amount),
    },
    {
      key: "preparedBy",
      header: "Prepared by",
      render: (a) => a.preparedBy?.name ?? (a.submittedByMemberUser ? `${a.submittedByMemberUser.name} (self-service)` : "—"),
    },
    {
      key: "risk",
      header: "Risk",
      align: "right",
      render: (a) => (
        <span
          className={a.riskScore >= 50 ? "text-(--error-600)" : a.riskScore >= 25 ? "text-(--warning-600)" : "text-(--text-secondary)"}
        >
          {a.riskScore}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (a) => <StatusBadge status={a.status} tone={STATUS_TONE[a.status] ?? "info"} label={STATUS_LABELS[a.status]} />,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-(--text-muted)" />
          <Input
            placeholder="Search member..."
            className="rounded-full pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {canCreate ? (
          <Button render={<Link href="/dashboard/loans/applications/new" />} nativeButton={false} className="gap-1.5">
            <Plus className="size-4" />
            New application
          </Button>
        ) : null}
      </div>

      <PaginatedTable
        columns={columns}
        rows={filtered ?? []}
        page={page}
        totalPages={data?.totalPages ?? 1}
        total={data?.total ?? 0}
        onPageChange={setPage}
        isLoading={isLoading}
        rowHref={(a) => `/dashboard/loans/applications/${a.id}`}
        emptyState={
          <EmptyState
            icon={FileText}
            title={`No applications ${scopedStatus ? "at this stage" : "yet"}`}
            description={title}
          />
        }
      />
    </div>
  )
}
