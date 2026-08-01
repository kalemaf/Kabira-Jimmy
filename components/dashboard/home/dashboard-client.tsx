"use client"

import { useQuery } from "@tanstack/react-query"
import dynamic from "next/dynamic"
import {
  Users,
  PiggyBank,
  HandCoins,
  Wallet,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ShieldAlert,
  Percent,
  Activity,
} from "lucide-react"
import { StatCard } from "@/components/dashboard/stat-card"
import { EmptyState } from "@/components/dashboard/empty-state"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { formatUGX } from "@/lib/utils"
import { categoricalColors } from "@/lib/chart-colors"

// recharts pulls in d3 internals — heavy enough on the most-visited page in
// the app to be worth its own chunk, loaded only once this section is
// actually reached, not blocking the stat cards above it.
const ChartSkeleton = () => <div className="h-[260px] animate-pulse rounded-md bg-(--bg-card-hover)" />
const LoanStatusPieChart = dynamic(() => import("./loan-status-pie-chart"), { ssr: false, loading: ChartSkeleton })
const BranchPerformanceChart = dynamic(() => import("./branch-performance-chart"), { ssr: false, loading: ChartSkeleton })

type Kpis = {
  totalMembers: number
  totalSavings: number
  totalLoans: number
  totalDisbursedPrincipal: number
  outstandingLoans: number
  activeLoans: number
  overdueLoans: number
  defaultedLoans: number
  paidOffLoans: number
  todaysCollections: number
  todaysDeposits: number
  todaysWithdrawals: number
  expectedCollectionsToday: number
  interestEarnedMonth: number
  penaltyEarnedMonth: number
  operationalExpensesMonth: number
  monthlyNetProfit: number
  cashFlowMonth: number
  portfolioAtRisk: number
  loanRecoveryRate: number
  defaultRate: number
  loanStatusBreakdown: { status: string; count: number }[]
  branchPerformance: { branch: string; members: number; loans: number }[]
  recentRepayments: { id: string; memberName: string; amount: number; paidAt: string }[]
  recentSavingsTransactions: { id: string; memberName: string; type: string; amount: number; createdAt: string }[]
}

type TopLists = {
  topBorrowers: { memberName: string; memberNumber: string; totalPrincipal: number }[]
  topDefaulters: { memberName: string; memberNumber: string; principal: number }[]
  topSavers: { memberName: string; memberNumber: string; balance: number }[]
}

