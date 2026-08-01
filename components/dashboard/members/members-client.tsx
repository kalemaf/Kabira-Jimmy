"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { Users, Search, FileSpreadsheet, FileText, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { SearchableSelect } from "@/components/searchable-select"
import { useTableQuery } from "@/hooks/use-table-query"
import { useBranchOptions } from "@/hooks/use-branch-options"
import { formatUGX } from "@/lib/utils"

type Member = {
  id: string
  memberNumber: string
  firstName: string
  lastName: string
  phone: string
  status: "Active" | "Inactive" | "Suspended"
  branch: { id: string; name: string; code: string } | null
  savingsBalance: number
  activeLoan: {
    id: string
    principal: number
    outstandingBalance: number
    nextDueDate: string | null
    label: string
    tone: "success" | "info" | "warning" | "accent" | "error" | "defaulted"
  } | null
}

type MembersResponse = { data: Member[]; total: number; page: number; totalPages: number }

const STATUS_OPTIONS = ["Active", "Inactive", "Suspended"] as const

export function MembersClient({ canCreate }: { canCreate: boolean }) {
  const { page, search, setSearch, setPage, filters, setFilter } = useTableQuery(["branchId", "status"])
  const { options: branchOptions } = useBranchOptions()
  const [exporting, setExporting] = React.useState<"xlsx" | "pdf" | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["members", { page, search, ...filters }],
    queryFn: async () => {
      const url = new URL("/api/members", window.location.origin)
      url.searchParams.set("page", String(page))
      url.searchParams.set("limit", "20")
      if (search) url.searchParams.set("search", search)
      if (filters.branchId) url.searchParams.set("branchId", filters.branchId)
      if (filters.status) url.searchParams.set("status", filters.status)
      const res = await fetch(url)
      if (!res.ok) throw new Error("Failed to load members")
      return res.json() as Promise<MembersResponse>
    },
    staleTime: 30_000,
  })

  async function fetchAllForExport() {
    const url = new URL("/api/members", window.location.origin)
    url.searchParams.set("page", "1")
    url.searchParams.set("limit", "1000")
    if (search) url.searchParams.set("search", search)
    if (filters.branchId) url.searchParams.set("branchId", filters.branchId)
    if (filters.status) url.searchParams.set("status", filters.status)
    const res = await fetch(url)
    if (!res.ok) throw new Error("Failed to load members for export")
    const body = (await res.json()) as MembersResponse
    return body.data
  }

  async function handleExportExcel() {
    setExporting("xlsx")
    try {
      const rows = await fetchAllForExport()
      const XLSX = await import("xlsx")
      const sheet = XLSX.utils.json_to_sheet(
        rows.map((m) => ({
          "Member #": m.memberNumber,
          "First name": m.firstName,
          "Last name": m.lastName,
          Phone: m.phone,
          Branch: m.branch?.name ?? "",
          "Savings balance": m.savingsBalance,
          "Loan balance": m.activeLoan?.outstandingBalance ?? 0,
          "Next due date": m.activeLoan?.nextDueDate ? new Date(m.activeLoan.nextDueDate).toLocaleDateString("en-UG") : "",
          "Loan status": m.activeLoan?.label ?? "No active loan",
          Status: m.status,
        }))
      )
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, sheet, "Members")
      XLSX.writeFile(workbook, `nextgen-sacco-members-${Date.now()}.xlsx`)
    } catch {
      toast.error("Failed to export members")
    } finally {
      setExporting(null)
    }
  }

  async function handleExportPdf() {
    setExporting("pdf")
    try {
      const rows = await fetchAllForExport()
      const [{ pdf }, { MemberListPDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/pdf/member-list-pdf"),
      ])
      const blob = await pdf(<MemberListPDF members={rows} />).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `nextgen-sacco-members-${Date.now()}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error("Failed to export members")
    } finally {
      setExporting(null)
    }
  }

  const columns: Column<Member>[] = [
    {
      key: "memberNumber",
      header: "Member #",
      className: "font-mono tabular-nums",
      render: (m) => m.memberNumber,
    },
    {
      key: "name",
      header: "Name",
      render: (m) => (
        <span className="font-medium">
          {m.firstName} {m.lastName}
        </span>
      ),
    },
    { key: "phone", header: "Phone", className: "font-mono tabular-nums", render: (m) => m.phone },
    { key: "branch", header: "Branch", render: (m) => m.branch?.name ?? "—" },
    {
      key: "savingsBalance",
      header: "Savings balance",
      align: "right",
      className: "font-mono tabular-nums",
      render: (m) => formatUGX(m.savingsBalance),
    },
    {
      key: "loanBalance",
      header: "Loan balance",
      align: "right",
      className: "font-mono tabular-nums",
      render: (m) => (m.activeLoan ? formatUGX(m.activeLoan.outstandingBalance) : "—"),
    },
    {
      key: "loanDueDate",
      header: "Next due date",
      render: (m) =>
        m.activeLoan?.nextDueDate ? new Date(m.activeLoan.nextDueDate).toLocaleDateString("en-UG") : "—",
    },
    {
      key: "loanStatus",
      header: "Loan status",
      render: (m) => (m.activeLoan ? <StatusBadge status={m.activeLoan.label} tone={m.activeLoan.tone} /> : <StatusBadge status="No active loan" tone="neutral" />),
    },
    { key: "status", header: "Status", render: (m) => <StatusBadge status={m.status} /> },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-(--text-muted)" />
            <Input
              placeholder="Search name, phone, NIN, member #"
              className="rounded-full pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-48">
            <SearchableSelect
              options={[{ value: "", label: "All branches" }, ...branchOptions]}
              value={filters.branchId}
              onChange={(v) => setFilter("branchId", v)}
              placeholder="All branches"
            />
          </div>
          <div className="w-full sm:w-40">
            <Select value={filters.status || "all"} onValueChange={(v) => v && setFilter("status", v === "all" ? "" : v)}>
              <SelectTrigger className="h-[42px] w-full rounded-sm border-(--border-subtle) px-3.5">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportExcel} loading={exporting === "xlsx"}>
            <FileSpreadsheet className="size-4" />
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPdf} loading={exporting === "pdf"}>
            <FileText className="size-4" />
            PDF
          </Button>
          {canCreate ? (
            <Button
              render={<Link href="/dashboard/members/new" />}
              nativeButton={false}
              size="sm"
              className="gap-1.5 sm:hidden"
            >
              <Plus className="size-4" />
              New
            </Button>
          ) : null}
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
        rowHref={(m) => `/dashboard/members/${m.id}`}
        emptyState={
          <EmptyState
            icon={Users}
            title="No members yet"
            description="Register your first member to start tracking savings and loans."
          />
        }
      />
    </div>
  )
}
