"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Download, Wallet, HandCoins } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CurrencyInput } from "@/components/ui/currency-input"
import { PhoneInput } from "@/components/ui/phone-input"
import { NetworkToggle } from "@/components/ui/mobile-money-badges"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { EmptyState } from "@/components/dashboard/empty-state"
import { StatusBadge } from "@/components/status-badge"
import { formatUGX, detectMobileMoneyNetwork } from "@/lib/utils"
import { memberRepaymentSchema, type MemberRepaymentInput } from "@/lib/schemas/member-loan"

type LoanDetailData = {
  id: string
  principal: number
  interestRate: number
  interestMethod: string
  repaymentPeriodMonths: number
  disbursedAt: string
  branchName: string
  memberName: string
  memberNumber: string
  productName: string
  displayStatus: { label: string; tone: "success" | "info" | "warning" | "accent" | "error" | "defaulted"; outstandingBalance: number }
  schedule: {
    rows: { period: number; dueDate: string; principal: number; interest: number; installment: number; closingBalance: number }[]
    totalPayable: number
    monthlyInstallment: number | null
  }
  outstanding: {
    principalDue: number
    interestDue: number
    penaltyDue: number
    totalDue: number
    principalPayable: number
    interestPayable: number
  }
  repayments: {
    id: string
    amountPaid: number
    method: string
    status: string
    receiptNumber: string
    paidAt: string
  }[]
}

