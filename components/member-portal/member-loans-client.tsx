"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { HandCoins } from "lucide-react"
import { EmptyState } from "@/components/dashboard/empty-state"
import { StatusBadge } from "@/components/status-badge"
import { formatUGX } from "@/lib/utils"

type LoanRow = {
  id: string
  productName: string
  principal: number
  disbursedAt: string
  status: string
  displayStatus: { label: string; tone: "success" | "info" | "warning" | "accent" | "error" | "defaulted"; outstandingBalance: number }
}

export function MemberLoansClient() {
  const { data, isLoading } = useQuery({
    queryKey: ["member-loans"],
    queryFn: async () => {
      const res = await fetch("/api/member-portal/loans")
      if (!res.ok) throw new Error("Failed to load loans")
      return res.json() as Promise<{ data: LoanRow[] }>
    },
    staleTime: 30_000,
  })

  if (isLoading) return <div className="h-64 animate-pulse rounded-lg bg-(--bg-card)" />

  if (!data || data.data.length === 0) {
    return (
      <EmptyState
        icon={HandCoins}
        title="No loans yet"
        description="Loans disbursed to you will appear here, with your repayment progress and balance."
      />
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {data.data.map((loan) => (
        <Link
          key={loan.id}
          href={`/member-portal/dashboard/loans/${loan.id}`}
          className="rounded-lg border border-(--border-subtle) bg-(--bg-card) p-5 transition-colors hover:bg-(--bg-card-hover)"
        >
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[15px] font-semibold text-(--text-primary)">{loan.productName}</h3>
            <StatusBadge status={loan.displayStatus.label} tone={loan.displayStatus.tone} />
          </div>
          <p className="mt-3 text-xs text-(--text-secondary)">Principal</p>
          <p className="font-mono text-lg font-bold tabular-nums text-(--text-primary)">{formatUGX(loan.principal)}</p>
          <p className="mt-3 text-xs text-(--text-secondary)">Outstanding</p>
          <p className="font-mono text-sm font-semibold tabular-nums text-(--text-primary)">
            {formatUGX(loan.displayStatus.outstandingBalance)}
          </p>
          <p className="mt-3 text-xs text-(--text-secondary)">
            Disbursed {new Date(loan.disbursedAt).toLocaleDateString("en-UG")}
          </p>
        </Link>
      ))}
    </div>
  )
}
