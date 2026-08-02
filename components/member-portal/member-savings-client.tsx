"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { PiggyBank, Plus, Minus, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/dashboard/empty-state"
import { StatusBadge } from "@/components/status-badge"
import { formatUGX } from "@/lib/utils"

type Transaction = {
  id: string
  type: "Deposit" | "Withdrawal" | "Interest"
  amount: number
  balanceAfter: number
  channel: "Staff" | "MemberPortal"
  status: "Pending" | "Confirmed" | "Failed"
  method: "Cash" | "MobileMoney" | "BankTransfer"
  createdAt: string
  staffName: string
}

type SavingsAccount = {
  id: string
  accountNumber: string
  type: "Daily" | "Fixed" | "Shares"
  balance: number
  openedAt: string
  lastDepositAt: string | null
  lastWithdrawalAt: string | null
  transactions: Transaction[]
}

type Response = { memberName: string; memberNumber: string; branchName: string; data: SavingsAccount[] }

export function MemberSavingsClient() {
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: response, isLoading } = useQuery({
    queryKey: ["member-savings"],
    queryFn: async () => {
      const res = await fetch("/api/member-portal/savings")
      if (!res.ok) throw new Error("Failed to load your savings")
      return res.json() as Promise<Response>
    },
    staleTime: 15_000,
  })

  const [reconcilingId, setReconcilingId] = React.useState<string | null>(null)
  const reconcileMutation = useMutation({
    mutationFn: async (id: string) => {
      setReconcilingId(id)
      const res = await fetch(`/api/savings-transactions/${id}/reconcile`, { method: "POST" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "Failed to check with RohoPay")
      }
      return res.json() as Promise<{ status: "confirmed" | "failed" | "pending"; message?: string }>
    },
    onSuccess: (data) => {
      if (data.status === "confirmed") toast.success("RohoPay confirms this deposit succeeded — balance updated")
      else if (data.status === "failed") toast.error("RohoPay reports this deposit failed")
      else toast.info(data.message ?? "RohoPay still shows this as pending — try again shortly")
      queryClient.invalidateQueries({ queryKey: ["member-savings"] })
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => setReconcilingId(null),
  })

  async function downloadStatement(account: SavingsAccount) {
    if (!response) return
    setDownloadingId(account.id)
    try {
      const [{ pdf }, { SavingsPassbookPDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/pdf/savings-passbook-pdf"),
      ])
      const blob = await pdf(
        <SavingsPassbookPDF
          branchName={response.branchName}
          accountNumber={account.accountNumber}
          memberName={response.memberName}
          memberNumber={response.memberNumber}
          accountType={account.type}
          balance={account.balance}
          transactions={account.transactions.map((t) => ({
            type: t.type,
            amount: t.amount,
            balanceAfter: t.balanceAfter,
            createdAt: t.createdAt,
            staffName: t.staffName,
          }))}
        />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `statement-${account.accountNumber}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error("Failed to generate statement")
    } finally {
      setDownloadingId(null)
    }
  }

  if (isLoading) return <div className="h-64 animate-pulse rounded-lg bg-(--bg-card)" />

  const accounts = response?.data ?? []
  if (accounts.length === 0) {
    return (
      <EmptyState
        icon={PiggyBank}
        title="No savings accounts yet"
        description="Visit your branch to open a savings account — it'll appear here once it's set up."
      />
    )
  }

  return (
    <div className="space-y-6">
      {accounts.map((account) => (
        <div key={account.id} className="overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-card)">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--border-subtle) p-5">
            <div>
              <p className="font-mono text-sm text-(--text-secondary)">{account.accountNumber}</p>
              <p className="text-[22px] font-semibold text-(--text-primary)">{formatUGX(account.balance)}</p>
              <StatusBadge status={account.type} tone="info" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => downloadStatement(account)} loading={downloadingId === account.id} className="gap-1.5">
                <Download className="size-4" />
                Statement
              </Button>
              <Button
                variant="outline"
                render={<Link href={`/member-portal/dashboard/savings/withdraw?accountId=${account.id}`} />}
                nativeButton={false}
                className="gap-1.5"
              >
                <Minus className="size-4" />
                Withdraw
              </Button>
              <Button
                render={<Link href={`/member-portal/dashboard/savings/deposit?accountId=${account.id}`} />}
                nativeButton={false}
                className="gap-1.5"
              >
                <Plus className="size-4" />
                Deposit
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-b border-(--border-subtle) p-5 sm:grid-cols-3">
            <div>
              <p className="text-xs text-(--text-secondary)">Opened</p>
              <p className="text-sm text-(--text-primary)">{new Date(account.openedAt).toLocaleDateString("en-UG")}</p>
            </div>
            <div>
              <p className="text-xs text-(--text-secondary)">Last deposit</p>
              <p className="text-sm text-(--text-primary)">
                {account.lastDepositAt ? new Date(account.lastDepositAt).toLocaleDateString("en-UG") : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-(--text-secondary)">Last withdrawal</p>
              <p className="text-sm text-(--text-primary)">
                {account.lastWithdrawalAt ? new Date(account.lastWithdrawalAt).toLocaleDateString("en-UG") : "—"}
              </p>
            </div>
          </div>

          {account.transactions.length === 0 ? (
            <p className="p-5 text-sm text-(--text-secondary)">No transactions yet.</p>
          ) : (
            <div className="divide-y divide-(--border-subtle)">
              {account.transactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-4 text-sm">
                  <div>
                    <p className="text-(--text-primary)">
                      {t.type} {t.channel === "MemberPortal" ? "(self-service)" : ""}
                    </p>
                    <p className="text-xs text-(--text-secondary)">
                      {new Date(t.createdAt).toLocaleString("en-UG")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={t.type === "Withdrawal" ? "text-(--error-600)" : "text-(--success-600)"}>
                      {t.type === "Withdrawal" ? "-" : "+"}
                      {formatUGX(t.amount)}
                    </p>
                    {t.status === "Pending" && t.method === "MobileMoney" ? (
                      <div className="flex flex-col items-end gap-1.5">
                        <StatusBadge status="Pending confirmation" tone="warning" />
                        <Button
                          size="sm"
                          variant="outline"
                          loading={reconcilingId === t.id}
                          disabled={reconcileMutation.isPending}
                          onClick={() => reconcileMutation.mutate(t.id)}
                        >
                          Check with RohoPay
                        </Button>
                      </div>
                    ) : t.status === "Pending" ? (
                      <StatusBadge status="Pending confirmation" tone="warning" />
                    ) : t.status === "Failed" ? (
                      <StatusBadge status="Failed" tone="error" />
                    ) : (
                      <p className="text-xs text-(--text-secondary)">Balance: {formatUGX(t.balanceAfter)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
