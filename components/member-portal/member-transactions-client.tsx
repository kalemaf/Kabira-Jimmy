"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Search, Download, FileText, Receipt } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PaginatedTable, type Column } from "@/components/dashboard/paginated-table"
import { EmptyState } from "@/components/dashboard/empty-state"
import { StatusBadge } from "@/components/status-badge"
import { useTableQuery } from "@/hooks/use-table-query"
import { formatUGX } from "@/lib/utils"

type Txn = {
  id: string
  date: string
  type: string
  description: string
  amount: number
  balanceAfter: number | null
  status: string
}

type Response = { data: Txn[]; total: number; page: number; totalPages: number }

const TYPE_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "Deposit", label: "Deposits" },
  { value: "Withdrawal", label: "Withdrawals" },
  { value: "Fee", label: "Fees" },
  { value: "Loan Disbursement", label: "Loan Disbursements" },
  { value: "Loan Repayment", label: "Loan Repayments" },
  { value: "Interest", label: "Interest" },
]

export function MemberTransactionsClient() {
  const { page, search, setSearch, setPage, filters, setFilter } = useTableQuery(["type"])
  const [exporting, setExporting] = React.useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["member-transactions", { page, search, type: filters.type }],
    queryFn: async () => {
      const url = new URL("/api/member-portal/transactions", window.location.origin)
      url.searchParams.set("page", String(page))
      url.searchParams.set("limit", "20")
      if (search) url.searchParams.set("search", search)
      if (filters.type) url.searchParams.set("type", filters.type)
      const res = await fetch(url)
      if (!res.ok) throw new Error("Failed to load transactions")
      return res.json() as Promise<Response>
    },
    staleTime: 30_000,
  })

  function exportCSV() {
    if (!data || data.data.length === 0) return
    const header = ["Date", "Type", "Description", "Amount", "Balance After", "Status"]
    const rows = data.data.map((t) => [
      new Date(t.date).toLocaleString("en-UG"),
      t.type,
      t.description,
      t.amount,
      t.balanceAfter ?? "",
      t.status,
    ])
    const csv = [header, ...rows].map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function exportPDF() {
    if (!data || data.data.length === 0) return
    setExporting(true)
    try {
      const [{ pdf }, { GenericReportPDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/pdf/generic-report-pdf"),
      ])
      const blob = await pdf(
        <GenericReportPDF
          title="Transaction History"
          columns={[
            { key: "date", label: "Date" },
            { key: "type", label: "Type" },
            { key: "description", label: "Description" },
            { key: "amount", label: "Amount", align: "right" },
            { key: "status", label: "Status" },
          ]}
          rows={data.data.map((t) => ({
            date: new Date(t.date).toLocaleDateString("en-UG"),
            type: t.type,
            description: t.description,
            amount: formatUGX(t.amount),
            status: t.status,
          }))}
        />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `transactions-${new Date().toISOString().slice(0, 10)}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const columns: Column<Txn>[] = [
    {
      key: "date",
      header: "Date",
      render: (t) => new Date(t.date).toLocaleDateString("en-UG"),
    },
    {
      key: "description",
      header: "Description",
      render: (t) => (
        <div>
          <p>{t.description}</p>
          <p className="text-xs text-(--text-secondary)">{t.type}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (t) => (
        <StatusBadge status={t.status} tone={t.status === "Confirmed" ? "success" : t.status === "Pending" ? "warning" : "error"} />
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (t) => <span className="font-mono tabular-nums">{formatUGX(t.amount)}</span>,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-(--text-muted)" />
            <Input placeholder="Search transactions..." className="rounded-full pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filters.type || "all"} onValueChange={(v) => setFilter("type", v && v !== "all" ? v : "")}>
            <SelectTrigger className="h-[42px] w-full rounded-sm border-(--border-subtle) px-3.5 sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!data?.data.length} className="gap-1.5">
            <Download className="size-4" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportPDF} loading={exporting} disabled={!data?.data.length} className="gap-1.5">
            <FileText className="size-4" />
            PDF
          </Button>
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
        emptyState={<EmptyState icon={Receipt} title="No transactions yet" description="Your deposits, withdrawals, and loan repayments will appear here." />}
      />
    </div>
  )
}
