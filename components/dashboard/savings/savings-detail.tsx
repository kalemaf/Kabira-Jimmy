"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Download, Minus, Plus, PiggyBank } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CurrencyInput } from "@/components/ui/currency-input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { StatusBadge } from "@/components/status-badge"
import { EmptyState } from "@/components/dashboard/empty-state"
import { formatUGX } from "@/lib/utils"

const TYPE_DESCRIPTIONS: Record<string, string> = {
  Daily: "Withdraw any time",
  Fixed: "Locked-term deposit",
  Shares: "Membership capital",
}

type SavingsDetailData = {
  id: string
  accountNumber: string
  type: "Daily" | "Fixed" | "Shares"
  balance: number
  openedAt: string
  member: { firstName: string; lastName: string; memberNumber: string }
  transactions: {
    id: string
    type: string
    amount: number
    balanceAfter: number
    createdAt: string
    status: "PendingApproval" | "Pending" | "Confirmed" | "Failed"
    method: "Cash" | "MobileMoney" | "BankTransfer"
    transactionId: string | null
    penaltyAmount: number
    staff: { name: string } | null
    memberUser: { name: string } | null
    confirmedBy: { name: string } | null
  }[]
}

function collectedByLabel(t: SavingsDetailData["transactions"][number]): string {
  if (t.staff) return t.staff.name
  if (t.memberUser) return `${t.memberUser.name} (self-service)`
  return "—"
}

function OverviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-(--border-subtle) py-2.5 text-sm last:border-b-0">
      <span className="text-(--text-secondary)">{label}</span>
      <span className="text-right text-(--text-primary)">{value ?? "—"}</span>
    </div>
  )
}

