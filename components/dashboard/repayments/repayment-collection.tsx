"use client"

import * as React from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Download, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CurrencyInput } from "@/components/ui/currency-input"
import { PhoneInput } from "@/components/ui/phone-input"
import { NetworkToggle } from "@/components/ui/mobile-money-badges"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { SearchableSelect } from "@/components/searchable-select"
import { EmptyState } from "@/components/dashboard/empty-state"
import { useLoanOptions } from "@/hooks/use-loan-options"
import { createRepaymentSchema, type CreateRepaymentInput } from "@/lib/schemas/repayment"
import { formatUGX, detectMobileMoneyNetwork } from "@/lib/utils"
import type { LoanDisplayStatus } from "@/lib/loan-status"

type LoanSummary = {
  id: string
  principal: number
  member: { firstName: string; lastName: string; memberNumber: string }
  branch: { name: string }
  displayStatus: LoanDisplayStatus
}

export function RepaymentCollection() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedLoanId, setSelectedLoanId] = React.useState(searchParams.get("loanId") ?? "")
  const [receipt, setReceipt] = React.useState<{
    receiptNumber: string
    amountPaid: number
    principalPortion: number
    interestPortion: number
    penaltyPortion: number
    method: string
    paidAt: string
    collector: { name: string }
    outstandingBalance: number
  } | null>(null)
  const { options: loanOptions } = useLoanOptions()
  const queryClient = useQueryClient()

  const { data: loan, isLoading } = useQuery({
    queryKey: ["loan", selectedLoanId],
    queryFn: async () => {
      const res = await fetch(`/api/loans/${selectedLoanId}`)
      if (!res.ok) throw new Error("Failed to load loan")
      return res.json() as Promise<LoanSummary>
    },
    enabled: !!selectedLoanId,
  })

  const form = useForm<CreateRepaymentInput>({
    resolver: zodResolver(createRepaymentSchema),
    defaultValues: { loanId: selectedLoanId, amountPaid: 0, method: "Cash", phone: "", network: undefined, transactionId: "" },
  })

  React.useEffect(() => {
    form.setValue("loanId", selectedLoanId)
  }, [selectedLoanId, form])

  const method = form.watch("method")
  const amountPaid = form.watch("amountPaid")
  const repaymentPhoneValue = form.watch("phone")

  // Pre-selects MTN/Airtel from the number's prefix as a convenience — never
  // trusted outright (see detectMobileMoneyNetwork), so it stops overriding
  // the moment staff touch the toggle themselves.
  const networkTouchedRef = React.useRef(false)
  React.useEffect(() => {
    if (method !== "MobileMoney" || networkTouchedRef.current) return
    const detected = detectMobileMoneyNetwork(repaymentPhoneValue)
    if (detected) form.setValue("network", detected, { shouldValidate: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repaymentPhoneValue, method])

  const { data: feePolicy } = useQuery({
    queryKey: ["repayment-fee-policy"],
    queryFn: async () => {
      const res = await fetch("/api/settings/repayment-fee-policy")
      if (!res.ok) throw new Error("Failed to load fee policy")
      return res.json() as Promise<{ mobileMoneyRepaymentFeePercent: number }>
    },
    staleTime: 5 * 60_000,
    enabled: method === "MobileMoney",
  })
  const feePercent = feePolicy?.mobileMoneyRepaymentFeePercent ?? 20
  const collectionFeeAmount = Math.round((amountPaid || 0) * (feePercent / 100))
  const amountToCharge = (amountPaid || 0) + collectionFeeAmount

  const mutation = useMutation({
    mutationFn: async (values: CreateRepaymentInput) => {
      const res = await fetch("/api/repayments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.formErrors?.[0] ?? body.error ?? "Failed to record repayment")
      }
      return res.json()
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["loan", selectedLoanId] })
      networkTouchedRef.current = false
      if (result.status === "pending") {
        toast.success(result.message ?? "Mobile Money collection initiated — awaiting confirmation")
        form.reset({ loanId: selectedLoanId, amountPaid: 0, method: "Cash", phone: "", network: undefined, transactionId: "" })
      } else {
        toast.success(result.message ?? "Repayment recorded")
        setReceipt({ ...result.repayment, outstandingBalance: result.outstandingBalance });
        form.reset({ loanId: selectedLoanId, amountPaid: 0, method: "Cash", phone: "", network: undefined, transactionId: "" })
      }
    },
    onError: (err: Error) => toast.error(err.message),
  })

  async function downloadReceipt() {
    if (!receipt || !loan) return
    const [{ pdf }, { ReceiptPDF }] = await Promise.all([
      import("@react-pdf/renderer"),
      import("@/components/pdf/receipt-pdf"),
    ])
    const blob = await pdf(
      <ReceiptPDF
        branchName={loan.branch.name}
        receiptNumber={receipt.receiptNumber}
        memberName={`${loan.member.firstName} ${loan.member.lastName}`}
        memberNumber={loan.member.memberNumber}
        amountPaid={receipt.amountPaid}
        principalPortion={receipt.principalPortion}
        interestPortion={receipt.interestPortion}
        penaltyPortion={receipt.penaltyPortion}
        method={receipt.method}
        collectorName={receipt.collector.name}
        paidAt={receipt.paidAt}
        outstandingBalance={receipt.outstandingBalance}
      />
    ).toBlob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `receipt-${receipt.receiptNumber}.pdf`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="rounded-lg border border-(--border-subtle) bg-(--bg-card) p-6">
        <label className="mb-2 block text-[13px] font-medium text-(--text-secondary)">Select loan</label>
        <SearchableSelect
          options={loanOptions}
          value={selectedLoanId}
          onChange={(id) => {
            setSelectedLoanId(id)
            setReceipt(null)
            router.replace(`/dashboard/repayments?loanId=${id}`)
          }}
          placeholder="Search by member name"
        />
      </div>

      {selectedLoanId && isLoading ? <div className="h-48 animate-pulse rounded-lg bg-(--bg-card)" /> : null}

      {selectedLoanId && loan ? (
        <>
          <div className="flex items-center justify-between rounded-lg border border-(--border-subtle) bg-(--bg-card) p-5">
            <div>
              <p className="font-medium text-(--text-primary)">
                {loan.member.firstName} {loan.member.lastName}
              </p>
              <p className="text-sm text-(--text-secondary)">{loan.member.memberNumber} · {loan.branch.name}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-(--text-secondary)">Outstanding</p>
              <p className="font-mono text-lg font-bold tabular-nums text-(--text-primary)">
                {formatUGX(loan.displayStatus.outstandingBalance)}
              </p>
            </div>
          </div>

          {receipt ? (
            <div className="space-y-4 rounded-lg border border-(--success-border) bg-(--success-soft) p-6 text-center">
              <p className="text-sm font-medium text-(--success-600)">
                Payment of {formatUGX(receipt.amountPaid)} recorded successfully.
              </p>
              <Button variant="outline" onClick={downloadReceipt} className="gap-1.5">
                <Download className="size-4" />
                Download receipt
              </Button>
            </div>
          ) : (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
                className="space-y-5 rounded-lg border border-(--border-subtle) bg-(--bg-card) p-6"
              >
                <FormField
                  control={form.control}
                  name="amountPaid"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount</FormLabel>
                      <FormControl>
                        <CurrencyInput value={field.value} onChange={(v) => field.onChange(v ?? 0)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment method</FormLabel>
                      <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                        <FormControl>
                          <SelectTrigger className="h-[42px] w-full rounded-sm border-(--border-subtle) px-3.5">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Cash">Cash</SelectItem>
                          <SelectItem value="Bank">Bank</SelectItem>
                          <SelectItem value="MobileMoney">Mobile Money</SelectItem>
                          <SelectItem value="Cheque">Cheque</SelectItem>
                          <SelectItem value="Online">Online</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {method === "MobileMoney" ? (
                  <>
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone number</FormLabel>
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
                          <FormLabel>Network</FormLabel>
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
                    {amountPaid > 0 ? (
                      <div className="rounded-lg border border-(--border-subtle) bg-(--bg-card-hover) p-3 text-sm">
                        <div className="flex justify-between text-(--text-secondary)">
                          <span>Repayment</span>
                          <span className="font-mono tabular-nums">{formatUGX(amountPaid)}</span>
                        </div>
                        <div className="flex justify-between text-(--text-secondary)">
                          <span>Mobile Money fee ({feePercent}%)</span>
                          <span className="font-mono tabular-nums">{formatUGX(collectionFeeAmount)}</span>
                        </div>
                        <div className="mt-1 flex justify-between border-t border-(--border-subtle) pt-1 font-medium text-(--text-primary)">
                          <span>Prompt total</span>
                          <span className="font-mono tabular-nums">{formatUGX(amountToCharge)}</span>
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : null}
                <Button type="submit" className="w-full" loading={mutation.isPending}>
                  {method === "MobileMoney" ? "Send Mobile Money prompt" : "Collect payment"}
                </Button>
              </form>
            </Form>
          )}
        </>
      ) : null}

      {!selectedLoanId ? (
        <EmptyState icon={Wallet} title="Select a loan" description="Search for a member above to collect a repayment." />
      ) : null}
    </div>
  )
}
