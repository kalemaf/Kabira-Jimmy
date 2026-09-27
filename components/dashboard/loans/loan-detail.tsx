"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Download,
  Wallet,
  Printer,
  FileText,
  ShieldCheck,
  Landmark,
  Receipt,
  StickyNote,
  Plus,
  Scale,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { CurrencyInput } from "@/components/ui/currency-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { StatusBadge } from "@/components/status-badge"
import { EmptyState } from "@/components/dashboard/empty-state"
import { formatUGX, formatPhoneUG } from "@/lib/utils"
import { computeOutstandingBreakdown, calculateUpfrontFees } from "@/lib/loan-calculator"
import type { AmortizationRow, InterestMethod } from "@/lib/loan-calculator"
import type { LoanDisplayStatus } from "@/lib/loan-status"
import type { StaffRole } from "@/components/dashboard/nav-config"

type LoanDetailData = {
  id: string
  principal: number
  interestRate: number
  interestMethod: InterestMethod
  repaymentPeriodMonths: number
  disbursedAt: string
  disbursementMethod: string
  disbursementPhone: string | null
  disbursementNetwork: "MTN" | "Airtel" | null
  status: string
  member: { id: string; firstName: string; lastName: string; memberNumber: string; photoUrl: string | null }
  branch: { name: string }
  disbursedBy: { name: string }
  loanApplication: {
    createdAt: string
    supportingDocumentUrls: string[]
    loanProduct: {
      name: string
      penaltyRate: number
      processingFee: number
      insuranceFee: number
      serviceCharge: number
      lateFee: number
      gracePeriodDays: number
    }
    preparedBy: { name: string } | null
    submittedByMemberUser: { name: string } | null
    approvalSteps: { stage: string; action: string; createdAt: string; user: { name: string } }[]
  }
  repayments: {
    id: string
    amountPaid: number
    principalPortion: number
    interestPortion: number
    penaltyPortion: number
    method: string
    status: string
    receiptNumber: string
    paidAt: string
    collector: { name: string } | null
    memberUser: { name: string } | null
  }[]
  guarantors: { id: string; guaranteeAmount: number; status: string; member: { firstName: string; lastName: string; memberNumber: string } }[]
  collateral: { id: string; description: string; estimatedValue: number }[]
  displayStatus: LoanDisplayStatus
  schedule: { rows: AmortizationRow[]; totalPrincipal: number; totalInterest: number; totalPayable: number; monthlyInstallment: number | null }
  adjustments: {
    id: string
    type: "WriteOff" | "Reschedule" | "InterestWaiver"
    amount: number | null
    previousRepaymentPeriodMonths: number | null
    newRepaymentPeriodMonths: number | null
    reason: string
    requestedBy: { name: string }
    createdAt: string
  }[]
}

type LoanNote = {
  id: string
  body: string
  createdAt: string
  author: { name: string; role: string }
  isDispute: boolean
  disputeStatus: "Open" | "Investigating" | "Resolved" | null
  resolvedBy: { name: string } | null
}

function BalanceRow({
  label,
  original,
  paid,
  waived = 0,
  writtenOff = 0,
  outstanding,
  overdue,
  bold,
}: {
  label: string
  original: number
  paid: number
  waived?: number
  writtenOff?: number
  outstanding: number
  overdue: number
  bold?: boolean
}) {
  const cell = bold ? "font-semibold" : ""
  const colBorder = "border-r border-(--border-subtle) last:border-r-0"
  return (
    <tr className={`h-11 border-b border-(--border-subtle) text-(--text-primary) last:border-b-0 ${bold ? "bg-(--bg-surface)" : ""}`}>
      <td className={`${colBorder} pl-5 ${cell}`}>{label}</td>
      <td className={`${colBorder} text-right font-mono tabular-nums ${cell}`}>{formatUGX(original)}</td>
      <td className={`${colBorder} text-right font-mono tabular-nums ${cell}`}>{formatUGX(paid)}</td>
      <td className={`${colBorder} text-right font-mono tabular-nums ${waived > 0 ? "text-(--text-primary)" : "text-(--text-muted)"}`}>{formatUGX(waived)}</td>
      <td className={`${colBorder} text-right font-mono tabular-nums ${writtenOff > 0 ? "text-(--text-primary)" : "text-(--text-muted)"}`}>{formatUGX(writtenOff)}</td>
      <td className={`${colBorder} text-right font-mono tabular-nums ${cell}`}>{formatUGX(outstanding)}</td>
      <td className={`pr-5 text-right font-mono tabular-nums ${overdue > 0 ? "text-(--error-600)" : cell}`}>
        {formatUGX(overdue)}
      </td>
    </tr>
  )
}

function OverviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-(--border-subtle) py-2.5 text-sm last:border-b-0">
      <span className="text-(--text-secondary)">{label}</span>
      <span className="text-right text-(--text-primary)">{value ?? "—"}</span>
    </div>
  )
}

export function LoanDetail({ loanId, role }: { loanId: string; role: StaffRole }) {
  const [downloading, setDownloading] = React.useState(false)
  const [downloadingReceiptId, setDownloadingReceiptId] = React.useState<string | null>(null)
  const [noteBody, setNoteBody] = React.useState("")
  const [noteIsDispute, setNoteIsDispute] = React.useState(false)
  const [showAdjustDialog, setShowAdjustDialog] = React.useState(false)
  const [adjustType, setAdjustType] = React.useState<"WriteOff" | "Reschedule" | "InterestWaiver">("WriteOff")
  const [adjustAmount, setAdjustAmount] = React.useState<number>(0)
  const [adjustNewPeriod, setAdjustNewPeriod] = React.useState<number>(0)
  const [adjustReason, setAdjustReason] = React.useState("")
  const queryClient = useQueryClient()

  const { data: loan, isLoading } = useQuery({
    queryKey: ["loan", loanId],
    queryFn: async () => {
      const res = await fetch(`/api/loans/${loanId}`)
      if (!res.ok) throw new Error("Failed to load loan")
      return res.json() as Promise<LoanDetailData>
    },
  })

  const { data: notesData } = useQuery({
    queryKey: ["loan-notes", loanId],
    queryFn: async () => {
      const res = await fetch(`/api/loans/${loanId}/notes`)
      if (!res.ok) throw new Error("Failed to load notes")
      return res.json() as Promise<{ data: LoanNote[] }>
    },
  })

  const [reconcilingId, setReconcilingId] = React.useState<string | null>(null)
  const reconcileMutation = useMutation({
    mutationFn: async (id: string) => {
      setReconcilingId(id)
      const res = await fetch(`/api/repayments/${id}/reconcile`, { method: "POST" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "Failed to check repayment status")
      }
      return res.json() as Promise<{ status: "confirmed" | "failed" | "pending"; message?: string }>
    },
    onSuccess: (data) => {
      if (data.status === "confirmed") toast.success("RohoPay confirms this repayment succeeded — balance updated")
      else if (data.status === "failed") toast.error("RohoPay reports this repayment failed")
      else toast.info(data.message ?? "RohoPay still reports this as pending")
      queryClient.invalidateQueries({ queryKey: ["loan", loanId] })
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => setReconcilingId(null),
  })

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/loans/${loanId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteBody, isDispute: noteIsDispute }),
      })
      if (!res.ok) throw new Error("Failed to add note")
      return res.json()
    },
    onSuccess: () => {
      setNoteBody("")
      setNoteIsDispute(false)
      queryClient.invalidateQueries({ queryKey: ["loan-notes", loanId] })
      toast.success(noteIsDispute ? "Dispute flagged" : "Note added")
    },
    onError: () => toast.error("Failed to add note"),
  })

  const resolveDisputeMutation = useMutation({
    mutationFn: async ({ noteId, disputeStatus }: { noteId: string; disputeStatus: "Investigating" | "Resolved" }) => {
      const res = await fetch(`/api/loans/${loanId}/notes/${noteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disputeStatus }),
      })
      if (!res.ok) throw new Error("Failed to update dispute")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan-notes", loanId] })
      toast.success("Dispute updated")
    },
    onError: () => toast.error("Failed to update dispute"),
  })

  const adjustMutation = useMutation({
    mutationFn: async () => {
      const body =
        adjustType === "Reschedule"
          ? { type: adjustType, newRepaymentPeriodMonths: adjustNewPeriod, reason: adjustReason }
          : { type: adjustType, amount: adjustAmount, reason: adjustReason }
      const res = await fetch(`/api/loans/${loanId}/adjustments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error?.formErrors?.[0] ?? errBody.error ?? "Failed to apply adjustment")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success(
        adjustType === "WriteOff"
          ? "Loan written off"
          : adjustType === "Reschedule"
            ? "Repayment period rescheduled"
            : "Interest waived"
      )
      setShowAdjustDialog(false)
      setAdjustAmount(0)
      setAdjustNewPeriod(0)
      setAdjustReason("")
      queryClient.invalidateQueries({ queryKey: ["loan", loanId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  async function downloadAgreement() {
    if (!loan) return
    setDownloading(true)
    try {
      const [{ pdf }, { LoanAgreementPDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/pdf/loan-agreement-pdf"),
      ])
      const blob = await pdf(
        <LoanAgreementPDF
          branchName={loan.branch.name}
          memberName={`${loan.member.firstName} ${loan.member.lastName}`}
          memberNumber={loan.member.memberNumber}
          loanProductName={loan.loanApplication.loanProduct.name}
          principal={loan.principal}
          interestRate={loan.interestRate}
          interestMethod={loan.interestMethod}
          repaymentPeriodMonths={loan.repaymentPeriodMonths}
          disbursedAt={loan.disbursedAt}
          totalPayable={loan.schedule.totalPayable}
          monthlyInstallment={loan.schedule.monthlyInstallment}
          schedule={loan.schedule.rows}
        />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `loan-agreement-${loan.member.memberNumber}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error("Failed to generate agreement")
    } finally {
      setDownloading(false)
    }
  }

  async function downloadReceiptFor(repayment: LoanDetailData["repayments"][number]) {
    if (!loan) return
    setDownloadingReceiptId(repayment.id)
    try {
      const [{ pdf }, { ReceiptPDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/pdf/receipt-pdf"),
      ])
      const confirmedAsc = [...loan.repayments]
        .filter((r) => r.status === "Confirmed")
        .sort((a, b) => new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime())
      let runningPrincipal = 0
      let balanceAfter = loan.principal
      for (const r of confirmedAsc) {
        runningPrincipal += r.principalPortion
        balanceAfter = Math.max(loan.principal - runningPrincipal, 0)
        if (r.id === repayment.id) break
      }
      const blob = await pdf(
        <ReceiptPDF
          branchName={loan.branch.name}
          receiptNumber={repayment.receiptNumber}
          memberName={`${loan.member.firstName} ${loan.member.lastName}`}
          memberNumber={loan.member.memberNumber}
          amountPaid={repayment.amountPaid}
          principalPortion={repayment.principalPortion}
          interestPortion={repayment.interestPortion}
          penaltyPortion={repayment.penaltyPortion}
          method={repayment.method}
          collectorName={repayment.collector?.name ?? (repayment.memberUser ? `${repayment.memberUser.name} (self-service)` : "—")}
          paidAt={repayment.paidAt}
          outstandingBalance={balanceAfter}
        />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `receipt-${repayment.receiptNumber}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error("Failed to generate receipt")
    } finally {
      setDownloadingReceiptId(null)
    }
  }

  if (isLoading) return <div className="h-96 animate-pulse rounded-lg bg-(--bg-card)" />
  if (!loan) return <EmptyState icon={Wallet} title="Loan not found" />

  const confirmedRepayments = loan.repayments.filter((r) => r.status === "Confirmed")
  const repaidPrincipal = confirmedRepayments.reduce((s, r) => s + r.principalPortion, 0)
  const repaidInterest = confirmedRepayments.reduce((s, r) => s + r.interestPortion, 0)
  const repaidPenalty = confirmedRepayments.reduce((s, r) => s + r.penaltyPortion, 0)

  const writeOffTotal = loan.adjustments.filter((a) => a.type === "WriteOff").reduce((s, a) => s + (a.amount ?? 0), 0)
  const waivedInterestTotal = loan.adjustments
    .filter((a) => a.type === "InterestWaiver")
    .reduce((s, a) => s + (a.amount ?? 0), 0)

  const outstanding = computeOutstandingBreakdown(
    loan.schedule,
    confirmedRepayments,
    loan.loanApplication.loanProduct.penaltyRate,
    undefined,
    waivedInterestTotal
  )
  const fees = calculateUpfrontFees(loan.principal, {
    processingFee: loan.loanApplication.loanProduct.processingFee,
    insuranceFee: loan.loanApplication.loanProduct.insuranceFee,
    serviceCharge: loan.loanApplication.loanProduct.serviceCharge,
  })

  const principalOutstandingTotal = Math.max(loan.principal - repaidPrincipal - writeOffTotal, 0)
  const interestOutstandingTotal = Math.max(loan.schedule.totalInterest - repaidInterest - waivedInterestTotal, 0)
  const penaltyOriginal = repaidPenalty + outstanding.penaltyDue

  const balanceRows = [
    {
      label: "Principal",
      original: loan.principal,
      paid: repaidPrincipal,
      writtenOff: writeOffTotal,
      outstanding: principalOutstandingTotal,
      overdue: outstanding.principalDue,
    },
    {
      label: "Interest",
      original: loan.schedule.totalInterest,
      paid: repaidInterest,
      waived: waivedInterestTotal,
      outstanding: interestOutstandingTotal,
      overdue: outstanding.interestDue,
    },
    { label: "Fees", original: fees.total, paid: fees.total, outstanding: 0, overdue: 0 },
    { label: "Penalties", original: penaltyOriginal, paid: repaidPenalty, outstanding: outstanding.penaltyDue, overdue: outstanding.penaltyDue },
  ]
  const totals = {
    original: balanceRows.reduce((s, r) => s + r.original, 0),
    paid: balanceRows.reduce((s, r) => s + r.paid, 0),
    waived: balanceRows.reduce((s, r) => s + ("waived" in r ? (r.waived ?? 0) : 0), 0),
    writtenOff: balanceRows.reduce((s, r) => s + ("writtenOff" in r ? (r.writtenOff ?? 0) : 0), 0),
    outstanding: balanceRows.reduce((s, r) => s + r.outstanding, 0),
    overdue: balanceRows.reduce((s, r) => s + r.overdue, 0),
  }

  const amortizationLabel = loan.interestMethod === "Declining" ? "Equal principal, declining interest" : "Equal instalments"
  const preparerName =
    loan.loanApplication.preparedBy?.name ??
    (loan.loanApplication.submittedByMemberUser ? `${loan.loanApplication.submittedByMemberUser.name} (member self-service)` : "—")
  const managerApproval = loan.loanApplication.approvalSteps.find((s) => s.stage === "Manager" && s.action === "Approve")

  const openDisputes = (notesData?.data ?? []).filter((n) => n.isDispute && n.disputeStatus !== "Resolved")

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-(--border-subtle) bg-(--bg-card) p-6">
        <div>
          <p className="text-xs text-(--text-secondary)">
            Nexcgen &raquo; {loan.member.firstName} {loan.member.lastName} &raquo; Acc: {loan.member.memberNumber}
          </p>
          <h2 className="mt-1 text-[18px] font-semibold text-(--text-primary)">
            Balance: {formatUGX(loan.displayStatus.outstandingBalance)}
          </h2>
          <p className="text-sm text-(--text-secondary)">{loan.branch.name} · {loan.loanApplication.loanProduct.name}</p>
        </div>
        <StatusBadge status={loan.displayStatus.label} tone={loan.displayStatus.tone} />
      </div>

      {openDisputes.length > 0 ? (
        <div className="rounded-lg border border-(--error-border) bg-(--error-soft) p-4 text-sm text-(--error-600)">
          <p className="font-semibold">
            {openDisputes.length} open dispute{openDisputes.length > 1 ? "s" : ""} on this loan
          </p>
          <p className="mt-1">&ldquo;{openDisputes[0].body}&rdquo; — see the Notes tab for details.</p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={() => window.print()} className="gap-1.5">
          <Printer className="size-4" />
          Print Statement
        </Button>
        <Button
          render={<Link href={`/dashboard/repayments?loanId=${loan.id}`} />}
          nativeButton={false}
          className="gap-1.5 bg-(--success-600) text-white hover:bg-(--success-600) hover:opacity-90"
        >
          <Wallet className="size-4" />
          Make Payment
        </Button>
        <Button variant="outline" onClick={downloadAgreement} loading={downloading} className="gap-1.5">
          <Download className="size-4" />
          Download Agreement
        </Button>
        {(role === "SuperAdmin" || role === "Manager") &&
        loan.status !== "PaidOff" &&
        loan.status !== "WrittenOff" ? (
          <Button variant="outline" onClick={() => setShowAdjustDialog(true)} className="gap-1.5">
            <Scale className="size-4" />
            Restructure loan
          </Button>
        ) : null}
      </div>

      <Tabs defaultValue="details">
        <TabsList variant="banner">
          <TabsTrigger value="details">Account Details</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="guarantors">Guarantors</TabsTrigger>
          <TabsTrigger value="collateral">Collateral</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="charges">Charges</TabsTrigger>
          <TabsTrigger value="adjustments">Adjustments</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4 space-y-6">
          <div className="overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-card)">
            <div className="border-b border-(--border-subtle) p-5">
              <h4 className="text-sm font-semibold text-(--text-primary)">Current balance</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-brand-gradient h-11 text-[12px] font-semibold tracking-wide text-white uppercase">
                    <th className="border-r border-white/20 pl-5 text-left">&nbsp;</th>
                    <th className="border-r border-white/20 text-right">Original</th>
                    <th className="border-r border-white/20 text-right">Paid</th>
                    <th className="border-r border-white/20 text-right">Waived</th>
                    <th className="border-r border-white/20 text-right">Written Off</th>
                    <th className="border-r border-white/20 text-right">Outstanding</th>
                    <th className="pr-5 text-right">Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {balanceRows.map((r) => (
                    <BalanceRow key={r.label} {...r} />
                  ))}
                  <BalanceRow label="Total" {...totals} bold />
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-(--border-subtle) bg-(--bg-card) p-5">
              <h4 className="mb-2 text-sm font-semibold text-(--text-primary)">Loan overview</h4>
              <OverviewRow label="Repayment strategy" value="Penalties, Interest, Principal" />
              <OverviewRow label="Repayments" value={`1 every 1 Month${loan.repaymentPeriodMonths > 1 ? "s" : ""}`} />
              <OverviewRow label="Amortization" value={amortizationLabel} />
              <OverviewRow
                label="Interest"
                value={`${loan.interestRate}% per month (${loan.interestMethod})`}
              />
              <OverviewRow label="Loan Officer" value={preparerName} />
              <OverviewRow label="Grace period" value={`${loan.loanApplication.loanProduct.gracePeriodDays} days`} />
            </div>
            <div className="rounded-lg border border-(--border-subtle) bg-(--bg-card) p-5">
              <h4 className="mb-2 text-sm font-semibold text-(--text-primary)">Timeline (for audit)</h4>
              <OverviewRow label="Applied on" value={new Date(loan.loanApplication.createdAt).toLocaleString("en-UG")} />
              <OverviewRow label="Applied by" value={preparerName} />
              <OverviewRow
                label="Approved on"
                value={managerApproval ? new Date(managerApproval.createdAt).toLocaleString("en-UG") : undefined}
              />
              <OverviewRow label="Approved by" value={managerApproval?.user.name} />
              <OverviewRow label="Disbursed on" value={new Date(loan.disbursedAt).toLocaleString("en-UG")} />
              <OverviewRow label="Disbursed by" value={loan.disbursedBy.name} />
              <OverviewRow label="Disbursement method" value={loan.disbursementMethod} />
              <OverviewRow
                label="Disbursed to (phone)"
                value={
                  loan.disbursementMethod === "MobileMoney"
                    ? `${formatPhoneUG(loan.disbursementPhone)}${loan.disbursementNetwork ? ` (${loan.disbursementNetwork})` : ""}`
                    : "N/A — " + loan.disbursementMethod
                }
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="schedule" className="mt-4">
          <div className="overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-card)">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-brand-gradient h-11 text-[12px] font-semibold tracking-wide text-white uppercase">
                    <th className="border-r border-white/20 pl-5 text-left">#</th>
                    <th className="border-r border-white/20 text-left">Due date</th>
                    <th className="border-r border-white/20 text-right">Principal</th>
                    <th className="border-r border-white/20 text-right">Interest</th>
                    <th className="border-r border-white/20 text-right">Instalment</th>
                    <th className="pr-5 text-right">Balance if paid on time</th>
                  </tr>
                </thead>
                <tbody>
                  {loan.schedule.rows.map((row) => (
                    <tr key={row.period} className="h-11 border-b border-(--border-subtle) text-(--text-primary) last:border-b-0">
                      <td className="border-r border-(--border-subtle) pl-5">{row.period}</td>
                      <td className="border-r border-(--border-subtle)">{new Date(row.dueDate).toLocaleDateString("en-UG")}</td>
                      <td className="border-r border-(--border-subtle) text-right font-mono tabular-nums">{formatUGX(row.principal)}</td>
                      <td className="border-r border-(--border-subtle) text-right font-mono tabular-nums">{formatUGX(row.interest)}</td>
                      <td className="border-r border-(--border-subtle) text-right font-mono tabular-nums">{formatUGX(row.installment)}</td>
                      <td className="pr-5 text-right font-mono tabular-nums">{formatUGX(row.closingBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="guarantors" className="mt-4">
          {loan.guarantors.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="No guarantors" description="Guarantors attached to this loan will appear here." />
          ) : (
            <div className="overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-card)">
              <div className="divide-y divide-(--border-subtle)">
                {loan.guarantors.map((g) => (
                  <div key={g.id} className="flex items-center justify-between p-4 text-sm">
                    <span className="text-(--text-primary)">
                      {g.member.firstName} {g.member.lastName} ({g.member.memberNumber})
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="font-mono tabular-nums text-(--text-secondary)">{formatUGX(g.guaranteeAmount)}</span>
                      <StatusBadge status={g.status} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="collateral" className="mt-4">
          {loan.collateral.length === 0 ? (
            <EmptyState icon={Landmark} title="No collateral" description="Collateral items attached to this loan will appear here." />
          ) : (
            <div className="overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-card)">
              <div className="divide-y divide-(--border-subtle)">
                {loan.collateral.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-4 text-sm">
                    <span className="text-(--text-primary)">{c.description}</span>
                    <span className="font-mono tabular-nums text-(--text-secondary)">{formatUGX(c.estimatedValue)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          {loan.loanApplication.supportingDocumentUrls.length === 0 ? (
            <EmptyState icon={FileText} title="No documents" description="Supporting documents attached at application will appear here." />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {loan.loanApplication.supportingDocumentUrls.map((url, i) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-lg border border-(--border-subtle) bg-(--bg-card) p-4 text-sm transition-colors hover:bg-(--bg-card-hover)"
                >
                  <span className="text-(--text-primary)">Document {i + 1}</span>
                  <FileText className="size-4 text-(--text-muted)" />
                </a>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-4 space-y-4">
          <div className="rounded-lg border border-(--border-subtle) bg-(--bg-card) p-5">
            <Textarea
              placeholder="Add a note about this loan..."
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
            />
            <div className="mt-3 flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-(--text-secondary)">
                <Checkbox checked={noteIsDispute} onCheckedChange={(v) => setNoteIsDispute(!!v)} />
                Flag as a dispute (e.g. member says they didn&apos;t receive funds)
              </label>
              <Button
                size="sm"
                variant={noteIsDispute ? "destructive" : "default"}
                disabled={!noteBody.trim()}
                loading={addNoteMutation.isPending}
                onClick={() => addNoteMutation.mutate()}
                className="gap-1.5"
              >
                <Plus className="size-4" />
                {noteIsDispute ? "Flag dispute" : "Add note"}
              </Button>
            </div>
          </div>
          {!notesData || notesData.data.length === 0 ? (
            <EmptyState icon={StickyNote} title="No notes yet" />
          ) : (
            <div className="overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-card)">
              <div className="divide-y divide-(--border-subtle)">
                {notesData.data.map((n) => (
                  <div key={n.id} className="p-4 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-(--text-primary)">{n.body}</p>
                      {n.isDispute ? (
                        <StatusBadge
                          status={n.disputeStatus ?? "Open"}
                          tone={n.disputeStatus === "Resolved" ? "success" : n.disputeStatus === "Investigating" ? "warning" : "error"}
                        />
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-(--text-secondary)">
                      {n.author.name} ({n.author.role}) · {new Date(n.createdAt).toLocaleString("en-UG")}
                      {n.resolvedBy ? ` · resolved by ${n.resolvedBy.name}` : ""}
                    </p>
                    {n.isDispute && n.disputeStatus !== "Resolved" ? (
                      <div className="mt-2 flex gap-2">
                        {n.disputeStatus === "Open" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            loading={resolveDisputeMutation.isPending}
                            onClick={() => resolveDisputeMutation.mutate({ noteId: n.id, disputeStatus: "Investigating" })}
                          >
                            Mark investigating
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          loading={resolveDisputeMutation.isPending}
                          onClick={() => resolveDisputeMutation.mutate({ noteId: n.id, disputeStatus: "Resolved" })}
                        >
                          Mark resolved
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="transactions" className="mt-4">
          {loan.repayments.length === 0 ? (
            <EmptyState icon={Wallet} title="No repayments yet" description="Payments collected against this loan will appear here." />
          ) : (
            <div className="overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-card)">
              <div className="divide-y divide-(--border-subtle)">
                {loan.repayments.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-4 text-sm">
                    <div>
                      <p className="text-(--text-primary)">{formatUGX(r.amountPaid)}</p>
                      <p className="text-xs text-(--text-secondary)">
                        {r.method} · {r.receiptNumber} ·{" "}
                        {r.collector?.name ?? (r.memberUser ? `${r.memberUser.name} (self-service)` : "—")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {r.status === "Confirmed" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          loading={downloadingReceiptId === r.id}
                          onClick={() => downloadReceiptFor(r)}
                          className="gap-1.5"
                        >
                          <Download className="size-3.5" />
                          Receipt
                        </Button>
                      ) : null}
                      {r.status === "Pending" && r.method === "MobileMoney" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          loading={reconcilingId === r.id}
                          disabled={reconcileMutation.isPending}
                          onClick={() => reconcileMutation.mutate(r.id)}
                        >
                          Check with RohoPay
                        </Button>
                      ) : null}
                      <div className="text-right">
                        <StatusBadge
                          status={r.status}
                          tone={r.status === "Confirmed" ? "success" : r.status === "Pending" ? "warning" : "error"}
                        />
                        <p className="mt-1 text-xs text-(--text-secondary)">{new Date(r.paidAt).toLocaleDateString("en-UG")}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="charges" className="mt-4">
          <div className="overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-card)">
            <div className="border-b border-(--border-subtle) p-5">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-(--text-primary)">
                <Receipt className="size-4" />
                Product-defined charges
              </h4>
              <p className="mt-1 text-xs text-(--text-secondary)">
                Deducted from proceeds at disbursement, per {loan.loanApplication.loanProduct.name}&apos;s rates.
              </p>
            </div>
            <div className="divide-y divide-(--border-subtle)">
              <div className="flex items-center justify-between p-4 text-sm">
                <span className="text-(--text-secondary)">Processing fee ({loan.loanApplication.loanProduct.processingFee}%)</span>
                <span className="font-mono tabular-nums text-(--text-primary)">{formatUGX(fees.processingFee)}</span>
              </div>
              <div className="flex items-center justify-between p-4 text-sm">
                <span className="text-(--text-secondary)">Insurance fee ({loan.loanApplication.loanProduct.insuranceFee}%)</span>
                <span className="font-mono tabular-nums text-(--text-primary)">{formatUGX(fees.insuranceFee)}</span>
              </div>
              <div className="flex items-center justify-between p-4 text-sm">
                <span className="text-(--text-secondary)">Service charge ({loan.loanApplication.loanProduct.serviceCharge}%)</span>
                <span className="font-mono tabular-nums text-(--text-primary)">{formatUGX(fees.serviceCharge)}</span>
              </div>
              <div className="flex items-center justify-between p-4 text-sm">
                <span className="text-(--text-secondary)">Late fee rate (applied per overdue instalment)</span>
                <span className="font-mono tabular-nums text-(--text-primary)">{loan.loanApplication.loanProduct.lateFee}%</span>
              </div>
              <div className="flex items-center justify-between p-4 text-sm font-semibold">
                <span className="text-(--text-primary)">Total upfront charges</span>
                <span className="font-mono tabular-nums text-(--text-primary)">{formatUGX(fees.total)}</span>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="adjustments" className="mt-4">
          {loan.adjustments.length === 0 ? (
            <EmptyState
              icon={Scale}
              title="No adjustments"
              description="Write-offs, reschedules, and interest waivers applied to this loan will appear here."
            />
          ) : (
            <div className="overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-card)">
              <div className="divide-y divide-(--border-subtle)">
                {loan.adjustments.map((a) => (
                  <div key={a.id} className="p-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-(--text-primary)">
                        {a.type === "WriteOff"
                          ? `Written off ${formatUGX(a.amount ?? 0)}`
                          : a.type === "InterestWaiver"
                            ? `Waived ${formatUGX(a.amount ?? 0)} interest`
                            : `Rescheduled ${a.previousRepaymentPeriodMonths} → ${a.newRepaymentPeriodMonths} months`}
                      </span>
                      <span className="text-xs text-(--text-secondary)">
                        {new Date(a.createdAt).toLocaleString("en-UG")}
                      </span>
                    </div>
                    <p className="mt-1 text-(--text-secondary)">&ldquo;{a.reason}&rdquo;</p>
                    <p className="mt-1 text-xs text-(--text-muted)">by {a.requestedBy.name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restructure this loan</DialogTitle>
            <DialogDescription>
              Recorded permanently against this loan and cannot be undone. Choose carefully.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={adjustType} onValueChange={(v) => v && setAdjustType(v as typeof adjustType)}>
              <SelectTrigger className="h-[42px] w-full rounded-sm border-(--border-subtle) px-3.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WriteOff">Write off part or all of the balance</SelectItem>
                <SelectItem value="Reschedule">Reschedule the repayment period</SelectItem>
                <SelectItem value="InterestWaiver">Waive remaining interest</SelectItem>
              </SelectContent>
            </Select>

            {adjustType === "Reschedule" ? (
              <div>
                <label className="mb-1.5 block text-sm text-(--text-secondary)">
                  New repayment period (months) — currently {loan.repaymentPeriodMonths}
                </label>
                <Input
                  type="number"
                  min={1}
                  value={adjustNewPeriod || ""}
                  onChange={(e) => setAdjustNewPeriod(e.target.valueAsNumber || 0)}
                />
              </div>
            ) : (
              <div>
                <label className="mb-1.5 block text-sm text-(--text-secondary)">
                  {adjustType === "WriteOff" ? "Amount to write off" : "Interest amount to waive"} — outstanding
                  principal {formatUGX(principalOutstandingTotal)}, outstanding interest{" "}
                  {formatUGX(interestOutstandingTotal)}
                </label>
                <CurrencyInput value={adjustAmount} onChange={(v) => setAdjustAmount(v ?? 0)} />
              </div>
            )}

            <Textarea
              placeholder="Reason (required)"
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAdjustDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={adjustMutation.isPending}
              disabled={
                adjustReason.trim().length < 10 ||
                (adjustType === "Reschedule" ? adjustNewPeriod < 1 : adjustAmount <= 0)
              }
              onClick={() => adjustMutation.mutate()}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