export function SavingsDetail({
  canTransact,
  canConfirm,
  accountId,
}: {
  canTransact: boolean
  canConfirm: boolean
  accountId: string
}) {
  const queryClient = useQueryClient()
  const [dialogType, setDialogType] = React.useState<"Deposit" | "Withdrawal" | null>(null)
  const [amount, setAmount] = React.useState<number | undefined>(undefined)
  const [downloading, setDownloading] = React.useState(false)

  const { data: account, isLoading } = useQuery({
    queryKey: ["savings-account", accountId],
    queryFn: async () => {
      const res = await fetch(`/api/savings-accounts/${accountId}`)
      if (!res.ok) throw new Error("Failed to load account")
      return res.json() as Promise<SavingsDetailData>
    },
  })

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/savings-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ savingsAccountId: accountId, type: dialogType, amount }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.formErrors?.[0] ?? body.error ?? "Transaction failed")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success(`${dialogType} recorded`)
      setDialogType(null)
      setAmount(undefined)
      queryClient.invalidateQueries({ queryKey: ["savings-account", accountId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const [confirmingId, setConfirmingId] = React.useState<string | null>(null)
  const confirmMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "Confirm" | "Reject" }) => {
      setConfirmingId(id)
      const res = await fetch(`/api/savings-transactions/${id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "Failed to update transaction")
      }
      return res.json()
    },
    onSuccess: (_data, { action }) => {
      toast.success(action === "Confirm" ? "Deposit confirmed" : "Deposit rejected")
      queryClient.invalidateQueries({ queryKey: ["savings-account", accountId] })
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => setConfirmingId(null),
  })

  const [reconcilingId, setReconcilingId] = React.useState<string | null>(null)
  const reconcileMutation = useMutation({
    mutationFn: async (id: string) => {
      setReconcilingId(id)
      const res = await fetch(`/api/savings-transactions/${id}/reconcile`, { method: "POST" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "Failed to check transaction status")
      }
      return res.json() as Promise<{ status: "confirmed" | "failed" | "pending"; message?: string }>
    },
    onSuccess: (data) => {
      if (data.status === "confirmed") toast.success("RohoPay confirms this deposit succeeded — balance updated")
      else if (data.status === "failed") toast.error("RohoPay reports this deposit failed")
      else toast.info(data.message ?? "RohoPay still reports this as pending")
      queryClient.invalidateQueries({ queryKey: ["savings-account", accountId] })
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => setReconcilingId(null),
  })

  const [approvingId, setApprovingId] = React.useState<string | null>(null)
  const approveWithdrawalMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "Approve" | "Reject" }) => {
      setApprovingId(id)
      const res = await fetch(`/api/savings-transactions/${id}/approve-withdrawal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "Failed to update withdrawal")
      }
      return res.json() as Promise<{ status: string }>
    },
    onSuccess: (data, { action }) => {
      if (action === "Reject") toast.success("Withdrawal rejected")
      else if (data.status === "confirmed") toast.success("Withdrawal approved and paid out — balance updated")
      else toast.success("Withdrawal approved — payout initiated")
      queryClient.invalidateQueries({ queryKey: ["savings-account", accountId] })
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => setApprovingId(null),
  })

  async function downloadPassbook() {
    if (!account) return
    setDownloading(true)
    try {
      const [{ pdf }, { SavingsPassbookPDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/pdf/savings-passbook-pdf"),
      ])
      const blob = await pdf(
        <SavingsPassbookPDF
          branchName="Nexcgen"
          accountNumber={account.accountNumber}
          memberName={`${account.member.firstName} ${account.member.lastName}`}
          memberNumber={account.member.memberNumber}
          accountType={account.type}
          balance={account.balance}
          transactions={account.transactions.map((t) => ({
            type: t.type,
            amount: t.amount,
            balanceAfter: t.balanceAfter,
            createdAt: t.createdAt,
            staffName: collectedByLabel(t),
          }))}
        />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `passbook-${account.accountNumber}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error("Failed to generate passbook")
    } finally {
      setDownloading(false)
    }
  }

  if (isLoading) return <div className="h-96 animate-pulse rounded-lg bg-(--bg-card)" />
  if (!account) return <EmptyState icon={PiggyBank} title="Account not found" />

  const confirmedTransactions = account.transactions.filter((t) => t.status === "Confirmed")
  const deposits = confirmedTransactions.filter((t) => t.type === "Deposit").reduce((s, t) => s + t.amount, 0)
  const withdrawals = confirmedTransactions.filter((t) => t.type === "Withdrawal").reduce((s, t) => s + t.amount, 0)
  const pendingTransactions = account.transactions.filter((t) => t.status === "Pending")
  const pendingApprovalWithdrawals = account.transactions.filter((t) => t.status === "PendingApproval")

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-(--border-subtle) bg-(--bg-card) p-6">
        <div>
          <p className="text-xs text-(--text-secondary)">
            Nexcgen &raquo; {account.member.firstName} {account.member.lastName} &raquo; Acc: {account.accountNumber}
          </p>
          <h2 className="mt-1 text-[18px] font-semibold text-(--text-primary)">
            Balance: {formatUGX(account.balance)}
          </h2>
          <p className="text-sm text-(--text-secondary)">{account.member.memberNumber}</p>
        </div>
        <StatusBadge status={account.type} tone="info" />
      </div>

      <div className="flex flex-wrap gap-3">
        {canTransact ? (
          <>
            <Button onClick={() => setDialogType("Deposit")} className="gap-1.5 bg-(--success-600) text-white hover:bg-(--success-600) hover:opacity-90">
              <Plus className="size-4" />
              Deposit
            </Button>
            <Button variant="outline" onClick={() => setDialogType("Withdrawal")} className="gap-1.5">
              <Minus className="size-4" />
              Withdraw
            </Button>
          </>
        ) : null}
        <Button variant="outline" onClick={downloadPassbook} loading={downloading} className="gap-1.5">
          <Download className="size-4" />
          Download passbook
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-(--border-subtle) bg-(--bg-card) p-5">
          <h4 className="mb-2 text-sm font-semibold text-(--text-primary)">Account overview</h4>
          <OverviewRow label="Account type" value={`${account.type} — ${TYPE_DESCRIPTIONS[account.type]}`} />
          <OverviewRow label="Opened on" value={new Date(account.openedAt).toLocaleDateString("en-UG")} />
          <OverviewRow label="Account holder" value={`${account.member.firstName} ${account.member.lastName}`} />
          <OverviewRow label="Member number" value={account.member.memberNumber} />
        </div>
        <div className="rounded-lg border border-(--border-subtle) bg-(--bg-card) p-5">
          <h4 className="mb-2 text-sm font-semibold text-(--text-primary)">Lifetime activity</h4>
          <OverviewRow label="Total deposits" value={formatUGX(deposits)} />
          <OverviewRow label="Total withdrawals" value={formatUGX(withdrawals)} />
          <OverviewRow label="Transactions" value={account.transactions.length} />
          <OverviewRow label="Current balance" value={<span className="font-mono font-semibold tabular-nums">{formatUGX(account.balance)}</span>} />
        </div>
      </div>

      {pendingApprovalWithdrawals.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-(--error-600)/30 bg-(--error-soft)">
          <div className="border-b border-(--error-600)/30 px-5 py-3">
            <h4 className="text-[13px] font-semibold text-(--text-primary)">Withdrawals awaiting approval</h4>
            <p className="mt-0.5 text-xs text-(--text-secondary)">
              Above the automatic self-service limit — no payout has been sent yet. Approving sends the real Mobile Money payout immediately.
            </p>
          </div>
          <div className="divide-y divide-(--border-subtle)">
            {pendingApprovalWithdrawals.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <div>
                  <p className="text-(--text-primary)">
                    {formatUGX(t.amount)}
                    {t.penaltyAmount > 0 ? ` (${formatUGX(t.penaltyAmount)} penalty — net ${formatUGX(t.amount - t.penaltyAmount)})` : ""}
                  </p>
                  <p className="text-xs text-(--text-secondary)">
                    {collectedByLabel(t)} · {new Date(t.createdAt).toLocaleString("en-UG")}
                  </p>
                </div>
                {canConfirm ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      loading={approvingId === t.id && approveWithdrawalMutation.variables?.action === "Reject"}
                      disabled={approveWithdrawalMutation.isPending}
                      onClick={() => approveWithdrawalMutation.mutate({ id: t.id, action: "Reject" })}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      loading={approvingId === t.id && approveWithdrawalMutation.variables?.action === "Approve"}
                      disabled={approveWithdrawalMutation.isPending}
                      onClick={() => approveWithdrawalMutation.mutate({ id: t.id, action: "Approve" })}
                    >
                      Approve &amp; pay out
                    </Button>
                  </div>
                ) : (
                  <StatusBadge status="Awaiting approval" tone="error" />
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {pendingTransactions.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-(--border-subtle) bg-(--warning-soft)">
          <div className="border-b border-(--border-subtle) px-5 py-3">
            <h4 className="text-[13px] font-semibold text-(--text-primary)">Pending confirmations</h4>
            <p className="mt-0.5 text-xs text-(--text-secondary)">
              Member self-service and teller-recorded cash deposits awaiting verification — the balance above does not include these yet.
            </p>
          </div>
          <div className="divide-y divide-(--border-subtle)">
            {pendingTransactions.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <div>
                  <p className="text-(--text-primary)">
                    {formatUGX(t.amount)} · {t.method === "MobileMoney" ? "Mobile Money" : t.method === "BankTransfer" ? "Bank Transfer" : "Cash"}
                  </p>
                  <p className="text-xs text-(--text-secondary)">
                    {collectedByLabel(t)} · {t.transactionId ?? "—"} · {new Date(t.createdAt).toLocaleString("en-UG")}
                  </p>
                </div>
                {(t.method === "BankTransfer" || t.method === "Cash") && canConfirm ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      loading={confirmingId === t.id && confirmMutation.variables?.action === "Reject"}
                      disabled={confirmMutation.isPending}
                      onClick={() => confirmMutation.mutate({ id: t.id, action: "Reject" })}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      loading={confirmingId === t.id && confirmMutation.variables?.action === "Confirm"}
                      disabled={confirmMutation.isPending}
                      onClick={() => confirmMutation.mutate({ id: t.id, action: "Confirm" })}
                    >
                      Confirm
                    </Button>
                  </div>
                ) : t.method === "MobileMoney" && canTransact ? (
                  <div className="flex items-center gap-2">
                    <StatusBadge status="Awaiting Mobile Money confirmation" tone="warning" />
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
                ) : (
                  <StatusBadge status="Awaiting confirmation" tone="warning" />
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-card)">
        <div className="border-b border-(--border-subtle) bg-(--bg-card-hover) px-5 py-3">
          <h4 className="text-[13px] font-semibold text-(--text-primary)">Transaction history</h4>
        </div>
        {account.transactions.length === 0 ? (
          <EmptyState icon={PiggyBank} title="No transactions yet" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {account.transactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{new Date(t.createdAt).toLocaleString("en-UG")}</TableCell>
                  <TableCell>
                    <StatusBadge status={t.type} tone={t.type === "Withdrawal" ? "warning" : "success"} />
                  </TableCell>
                  <TableCell className="whitespace-normal">{collectedByLabel(t)}</TableCell>
                  <TableCell>
                    <StatusBadge
                      status={t.status === "PendingApproval" ? "Awaiting approval" : t.status}
                      tone={t.status === "Confirmed" ? "success" : t.status === "Pending" ? "warning" : t.status === "PendingApproval" ? "accent" : "error"}
                    />
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatUGX(t.amount)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatUGX(t.balanceAfter)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={!!dialogType} onOpenChange={(open) => !open && setDialogType(null)}>
        <DialogContent>
          <DialogHeader>
            <div className={`flex size-10 items-center justify-center rounded-full ${dialogType === "Deposit" ? "bg-(--success-soft)" : "bg-(--warning-soft)"}`}>
              {dialogType === "Deposit" ? (
                <Plus className="size-5 text-(--success-600)" strokeWidth={1.75} />
              ) : (
                <Minus className="size-5 text-(--warning-600)" strokeWidth={1.75} />
              )}
            </div>
            <DialogTitle>{dialogType}</DialogTitle>
            <p className="text-sm text-(--text-secondary)">
              Current balance: <span className="font-mono tabular-nums">{formatUGX(account.balance)}</span>
            </p>
          </DialogHeader>
          <CurrencyInput value={amount} onChange={setAmount} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogType(null)}>
              Cancel
            </Button>
            <Button disabled={!amount} loading={mutation.isPending} onClick={() => mutation.mutate()}>
              Confirm {dialogType}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
