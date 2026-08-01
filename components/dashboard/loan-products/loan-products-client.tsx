"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { CreditCard, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PaginatedTable, type Column } from "@/components/dashboard/paginated-table"
import { EmptyState } from "@/components/dashboard/empty-state"
import { StatusBadge } from "@/components/status-badge"
import { useTableQuery } from "@/hooks/use-table-query"
import { formatUGX } from "@/lib/utils"

type LoanProduct = {
  id: string
  name: string
  interestRate: number
  minAmount: number
  maxAmount: number
  repaymentPeriodMonths: number
  interestMethod: string
  isActive: boolean
}

type Response = { data: LoanProduct[]; total: number; page: number; totalPages: number }

export function LoanProductsClient({ canEdit }: { canEdit: boolean }) {
  const { page, search, setSearch, setPage } = useTableQuery()

  const { data, isLoading } = useQuery({
    queryKey: ["loan-products", { page, search }],
    queryFn: async () => {
      const url = new URL("/api/loan-products", window.location.origin)
      url.searchParams.set("page", String(page))
      url.searchParams.set("limit", "20")
      if (search) url.searchParams.set("search", search)
      const res = await fetch(url)
      if (!res.ok) throw new Error("Failed to load loan products")
      return res.json() as Promise<Response>
    },
    staleTime: 30_000,
  })

  const columns: Column<LoanProduct>[] = [
    { key: "name", header: "Product", render: (p) => <span className="font-medium">{p.name}</span> },
    { key: "rate", header: "Interest", align: "right", render: (p) => `${p.interestRate}%` },
    {
      key: "range",
      header: "Amount range",
      align: "right",
      className: "font-mono tabular-nums",
      render: (p) => `${formatUGX(p.minAmount)} – ${formatUGX(p.maxAmount)}`,
    },
    { key: "period", header: "Period", align: "right", render: (p) => `${p.repaymentPeriodMonths} mo` },
    {
      key: "status",
      header: "Status",
      render: (p) => (
        <StatusBadge status={p.isActive ? "Active" : "Inactive"} tone={p.isActive ? "success" : "neutral"} />
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-(--text-muted)" />
          <Input
            placeholder="Search loan products..."
            className="rounded-full pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {canEdit ? (
          <Button render={<Link href="/dashboard/loan-products/new" />} nativeButton={false} className="gap-1.5">
            <Plus className="size-4" />
            New product
          </Button>
        ) : null}
      </div>

      <PaginatedTable
        columns={columns}
        rows={data?.data ?? []}
        page={page}
        totalPages={data?.totalPages ?? 1}
        total={data?.total ?? 0}
        onPageChange={setPage}
        isLoading={isLoading}
        rowHref={canEdit ? (p) => `/dashboard/loan-products/${p.id}/edit` : undefined}
        emptyState={
          <EmptyState
            icon={CreditCard}
            title="No loan products yet"
            description="Configure your first loan product to start accepting applications."
          />
        }
      />
    </div>
  )
}
