"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { Download, FileSpreadsheet, FileText, FileBarChart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { SearchableSelect } from "@/components/searchable-select"
import { EmptyState } from "@/components/dashboard/empty-state"
import { useMemberOptions } from "@/hooks/use-member-options"
import { exportToCsv, exportToExcel, exportToPdf } from "@/lib/report-export"
import type { ReportResponse } from "@/lib/reports"

const RANGE_PRESETS = [
  { label: "Today", days: 0 },
  { label: "Last 7 days", days: 7 },
  { label: "This month", days: 30 },
  { label: "This quarter", days: 90 },
  { label: "This year", days: 365 },
] as const

export function ReportViewer({ type, title }: { type: string; title: string }) {
  const [rangeDays, setRangeDays] = React.useState<number>(30)
  const [memberId, setMemberId] = React.useState("")
  const { options: memberOptions } = useMemberOptions()

  const { data, isLoading } = useQuery({
    queryKey: ["report", type, rangeDays, memberId],
    queryFn: async () => {
      // Computed here (fetch-time), not in the render body — Date.now() in
      // render is impure and would make the query key drift every render.
      const to = new Date()
      const from = new Date(to.getTime() - rangeDays * 86_400_000)
      const url = new URL(`/api/reports/${type}`, window.location.origin)
      url.searchParams.set("from", from.toISOString())
      url.searchParams.set("to", to.toISOString())
      if (memberId) url.searchParams.set("memberId", memberId)
      const res = await fetch(url)
      if (!res.ok) throw new Error("Failed to load report")
      return res.json() as Promise<ReportResponse>
    },
  })

  async function handleExport(format: "csv" | "excel" | "pdf") {
    if (!data || data.rows.length === 0) {
      toast.error("Nothing to export")
      return
    }
    const filename = `${type}-report-${new Date().toISOString().slice(0, 10)}`
    try {
      if (format === "csv") exportToCsv(data.columns, data.rows, filename)
      else if (format === "excel") await exportToExcel(data.columns, data.rows, filename)
      else await exportToPdf(data.title, data.columns, data.rows, filename)
      toast.success(`Exported as ${format.toUpperCase()}`)
    } catch {
      toast.error("Export failed")
    }
  }

  if (data?.requiresMember) {
    return (
      <div className="max-w-md space-y-4 rounded-lg border border-(--border-subtle) bg-(--bg-card) p-6">
        <p className="text-sm text-(--text-secondary)">Select a member to view their statement.</p>
        <SearchableSelect options={memberOptions} value={memberId} onChange={setMemberId} placeholder="Select member" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {RANGE_PRESETS.map((preset) => (
            <Button
              key={preset.label}
              size="sm"
              variant={rangeDays === preset.days ? "default" : "outline"}
              onClick={() => setRangeDays(preset.days)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => handleExport("csv")} className="gap-1.5">
            <Download className="size-4" />
            CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleExport("excel")} className="gap-1.5">
            <FileSpreadsheet className="size-4" />
            Excel
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleExport("pdf")} className="gap-1.5">
            <FileText className="size-4" />
            PDF
          </Button>
        </div>
      </div>

      {data?.summary ? (
        <div className="flex flex-wrap gap-4 rounded-lg border border-(--border-subtle) bg-(--bg-card) p-4">
          {Object.entries(data.summary).map(([k, v]) => (
            <div key={k} className="text-sm">
              <span className="text-(--text-secondary)">{k}: </span>
              <span className="font-mono font-medium tabular-nums text-(--text-primary)">{v}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-card)">
        {isLoading ? (
          <div className="h-64 animate-pulse" />
        ) : !data || data.rows.length === 0 ? (
          <EmptyState icon={FileBarChart} title="No data for this range" description={`${title} has no records in the selected period.`} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {data.columns.map((c) => (
                  <TableHead key={c.key} className={c.align === "right" ? "text-right" : ""}>
                    {c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row, i) => (
                <TableRow key={i}>
                  {data.columns.map((c) => (
                    <TableCell key={c.key} className={c.align === "right" ? "text-right font-mono tabular-nums" : ""}>
                      {row[c.key]}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