export function MemberLoanDetail({ loanId }: { loanId: string }) {
  const [repayOpen, setRepayOpen] = React.useState(false)
  const [downloading, setDownloading] = React.useState(false)
  const queryClient = useQueryClient()

  const { data: loan, isLoading } = useQuery({
    queryKey: ["member-loan", loanId],
    queryFn: async () => {
      const res = await fetch(`/api/member-portal/loans/${loanId}`)
      if (!res.ok) throw new Error("Failed to load loan")
      return res.json() as Promise<LoanDetailData>
    },
  })

  const form = useForm<MemberRepaymentInput>({
    resolver: zodResolver(memberRepaymentSchema),
    defaultValues: { amount: 0, phone: "", network: undefined },
  })

  // Pre-selects MTN/Airtel from the number's prefix as a convenience — never
  // trusted outright (see detectMobileMoneyNetwork), so it stops overriding
  // the moment the member touches the toggle themselves.
  const networkTouchedRef = React.useRef(false)
  const repayPhoneValue = form.watch("phone")
  React.useEffect(() => {
    if (networkTouchedRef.current) return
    const detected = detectMobileMoneyNetwork(repayPhoneValue)
    if (detected) form.setValue("network", detected, { shouldValidate: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repayPhoneValue])

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
      if (data.status === "confirmed") toast.success("RohoPay confirms this payment succeeded — your balance is updated")
      else if (data.status === "failed") toast.error("RohoPay reports this payment failed")
      else toast.info(data.message ?? "RohoPay still reports this as pending — try again shortly")
      queryClient.invalidateQueries({ queryKey: ["member-loan", loanId] })
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => setReconcilingId(null),
  })

  const repayMutation = useMutation({
    mutationFn: async (values: MemberRepaymentInput) => {
      const res = await fetch(`/api/member-portal/loans/${loanId}/repay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.formErrors?.[0] ?? body.error ?? "Failed to initiate repayment")
      }
      return res.json()
    },
    onSuccess: (result) => {
      toast.success(result.message ?? "Repayment initiated")
      setRepayOpen(false)
      networkTouchedRef.current = false
      form.reset({ amount: 0, phone: "", network: undefined })
      queryClient.invalidateQueries({ queryKey: ["member-loan", loanId] })
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
          branchName={loan.branchName}
          memberName={loan.memberName}
          memberNumber={loan.memberNumber}
          loanProductName={loan.productName}
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
      link.download = `loan-agreement-${loan.memberNumber}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error("Failed to generate agreement")
    } finally {
      setDownloading(false)
    }
  }

  if (isLoading) return <div className="h-96 animate-pulse rounded-lg bg-(--bg-card)" />
  if (!loan) return <EmptyState icon={HandCoins} title="Loan not found" />

  // Matches app/api/member-portal/loans/[id]/repay/route.ts's totalOwed
  // exactly — the FULL remaining balance (principal + interest + any
  // penalty), not just outstanding.totalDue, which only counts strictly
  // overdue installments and would otherwise block paying early/anytime
  // (before the next installment's due date) from the member portal.
  const totalPayable = loan.outstanding.principalPayable + loan.outstanding.interestPayable + loan.outstanding.penaltyDue
  const canRepay = totalPayable > 0

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-(--border-subtle) bg-(--bg-card) p-6">
        <div>
          <p className="text-sm text-(--text-secondary)">{loan.productName} · {loan.branchName}</p>
          <h1 className="mt-1 text-[20px] font-semibold text-(--text-primary)">
            {formatUGX(loan.displayStatus.outstandingBalance)} outstanding
          </h1>
        </div>
        <StatusBadge status={loan.displayStatus.label} tone={loan.displayStatus.tone} />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => setRepayOpen(true)} disabled={!canRepay} className="gap-1.5">
          <Wallet className="size-4" />
          Repay via Mobile Money
        </Button>
        <Button variant="outline" onClick={downloadAgreement} loading={downloading} className="gap-1.5">
          <Download className="size-4" />
          Download Loan Agreement
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-(--border-subtle) bg-(--bg-card) p-5">
          <p className="text-xs text-(--text-secondary)">Principal</p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums text-(--text-primary)">{formatUGX(loan.principal)}</p>
        </div>
        <div className="rounded-lg border border-(--border-subtle) bg-(--bg-card) p-5">
          <p className="text-xs text-(--text-secondary)">Interest rate</p>
          <p className="mt-1 text-lg font-bold text-(--text-primary)">{loan.interestRate}% / month</p>
        </div>
        <div className="rounded-lg border border-(--border-subtle) bg-(--bg-card) p-5">
          <p className="text-xs text-(--text-secondary)">Monthly installment</p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums text-(--text-primary)">
            {loan.schedule.monthlyInstallment ? formatUGX(loan.schedule.monthlyInstallment) : "Varies"}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-card)">
        <h3 className="border-b border-(--border-subtle) bg-(--bg-card-hover) px-5 py-3 text-[13px] font-semibold text-(--text-primary)">
          Repayment schedule
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-brand-gradient h-11 text-[12px] font-semibold tracking-wide text-white uppercase">
                <th className="border-r border-white/20 pl-5 text-left">#</th>
                <th className="border-r border-white/20 text-left">Due date</th>
                <th className="border-r border-white/20 text-right">Installment</th>
                <th className="pr-5 text-right">Balance if paid on time</th>
              </tr>
            </thead>
            <tbody>
              {loan.schedule.rows.map((row) => (
                <tr key={row.period} className="h-11 border-b border-(--border-subtle) text-(--text-primary) last:border-b-0">
                  <td className="border-r border-(--border-subtle) pl-5">{row.period}</td>
                  <td className="border-r border-(--border-subtle)">{new Date(row.dueDate).toLocaleDateString("en-UG")}</td>
                  <td className="border-r border-(--border-subtle) text-right font-mono tabular-nums">{formatUGX(row.installment)}</td>
                  <td className="pr-5 text-right font-mono tabular-nums">{formatUGX(row.closingBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-card)">
        <h3 className="border-b border-(--border-subtle) bg-(--bg-card-hover) px-5 py-3 text-[13px] font-semibold text-(--text-primary)">
          Repayment history
        </h3>
        {loan.repayments.length === 0 ? (
          <EmptyState icon={Wallet} title="No repayments yet" />
        ) : (
          <div className="divide-y divide-(--border-subtle)">
            {loan.repayments.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-4 text-sm">
                <div>
                  <p className="text-(--text-primary)">{formatUGX(r.amountPaid)}</p>
                  <p className="text-xs text-(--text-secondary)">{r.method} · {r.receiptNumber}</p>
                  {r.status === "Pending" && r.method === "MobileMoney" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      loading={reconcilingId === r.id}
                      disabled={reconcileMutation.isPending}
                      onClick={() => reconcileMutation.mutate(r.id)}
                    >
                      Check with RohoPay
                    </Button>
                  ) : null}
                </div>
                <div className="text-right">
                  <StatusBadge
                    status={r.status}
                    tone={r.status === "Confirmed" ? "success" : r.status === "Pending" ? "warning" : "error"}
                  />
                  <p className="mt-1 text-xs text-(--text-secondary)">{new Date(r.paidAt).toLocaleDateString("en-UG")}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={repayOpen} onOpenChange={setRepayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Repay via Mobile Money</DialogTitle>
            <DialogDescription>
              Outstanding balance: {formatUGX(totalPayable)}. You&apos;ll get a prompt on your phone to
              approve the payment.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((values) => repayMutation.mutate(values))} className="space-y-5">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Amount</FormLabel>
                    <FormControl>
                      <CurrencyInput value={field.value} onChange={(v) => field.onChange(v ?? 0)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Mobile Money number</FormLabel>
                    <FormControl>
                      <PhoneInput value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="network"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Network</FormLabel>
                    <FormControl>
                      <NetworkToggle
                        value={field.value}
                        onChange={(v) => {
                          networkTouchedRef.current = true
                          field.onChange(v)
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setRepayOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={repayMutation.isPending}>
                  Pay now
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
