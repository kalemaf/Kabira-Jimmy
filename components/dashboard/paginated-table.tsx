"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

export type Column<T> = {
  key: string
  header: string
  align?: "left" | "right"
  className?: string
  render: (row: T) => React.ReactNode
}

// Design-style-guide.md §7.4 — comfortable 52px rows, bg-surface header,
// border dividers (no zebra striping), mobile card-conversion below `md`.
export function PaginatedTable<T extends { id: string }>({
  columns,
  rows,
  page,
  totalPages,
  total,
  onPageChange,
  isLoading,
  emptyState,
  rowHref,
}: {
  columns: Column<T>[]
  rows: T[]
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
  isLoading?: boolean
  emptyState?: React.ReactNode
  rowHref?: (row: T) => string
}) {
  const router = useRouter()

  if (!isLoading && rows.length === 0 && emptyState) {
    return (
      <div className="rounded-lg border border-(--border-subtle) bg-(--bg-card)">
        {emptyState}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-card)">
      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-brand-gradient h-11">
              {columns.map((col, i) => (
                <th
                  key={col.key}
                  className={cn(
                    "border-r border-white/20 text-[12px] font-semibold tracking-wide text-white uppercase last:border-r-0",
                    col.align === "right" ? "text-right" : "text-left",
                    i === 0 ? "pl-5" : "pl-3",
                    i === columns.length - 1 ? "pr-5" : "pr-3"
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="h-[52px] border-b border-(--border-subtle)">
                    {columns.map((col) => (
                      <td key={col.key} className="pl-3 pr-3">
                        <Skeleton className="h-4 w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={rowHref ? () => router.push(rowHref(row)) : undefined}
                    className={cn(
                      "h-[52px] border-b border-(--border-subtle) text-(--text-primary) transition-colors last:border-b-0",
                      rowHref && "cursor-pointer hover:bg-(--bg-card-hover)"
                    )}
                  >
                    {columns.map((col, i) => (
                      <td
                        key={col.key}
                        className={cn(
                          "border-r border-(--border-subtle) last:border-r-0",
                          col.align === "right" ? "text-right" : "text-left",
                          i === 0 ? "pl-5" : "pl-3",
                          i === columns.length - 1 ? "pr-5" : "pr-3",
                          col.className
                        )}
                      >
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <div className="divide-y divide-(--border-subtle) md:hidden">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2 p-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            ))
          : rows.map((row) => (
              <div
                key={row.id}
                onClick={rowHref ? () => router.push(rowHref(row)) : undefined}
                className={cn("space-y-2 p-4", rowHref && "cursor-pointer active:bg-(--bg-card-hover)")}
              >
                {columns.map((col) => (
                  <div key={col.key} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-(--text-secondary)">{col.header}</span>
                    <span className="text-right text-(--text-primary)">{col.render(row)}</span>
                  </div>
                ))}
              </div>
            ))}
      </div>

      {/* Pagination footer */}
      <div className="flex items-center justify-between border-t border-(--border-subtle) px-5 py-3">
        <p className="text-xs text-(--text-secondary)">
          {total.toLocaleString()} total
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-(--text-secondary)">
            Page {page} of {Math.max(totalPages, 1)}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  )
}
