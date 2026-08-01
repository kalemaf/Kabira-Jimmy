"use client"

import { useQuery } from "@tanstack/react-query"
import { ShieldCheck, Search, ChevronDown } from "lucide-react"
import * as React from "react"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/dashboard/empty-state"
import { StatusBadge } from "@/components/status-badge"
import { formatUGX } from "@/lib/utils"
import { useTableQuery } from "@/hooks/use-table-query"

type Guarantee = {
  borrowerName: string
  borrowerMemberNumber: string
  guaranteeAmount: number
  status: string
  loanStatus: string | null
}

type ExposureRow = {
  member: { id: string; firstName: string; lastName: string; memberNumber: string; status: string }
  totalExposure: number
  guaranteeCount: number
  blocked: boolean
  guarantees: Guarantee[]
  savingsBalance: number
  savingsStatus: "None" | "Low" | "Adequate"
  remainingCapacity: number
  canGuaranteeMore: boolean
  ineligibleReasons: string[]
}

type Response = { data: ExposureRow[]; limitUgx: number; savingsToLoanRatio: number }

const savingsTone: Record<ExposureRow["savingsStatus"], "success" | "warning" | "error"> = {
  Adequate: "success",
  Low: "warning",
  None: "error",
}

export function GuarantorExposureClient() {
  const { search, setSearch } = useTableQuery()
  const [expandedId, setExpandedId] = React.useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["guarantors-exposure", search],
    queryFn: async () => {
      const url = new URL("/api/guarantors/exposure", window.location.origin)
      if (search) url.searchParams.set("search", search)
      const res = await fetch(url)
      if (!res.ok) throw new Error("Failed to load guarantor exposure")
      return res.json() as Promise<Response>
    },
    staleTime: 30_000,
  })

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

      {data ? (
        <p className="text-xs text-(--text-secondary)">
          Guarantors are auto-blocked from taking on new guarantees once their total exposure exceeds{" "}
          {formatUGX(data.limitUgx)}.
        </p>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-card)">
        {isLoading ? (
          <div className="h-64 animate-pulse" />
        ) : !data || data.data.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No guarantors yet"
            description="Members who guarantee loans for others will appear here with their total exposure."
          />
        ) : (
          <div className="divide-y divide-(--border-subtle)">
            {data.data.map((row) => {
              const isExpanded = expandedId === row.member.id
              return (
                <div key={row.member.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : row.member.id)}
                    className="flex w-full items-center justify-between p-4 text-left text-sm transition-colors hover:bg-(--bg-card-hover)"
                  >
                    <div className="flex items-center gap-2">
                      <ChevronDown
                        className={`size-4 shrink-0 text-(--text-muted) transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      />
                      <div>
                        <p className="font-medium text-(--text-primary)">
                          {row.member.firstName} {row.member.lastName}
                        </p>
                        <p className="text-xs text-(--text-secondary)">
                          {row.member.memberNumber} · {row.guaranteeCount} guarantee{row.guaranteeCount === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-[11px] text-(--text-secondary)">Savings</p>
                        <StatusBadge status={row.savingsStatus} tone={savingsTone[row.savingsStatus]} />
                      </div>
                      <span className="font-mono tabular-nums text-(--text-primary)">
                        {formatUGX(row.totalExposure)}
                      </span>
                      <StatusBadge status={row.blocked ? "Blocked" : "Active"} />
                    </div>
                  </button>

                  {isExpanded ? (
                    <div className="space-y-4 border-t border-(--border-subtle) bg-(--bg-surface) p-4">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div>
                          <p className="text-[11px] text-(--text-secondary)">Savings balance</p>
                          <p className="font-mono text-sm tabular-nums text-(--text-primary)">
                            {formatUGX(row.savingsBalance)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-(--text-secondary)">Total exposure</p>
                          <p className="font-mono text-sm tabular-nums text-(--text-primary)">
                            {formatUGX(row.totalExposure)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-(--text-secondary)">Remaining capacity</p>
                          <p className="font-mono text-sm tabular-nums text-(--text-primary)">
                            {formatUGX(row.remainingCapacity)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-(--text-secondary)">Can guarantee another?</p>
                          <StatusBadge
                            status={row.canGuaranteeMore ? "Eligible" : "Not eligible"}
                            tone={row.canGuaranteeMore ? "success" : "error"}
                          />
                        </div>
                      </div>

                      {row.ineligibleReasons.length > 0 ? (
                        <ul className="list-inside list-disc space-y-1 text-xs text-(--error-600)">
                          {row.ineligibleReasons.map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      ) : null}

                      <div>
                        <p className="mb-2 text-[11px] font-medium tracking-wide text-(--text-secondary) uppercase">
                          Currently guaranteeing
                        </p>
                        <div className="overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-card)">
                          <div className="divide-y divide-(--border-subtle)">
                            {row.guarantees.map((gu, i) => (
                              <div key={i} className="flex items-center justify-between p-3 text-sm">
                                <div>
                                  <p className="text-(--text-primary)">{gu.borrowerName}</p>
                                  <p className="text-xs text-(--text-secondary)">{gu.borrowerMemberNumber}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono tabular-nums text-(--text-primary)">
                                    {formatUGX(gu.guaranteeAmount)}
                                  </span>
                                  <StatusBadge status={gu.loanStatus ?? gu.status} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
