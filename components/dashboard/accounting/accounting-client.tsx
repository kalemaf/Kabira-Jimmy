"use client"

import { useQuery } from "@tanstack/react-query"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { StatusBadge } from "@/components/status-badge"
import { EmptyState } from "@/components/dashboard/empty-state"
import { formatUGX } from "@/lib/utils"
import { BookOpen } from "lucide-react"
import { ACCOUNTS } from "@/lib/account-codes"

type ChartAccount = { code: string; name: string; type: string }
type LedgerRow = {
  id: string
  accountCode: string
  description: string
  debit: number
  credit: number
  createdAt: string
  account: ChartAccount
  branch: { name: string }
}

function useJson<T>(key: string, url: string) {
  return useQuery({
    queryKey: [key],
    queryFn: async () => {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Failed to load ${key}`)
      return res.json() as Promise<T>
    },
    staleTime: 30_000,
  })
}

function LedgerTable({ accountCode }: { accountCode?: string }) {
  const url = accountCode ? `/api/accounting/ledger?accountCode=${accountCode}&limit=50` : "/api/accounting/ledger?limit=50"
  const { data, isLoading } = useJson<{ data: LedgerRow[] }>(`ledger-${accountCode ?? "all"}`, url)

  if (isLoading) return <div className="h-64 animate-pulse rounded-lg bg-(--bg-card)" />
  if (!data || data.data.length === 0) return <EmptyState icon={BookOpen} title="No ledger entries yet" />

  return (
    <div className="overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-card)">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-brand-gradient h-11 text-[12px] font-semibold tracking-wide text-white uppercase">
              <th className="border-r border-white/20 pl-5 text-left">Date</th>
              <th className="border-r border-white/20 text-left">Account</th>
              <th className="border-r border-white/20 text-left">Description</th>
              <th className="border-r border-white/20 text-right">Debit</th>
              <th className="pr-5 text-right">Credit</th>
            </tr>
          </thead>
          <tbody>
            {data.data.map((row) => (
              <tr key={row.id} className="h-11 border-b border-(--border-subtle) text-(--text-primary) last:border-b-0">
                <td className="border-r border-(--border-subtle) pl-5">{new Date(row.createdAt).toLocaleDateString("en-UG")}</td>
                <td className="border-r border-(--border-subtle)">{row.account.name}</td>
                <td className="border-r border-(--border-subtle) text-(--text-secondary)">{row.description}</td>
                <td className="border-r border-(--border-subtle) text-right font-mono tabular-nums">{row.debit > 0 ? formatUGX(row.debit) : "—"}</td>
                <td className="pr-5 text-right font-mono tabular-nums">{row.credit > 0 ? formatUGX(row.credit) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ChartOfAccountsTable() {
  const { data, isLoading } = useJson<{ data: ChartAccount[] }>("chart-of-accounts", "/api/accounting/chart-of-accounts")
  if (isLoading) return <div className="h-64 animate-pulse rounded-lg bg-(--bg-card)" />
  return (
    <div className="overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-card)">
      <div className="divide-y divide-(--border-subtle)">
        {data?.data.map((a) => (
          <div key={a.code} className="flex items-center justify-between p-4 text-sm">
            <div>
              <span className="font-mono tabular-nums text-(--text-secondary)">{a.code}</span>
              <span className="ml-3 text-(--text-primary)">{a.name}</span>
            </div>
            <StatusBadge status={a.type} tone="info" />
          </div>
        ))}
      </div>
    </div>
  )
}

function TrialBalance() {
  const { data, isLoading } = useJson<{
    rows: { accountCode: string; accountName: string; type: string; totalDebit: number; totalCredit: number }[]
    grandTotalDebit: number
    grandTotalCredit: number
    balanced: boolean
  }>("trial-balance", "/api/accounting/trial-balance")

  if (isLoading) return <div className="h-64 animate-pulse rounded-lg bg-(--bg-card)" />
  if (!data) return null

  return (
    <div className="space-y-3">
      <StatusBadge status={data.balanced ? "Balanced" : "Out of balance"} tone={data.balanced ? "success" : "error"} />
      <div className="overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-card)">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-brand-gradient h-11 text-[12px] font-semibold tracking-wide text-white uppercase">
              <th className="border-r border-white/20 pl-5 text-left">Account</th>
              <th className="border-r border-white/20 text-right">Debit</th>
              <th className="pr-5 text-right">Credit</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.accountCode} className="h-11 border-b border-(--border-subtle) text-(--text-primary) last:border-b-0">
                <td className="border-r border-(--border-subtle) pl-5">{r.accountName}</td>
                <td className="border-r border-(--border-subtle) text-right font-mono tabular-nums">{r.totalDebit > 0 ? formatUGX(r.totalDebit) : "—"}</td>
                <td className="pr-5 text-right font-mono tabular-nums">{r.totalCredit > 0 ? formatUGX(r.totalCredit) : "—"}</td>
              </tr>
            ))}
            <tr className="h-11 font-semibold text-(--text-primary)">
              <td className="border-r border-(--border-subtle) pl-5">Total</td>
              <td className="border-r border-(--border-subtle) text-right font-mono tabular-nums">{formatUGX(data.grandTotalDebit)}</td>
              <td className="pr-5 text-right font-mono tabular-nums">{formatUGX(data.grandTotalCredit)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function IncomeStatement() {
  const { data, isLoading } = useJson<{
    revenue: { accountName: string; amount: number }[]
    expenses: { accountName: string; amount: number }[]
    totalRevenue: number
    totalExpenses: number
    netProfit: number
  }>("income-statement", "/api/accounting/income-statement")

  if (isLoading) return <div className="h-64 animate-pulse rounded-lg bg-(--bg-card)" />
  if (!data) return null

  return (
    <div className="max-w-lg space-y-6 rounded-lg border border-(--border-subtle) bg-(--bg-card) p-6">
      <div>
        <h4 className="mb-2 text-sm font-semibold text-(--text-primary)">Revenue</h4>
        {data.revenue.map((r) => (
          <div key={r.accountName} className="flex justify-between py-1 text-sm">
            <span className="text-(--text-secondary)">{r.accountName}</span>
            <span className="font-mono tabular-nums text-(--text-primary)">{formatUGX(r.amount)}</span>
          </div>
        ))}
        <div className="mt-1 flex justify-between border-t border-(--border-subtle) pt-1 text-sm font-semibold">
          <span>Total revenue</span>
          <span className="font-mono tabular-nums">{formatUGX(data.totalRevenue)}</span>
        </div>
      </div>
      <div>
        <h4 className="mb-2 text-sm font-semibold text-(--text-primary)">Expenses</h4>
        {data.expenses.length === 0 ? (
          <p className="text-sm text-(--text-secondary)">No expenses recorded yet.</p>
        ) : (
          data.expenses.map((r) => (
            <div key={r.accountName} className="flex justify-between py-1 text-sm">
              <span className="text-(--text-secondary)">{r.accountName}</span>
              <span className="font-mono tabular-nums text-(--text-primary)">{formatUGX(r.amount)}</span>
            </div>
          ))
        )}
        <div className="mt-1 flex justify-between border-t border-(--border-subtle) pt-1 text-sm font-semibold">
          <span>Total expenses</span>
          <span className="font-mono tabular-nums">{formatUGX(data.totalExpenses)}</span>
        </div>
      </div>
      <div className="flex justify-between border-t border-(--border-subtle) pt-3 text-base font-bold text-(--text-primary)">
        <span>Net profit</span>
        <span className="font-mono tabular-nums">{formatUGX(data.netProfit)}</span>
      </div>
    </div>
  )
}

function BalanceSheet() {
  const { data, isLoading } = useJson<{
    assets: { accountName: string; amount: number }[]
    liabilities: { accountName: string; amount: number }[]
    equity: { accountName: string; amount: number }[]
    totalAssets: number
    totalLiabilities: number
    totalEquity: number
    balanced: boolean
  }>("balance-sheet", "/api/accounting/balance-sheet")

  if (isLoading) return <div className="h-64 animate-pulse rounded-lg bg-(--bg-card)" />
  if (!data) return null

  return (
    <div className="space-y-3">
      <StatusBadge status={data.balanced ? "Balanced" : "Out of balance"} tone={data.balanced ? "success" : "error"} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-(--border-subtle) bg-(--bg-card) p-6">
          <h4 className="mb-2 text-sm font-semibold text-(--text-primary)">Assets</h4>
          {data.assets.map((a) => (
            <div key={a.accountName} className="flex justify-between py-1 text-sm">
              <span className="text-(--text-secondary)">{a.accountName}</span>
              <span className="font-mono tabular-nums text-(--text-primary)">{formatUGX(a.amount)}</span>
            </div>
          ))}
          <div className="mt-1 flex justify-between border-t border-(--border-subtle) pt-1 text-sm font-semibold">
            <span>Total assets</span>
            <span className="font-mono tabular-nums">{formatUGX(data.totalAssets)}</span>
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border border-(--border-subtle) bg-(--bg-card) p-6">
            <h4 className="mb-2 text-sm font-semibold text-(--text-primary)">Liabilities</h4>
            {data.liabilities.map((l) => (
              <div key={l.accountName} className="flex justify-between py-1 text-sm">
                <span className="text-(--text-secondary)">{l.accountName}</span>
                <span className="font-mono tabular-nums text-(--text-primary)">{formatUGX(l.amount)}</span>
              </div>
            ))}
            <div className="mt-1 flex justify-between border-t border-(--border-subtle) pt-1 text-sm font-semibold">
              <span>Total liabilities</span>
              <span className="font-mono tabular-nums">{formatUGX(data.totalLiabilities)}</span>
            </div>
          </div>
          <div className="rounded-lg border border-(--border-subtle) bg-(--bg-card) p-6">
            <h4 className="mb-2 text-sm font-semibold text-(--text-primary)">Equity</h4>
            {data.equity.map((e) => (
              <div key={e.accountName} className="flex justify-between py-1 text-sm">
                <span className="text-(--text-secondary)">{e.accountName}</span>
                <span className="font-mono tabular-nums text-(--text-primary)">{formatUGX(e.amount)}</span>
              </div>
            ))}
            <div className="mt-1 flex justify-between border-t border-(--border-subtle) pt-1 text-sm font-semibold">
              <span>Total equity</span>
              <span className="font-mono tabular-nums">{formatUGX(data.totalEquity)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function AccountingClient() {
  return (
    <Tabs defaultValue="ledger">
      <TabsList variant="line">
        <TabsTrigger value="chart">Chart of Accounts</TabsTrigger>
        <TabsTrigger value="ledger">General Ledger</TabsTrigger>
        <TabsTrigger value="cash">Cash Book</TabsTrigger>
        <TabsTrigger value="bank">Bank Book</TabsTrigger>
        <TabsTrigger value="trial">Trial Balance</TabsTrigger>
        <TabsTrigger value="income">Income Statement</TabsTrigger>
        <TabsTrigger value="balance">Balance Sheet</TabsTrigger>
      </TabsList>
      <TabsContent value="chart" className="mt-4">
        <ChartOfAccountsTable />
      </TabsContent>
      <TabsContent value="ledger" className="mt-4">
        <LedgerTable />
      </TabsContent>
      <TabsContent value="cash" className="mt-4">
        <LedgerTable accountCode={ACCOUNTS.CASH} />
      </TabsContent>
      <TabsContent value="bank" className="mt-4">
        <LedgerTable accountCode={ACCOUNTS.BANK} />
      </TabsContent>
      <TabsContent value="trial" className="mt-4">
        <TrialBalance />
      </TabsContent>
      <TabsContent value="income" className="mt-4">
        <IncomeStatement />
      </TabsContent>
      <TabsContent value="balance" className="mt-4">
        <BalanceSheet />
      </TabsContent>
    </Tabs>
  )
}