export function DashboardClient() {
  const { data: kpis, isLoading } = useQuery({
    queryKey: ["dashboard-kpis"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/kpis")
      if (!res.ok) throw new Error("Failed to load dashboard")
      return res.json() as Promise<Kpis>
    },
    staleTime: 30_000,
  })

  const { data: topLists } = useQuery({
    queryKey: ["dashboard-top-lists"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/top-lists")
      if (!res.ok) throw new Error("Failed to load top lists")
      return res.json() as Promise<TopLists>
    },
    staleTime: 60_000,
  })

  if (isLoading || !kpis) {
    return <div className="h-96 animate-pulse rounded-lg bg-(--bg-card)" />
  }

  const barColors = categoricalColors(kpis.branchPerformance.length, "dark")

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Members" value={kpis.totalMembers.toLocaleString()} icon={Users} />
        <StatCard label="Total Savings" value={formatUGX(kpis.totalSavings)} icon={PiggyBank} />
        <StatCard label="Total Disbursed" value={formatUGX(kpis.totalDisbursedPrincipal)} icon={HandCoins} />
        <StatCard label="Outstanding Loans" value={formatUGX(kpis.outstandingLoans)} icon={Wallet} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Today's Collections" value={formatUGX(kpis.todaysCollections)} icon={TrendingUp} />
        <StatCard label="Expected Today" value={formatUGX(kpis.expectedCollectionsToday)} icon={Activity} />
        <StatCard label="Today's Deposits" value={formatUGX(kpis.todaysDeposits)} icon={TrendingUp} />
        <StatCard label="Today's Withdrawals" value={formatUGX(kpis.todaysWithdrawals)} icon={TrendingDown} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Interest Earned (mo)" value={formatUGX(kpis.interestEarnedMonth)} icon={TrendingUp} />
        <StatCard label="Net Profit (mo)" value={formatUGX(kpis.monthlyNetProfit)} icon={TrendingUp} />
        <StatCard label="Portfolio at Risk" value={`${kpis.portfolioAtRisk.toFixed(1)}%`} icon={AlertTriangle} />
        <StatCard label="Default Rate" value={`${kpis.defaultRate.toFixed(1)}%`} icon={ShieldAlert} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Active Loans" value={kpis.activeLoans.toLocaleString()} icon={HandCoins} />
        <StatCard label="Overdue Loans" value={kpis.overdueLoans.toLocaleString()} icon={AlertTriangle} />
        <StatCard label="Recovery Rate" value={`${kpis.loanRecoveryRate.toFixed(1)}%`} icon={Percent} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-md border border-(--border-subtle) bg-(--bg-card)">
          <h3 className="border-b border-(--border-subtle) bg-(--bg-card-hover) px-5 py-3 text-[13px] font-semibold text-(--text-primary)">Loan portfolio by status</h3>
          <div className="p-6">
            {kpis.loanStatusBreakdown.every((s) => s.count === 0) ? (
              <EmptyState icon={HandCoins} title="No loans yet" />
            ) : (
              <LoanStatusPieChart data={kpis.loanStatusBreakdown} />
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-(--border-subtle) bg-(--bg-card)">
          <h3 className="border-b border-(--border-subtle) bg-(--bg-card-hover) px-5 py-3 text-[13px] font-semibold text-(--text-primary)">Branch performance</h3>
          <div className="p-6">
            {kpis.branchPerformance.length === 0 ? (
              <EmptyState icon={Activity} title="No branches yet" />
            ) : (
              <BranchPerformanceChart data={kpis.branchPerformance} colors={barColors} />
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="overflow-hidden rounded-md border border-(--border-subtle) bg-(--bg-card)">
          <h3 className="border-b border-(--border-subtle) bg-(--bg-card-hover) px-5 py-3 text-[13px] font-semibold text-(--text-primary)">Top borrowers</h3>
          {!topLists?.topBorrowers.length ? (
            <p className="p-5 text-sm text-(--text-secondary)">No data yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead className="text-right">Principal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topLists.topBorrowers.map((b) => (
                  <TableRow key={b.memberNumber}>
                    <TableCell className="whitespace-normal">{b.memberName}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatUGX(b.totalPrincipal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <div className="overflow-hidden rounded-md border border-(--border-subtle) bg-(--bg-card)">
          <h3 className="border-b border-(--border-subtle) bg-(--bg-card-hover) px-5 py-3 text-[13px] font-semibold text-(--text-primary)">Top defaulters</h3>
          {!topLists?.topDefaulters.length ? (
            <p className="p-5 text-sm text-(--text-secondary)">No defaulters — good standing.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead className="text-right">Principal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topLists.topDefaulters.map((d) => (
                  <TableRow key={d.memberNumber}>
                    <TableCell className="whitespace-normal">{d.memberName}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-(--error-600)">{formatUGX(d.principal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <div className="overflow-hidden rounded-md border border-(--border-subtle) bg-(--bg-card)">
          <h3 className="border-b border-(--border-subtle) bg-(--bg-card-hover) px-5 py-3 text-[13px] font-semibold text-(--text-primary)">Top savers</h3>
          {!topLists?.topSavers.length ? (
            <p className="p-5 text-sm text-(--text-secondary)">No data yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topLists.topSavers.map((s) => (
                  <TableRow key={s.memberNumber}>
                    <TableCell className="whitespace-normal">{s.memberName}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatUGX(s.balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-(--border-subtle) bg-(--bg-card)">
        <h3 className="border-b border-(--border-subtle) bg-(--bg-card-hover) px-5 py-3 text-[13px] font-semibold text-(--text-primary)">Recent transactions</h3>
        {(() => {
          const rows = [
            ...kpis.recentRepayments.map((r) => ({ id: r.id, label: `${r.memberName} repaid`, amount: r.amount, at: r.paidAt })),
            ...kpis.recentSavingsTransactions.map((t) => ({
              id: t.id,
              label: `${t.memberName} ${t.type.toLowerCase()}`,
              amount: t.amount,
              at: t.createdAt,
            })),
          ]
            .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
            .slice(0, 8)

          return rows.length === 0 ? (
            <p className="p-5 text-sm text-(--text-secondary)">No transactions yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transaction</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="whitespace-normal">{t.label}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatUGX(t.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )
        })()}
      </div>
    </div>
  )
}
