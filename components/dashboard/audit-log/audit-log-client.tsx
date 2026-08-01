"use client"

import { useQuery } from "@tanstack/react-query"
import { ScrollText, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { PaginatedTable, type Column } from "@/components/dashboard/paginated-table"
import { EmptyState } from "@/components/dashboard/empty-state"
import { useTableQuery } from "@/hooks/use-table-query"

type AuditEntry = {
  id: string
  action: string
  entityType: string
  entityId: string
  createdAt: string
  user: { name: string | null; email: string; role: string } | null
}

type Response = { data: AuditEntry[]; total: number; page: number; totalPages: number }

export function AuditLogClient() {
  const { page, search, setSearch, filters, setFilter, setPage } = useTableQuery(["entityType"])

  const { data, isLoading } = useQuery({
    queryKey: ["audit-log", { page, search, entityType: filters.entityType }],
    queryFn: async () => {
      const url = new URL("/api/audit-log", window.location.origin)
      url.searchParams.set("page", String(page))
      url.searchParams.set("limit", "50")
      if (search) url.searchParams.set("action", search)
      if (filters.entityType) url.searchParams.set("entityType", filters.entityType)
      const res = await fetch(url)
      if (!res.ok) throw new Error("Failed to load audit log")
      return res.json() as Promise<Response>
    },
    staleTime: 15_000,
  })

  const entityTypes = ["LoanApplication", "Loan", "Repayment", "SavingsAccount", "SavingsTransaction", "RecoveryCase", "Member"]

  const columns: Column<AuditEntry>[] = [
    { key: "date", header: "Date", render: (e) => new Date(e.createdAt).toLocaleString("en-UG") },
    { key: "user", header: "User", render: (e) => (e.user ? `${e.user.name ?? e.user.email} (${e.user.role})` : "System") },
    { key: "action", header: "Action", render: (e) => e.action },
    { key: "entity", header: "Entity", render: (e) => `${e.entityType}:${e.entityId.slice(0, 8)}...` },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-(--text-muted)" />
          <Input
            placeholder="Search action..."
            className="rounded-full pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter("entityType", "")}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              !filters.entityType ? "bg-(--text-primary) text-(--bg-canvas)" : "bg-(--bg-card-hover) text-(--text-secondary)"
            }`}
          >
            All
          </button>
          {entityTypes.map((t) => (
            <button
              key={t}
              onClick={() => setFilter("entityType", t)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                filters.entityType === t ? "bg-(--text-primary) text-(--bg-canvas)" : "bg-(--bg-card-hover) text-(--text-secondary)"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <PaginatedTable
        columns={columns}
        rows={data?.data ?? []}
        page={page}
        totalPages={data?.totalPages ?? 1}
        total={data?.total ?? 0}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyState={<EmptyState icon={ScrollText} title="No audit entries" description="Mutating actions across the app appear here." />}
      />
    </div>
  )
}
