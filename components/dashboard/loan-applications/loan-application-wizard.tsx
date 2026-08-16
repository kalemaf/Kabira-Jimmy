"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { Plus, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { CurrencyInput } from "@/components/ui/currency-input"
import { PhoneInput } from "@/components/ui/phone-input"
import { DatePicker } from "@/components/ui/date-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { SignaturePad } from "@/components/ui/signature-pad"
import { PhotoCapture } from "@/components/ui/photo-capture"
import { SearchableSelect } from "@/components/searchable-select"
import { Stepper } from "@/components/dashboard/stepper"
import { FileUploadField } from "@/components/dashboard/file-upload-field"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { useMemberOptions } from "@/hooks/use-member-options"
import { useLoanProductOptions } from "@/hooks/use-loan-product-options"
import { createLoanApplicationSchema, type CreateLoanApplicationInput } from "@/lib/schemas/loan-application"
import { generateAmortizationSchedule, type InterestMethod } from "@/lib/loan-calculator"
import { formatUGX } from "@/lib/utils"

const STEPS = [
  { label: "Loan details" },
  { label: "Applicant profile" },
  { label: "Guarantors" },
  { label: "Collateral & documents" },
  { label: "Review" },
]

const ID_TYPE_LABELS: Record<string, string> = {
  NationalId: "National ID",
  Passport: "Passport",
  VotersId: "Voter's ID",
  DriversLicense: "Driver's License",
}

export function LoanApplicationWizard() {
  const router = useRouter()
  const [step, setStep] = React.useState(1)
  const { options: memberOptions } = useMemberOptions()
  const { options: productOptions, products } = useLoanProductOptions()

  const { data: eligibilityPolicy } = useQuery({
    queryKey: ["eligibility-policy"],
    queryFn: async () => {
      const res = await fetch("/api/settings/eligibility-policy")
      if (!res.ok) throw new Error("Failed to load eligibility policy")
      return res.json() as Promise<{ maxDebtToIncomeRatio: number }>
    },
    staleTime: 5 * 60_000,
  })
  // SuperAdmin-configurable (Settings page) — this fallback only matters
  // for the brief window before the query resolves.
  const MAX_DEBT_TO_INCOME_RATIO = eligibilityPolicy?.maxDebtToIncomeRatio ?? 0.3

  const form = useForm<CreateLoanApplicationInput>({
    resolver: zodResolver(createLoanApplicationSchema),
    defaultValues: {
      memberId: "",
      loanProductId: "",
      amount: 0,
      purpose: "",
      repaymentPeriodMonths: 12,
      guarantors: [],
      collateral: [],
      supportingDocumentUrls: [],
      idType: "NationalId",
      idNumber: "",
      idIssueDate: "",
      idExpiryDate: "",
      applicantPhotoUrl: "",
      dependents: 0,
      ninVerificationStatus: "NotChecked",
      ninVerificationDetail: "",
      ninVerifiedAt: "",
      businessName: "",
      businessAddress: "",
      businessLocation: "",
      businessPhone: "",
      employerName: "",
      position: "",
      employerPhone: "",
      officerVerifiedBusinessLetter: false,
      officerVerifiedPayslip: false,
      officerSignatureData: "",
    },
  })

  const guarantorFields = useFieldArray({ control: form.control, name: "guarantors" })
  const collateralFields = useFieldArray({ control: form.control, name: "collateral" })

  const ninMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/nin-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: form.getValues("memberId"), nin: form.getValues("idNumber") }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.formErrors?.[0] ?? body.error ?? "NIN verification failed")
      }
      return res.json() as Promise<{ status: "Matched" | "Mismatch" | "Unavailable"; detail: string }>
    },
    onSuccess: (result) => {
      form.setValue("ninVerificationStatus", result.status)
      form.setValue("ninVerificationDetail", result.detail)
      form.setValue("ninVerifiedAt", new Date().toISOString())
      if (result.status === "Matched") toast.success(result.detail)
      else if (result.status === "Mismatch") toast.error(result.detail)
      else toast.warning(result.detail)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const selectedProductId = form.watch("loanProductId")
  const selectedProduct = products.find((p) => p.id === selectedProductId)

  React.useEffect(() => {
    if (selectedProduct) {
      form.setValue("repaymentPeriodMonths", selectedProduct.repaymentPeriodMonths)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProductId])

  const mutation = useMutation({
    mutationFn: async (values: CreateLoanApplicationInput) => {
      const res = await fetch("/api/loan-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.formErrors?.[0] ?? body.error ?? "Failed to submit application")
      }
      return res.json() as Promise<{ application: { id: string }; eligibility: { eligible: boolean; riskScore: number } }>
    },
    onSuccess: (result) => {
      toast.success(
        result.eligibility.eligible
          ? `Application submitted — risk score ${result.eligibility.riskScore}/100`
          : `Application submitted with flags — risk score ${result.eligibility.riskScore}/100`
      )
      router.push(`/dashboard/loans/applications/${result.application.id}`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  async function goNext() {
    const fieldsByStep: Record<number, (keyof CreateLoanApplicationInput)[]> = {
      1: ["memberId", "loanProductId", "amount", "purpose", "repaymentPeriodMonths"],
      2: [
        "idType",
        "idNumber",
        "idIssueDate",
        "idExpiryDate",
        "applicantPhotoUrl",
        "dependents",
        "businessName",
        "employerName",
        "officerVerifiedBusinessLetter",
        "officerVerifiedPayslip",
        "officerSignatureData",
      ],
      3: ["guarantors"],
      4: ["collateral", "supportingDocumentUrls"],
    }
    const valid = await form.trigger(fieldsByStep[step] ?? [])
    if (!valid) return
    if (step === 2 && affordability && !affordability.passes) {
      toast.error(
        `Installment (${formatUGX(affordability.projectedInstallment)}) exceeds ${MAX_DEBT_TO_INCOME_RATIO * 100}% of declared income (max ${formatUGX(affordability.maxAffordableInstallment)}). Reduce the amount, extend the term, or add income before continuing.`
      )
      return
    }
    setStep((s) => Math.min(s + 1, STEPS.length))
  }

  const values = form.watch()
  const selectedMember = memberOptions.find((m) => m.value === values.memberId)

  const monthlyIncome = (values.netMonthlyIncome ?? 0) + (values.businessMonthlyIncome ?? 0)
  const affordability = React.useMemo(() => {
    if (!selectedProduct || !values.amount || !values.repaymentPeriodMonths || monthlyIncome <= 0) return null
    const schedule = generateAmortizationSchedule({
      principal: values.amount,
      monthlyRatePercent: selectedProduct.interestRate,
      periodMonths: values.repaymentPeriodMonths,
      method: selectedProduct.interestMethod as InterestMethod,
    })
    const projectedInstallment = schedule.monthlyInstallment ?? schedule.rows[0]?.installment ?? 0
    const maxAffordableInstallment = Math.round(monthlyIncome * MAX_DEBT_TO_INCOME_RATIO)
    return {
      monthlyIncome,
      maxAffordableInstallment,
      projectedInstallment,
      passes: projectedInstallment <= maxAffordableInstallment,
    }
  }, [selectedProduct, values.amount, values.repaymentPeriodMonths, monthlyIncome])

  return (
    <div className="max-w-3xl space-y-6">
      <Stepper steps={STEPS} currentStep={step} />

      <Form {...form}>
        <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
          {step === 1 ? (
            <div className="space-y-5 rounded-lg border border-(--border-subtle) bg-(--bg-card) p-6">
              <FormField
                control={form.control}
                name="memberId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Member</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={memberOptions}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select member"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="loanProductId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Loan product</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={productOptions}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select loan product"
                      />
                    </FormControl>
                    {selectedProduct ? (
                      <p className="text-xs text-(--text-secondary)">
                        Range {formatUGX(selectedProduct.minAmount)} – {formatUGX(selectedProduct.maxAmount)},{" "}
                        {selectedProduct.interestRate}%/mo {selectedProduct.interestMethod}
                      </p>
                    ) : null}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required>Amount requested</FormLabel>
                      <FormControl>
                        <CurrencyInput value={field.value} onChange={(v) => field.onChange(v ?? 0)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="repaymentPeriodMonths"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required>Repayment period (months)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="purpose"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Purpose</FormLabel>
                    <FormControl>
                      <Textarea placeholder="What is this loan for?" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-6">
              <div className="space-y-5 rounded-lg border border-(--border-subtle) bg-(--bg-card) p-6">
                <div>
                  <h3 className="text-[15px] font-semibold text-(--text-primary)">Identity</h3>
                  <p className="text-sm text-(--text-secondary)">Used for KYC verification — required for every application.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="idType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel required>ID type</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="h-[42px] w-full rounded-sm border-(--border-subtle) px-3.5">
                              <SelectValue placeholder="Select ID type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(ID_TYPE_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="idNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel required>ID number</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. CM12345678ABCD" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {values.idType === "NationalId" ? (
                  <div className="rounded-sm border border-(--border-subtle) bg-(--bg-input) p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-(--text-primary)">Government NIN verification</p>
                        <p className="text-xs text-(--text-secondary)">
                          Checks the name on record against Uganda&apos;s National ID register (NIRA) for this NIN.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!values.memberId || !values.idNumber}
                        loading={ninMutation.isPending}
                        onClick={() => ninMutation.mutate()}
                      >
                        Verify with NIRA
                      </Button>
                    </div>
                    {values.ninVerificationStatus && values.ninVerificationStatus !== "NotChecked" ? (
                      <p
                        className={`mt-3 text-sm font-medium ${
                          values.ninVerificationStatus === "Matched"
                            ? "text-(--success-600)"
                            : values.ninVerificationStatus === "Mismatch"
                              ? "text-(--error-600)"
                              : "text-(--warning-600)"
                        }`}
                      >
                        {values.ninVerificationStatus === "Matched" ? "✓ " : values.ninVerificationStatus === "Mismatch" ? "✗ " : "⚠ "}
                        {values.ninVerificationDetail}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="idIssueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of issue</FormLabel>
                        <FormControl>
                          <DatePicker
                            value={field.value ? new Date(field.value) : undefined}
                            onChange={(d) => field.onChange(d ? d.toISOString() : "")}
                            placeholder="Select date"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="idExpiryDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expiry date</FormLabel>
                        <FormControl>
                          <DatePicker
                            value={field.value ? new Date(field.value) : undefined}
                            onChange={(d) => field.onChange(d ? d.toISOString() : "")}
                            placeholder="Select date"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="applicantPhotoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required>Applicant photo</FormLabel>
                      <FormControl>
                        <PhotoCapture value={field.value} onChange={(url) => field.onChange(url ?? "")} />
                      </FormControl>
                      <p className="text-xs text-(--text-secondary)">Take a live photo of the applicant, or upload one, for identity verification.</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dependents"
                  render={({ field }) => (
                    <FormItem className="max-w-xs">
                      <FormLabel required>Number of dependents</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-5 rounded-lg border border-(--border-subtle) bg-(--bg-card) p-6">
                <div>
                  <h3 className="text-[15px] font-semibold text-(--text-primary)">Business details</h3>
                  <p className="text-sm text-(--text-secondary)">Fill this in if the applicant runs a business. Provide this or employment details below.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="businessName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Kampala Fresh Produce" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="businessPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business phone</FormLabel>
                        <FormControl>
                          <PhoneInput value={field.value} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="businessAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business address</FormLabel>
                        <FormControl>
                          <Input placeholder="Street / plot address" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="businessLocation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business location</FormLabel>
                        <FormControl>
                          <Input placeholder="District / trading centre" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="yearsInBusiness"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Years in business</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.valueAsNumber || undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="businessCapital"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total business capital</FormLabel>
                        <FormControl>
                          <CurrencyInput value={field.value} onChange={(v) => field.onChange(v ?? undefined)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="businessMonthlyIncome"
                  render={({ field }) => (
                    <FormItem className="max-w-xs">
                      <FormLabel>Net monthly business income</FormLabel>
                      <FormControl>
                        <CurrencyInput value={field.value} onChange={(v) => field.onChange(v ?? undefined)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-5 rounded-lg border border-(--border-subtle) bg-(--bg-card) p-6">
                <div>
                  <h3 className="text-[15px] font-semibold text-(--text-primary)">Employment details</h3>
                  <p className="text-sm text-(--text-secondary)">Fill this in if the applicant is employed. Provide this or business details above.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="employerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employer name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Ministry of Health" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="position"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Position</FormLabel>
                        <FormControl>
                          <Input placeholder="Job title" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="employerPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employer phone</FormLabel>
                        <FormControl>
                          <PhoneInput value={field.value} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="yearsWithEmployer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Years with employer</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.valueAsNumber || undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="netMonthlyIncome"
                  render={({ field }) => (
                    <FormItem className="max-w-xs">
                      <FormLabel>Net monthly income</FormLabel>
                      <FormControl>
                        <CurrencyInput value={field.value} onChange={(v) => field.onChange(v ?? undefined)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-card)">
                <div className="border-b border-(--border-subtle) bg-(--bg-card-hover) px-5 py-3">
                  <h3 className="text-[13px] font-semibold text-(--text-primary)">Affordability check</h3>
                </div>
                {!monthlyIncome ? (
                  <p className="p-5 text-sm text-(--text-secondary)">
                    Enter a business or employment income above to calculate the maximum affordable loan.
                  </p>
                ) : !affordability ? (
                  <p className="p-5 text-sm text-(--text-secondary)">
                    Select a loan product and enter an amount in step 1 to see the projected installment.
                  </p>
                ) : (
                  <div className="p-5">
                    <table className="w-full text-sm">
                      <tbody>
                        <tr className="border-b border-(--border-subtle)">
                          <td className="py-2 text-(--text-secondary)">Declared monthly income</td>
                          <td className="py-2 text-right font-mono tabular-nums text-(--text-primary)">{formatUGX(affordability.monthlyIncome)}</td>
                        </tr>
                        <tr className="border-b border-(--border-subtle)">
                          <td className="py-2 text-(--text-secondary)">Max affordable installment ({MAX_DEBT_TO_INCOME_RATIO * 100}% of income)</td>
                          <td className="py-2 text-right font-mono tabular-nums text-(--text-primary)">{formatUGX(affordability.maxAffordableInstallment)}</td>
                        </tr>
                        <tr>
                          <td className="py-2 font-medium text-(--text-secondary)">Projected installment for this loan</td>
                          <td className={`py-2 text-right font-mono font-semibold tabular-nums ${affordability.passes ? "text-(--success-600)" : "text-(--error-600)"}`}>
                            {formatUGX(affordability.projectedInstallment)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <p className={`mt-3 text-sm font-medium ${affordability.passes ? "text-(--success-600)" : "text-(--error-600)"}`}>
                      {affordability.passes
                        ? "Within the 30% affordability limit."
                        : `Exceeds the ${MAX_DEBT_TO_INCOME_RATIO * 100}% affordability limit — reduce the amount, extend the term, or add income before continuing.`}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-5 rounded-lg border border-(--border-subtle) bg-(--bg-card) p-6">
                <div>
                  <h3 className="text-[15px] font-semibold text-(--text-primary)">Officer verification &amp; sign-off</h3>
                  <p className="text-sm text-(--text-secondary)">
                    Confirm you&apos;ve physically or digitally reviewed the applicant&apos;s income evidence, then sign to attest this application is accurate.
                  </p>
                </div>
                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="officerVerifiedBusinessLetter"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center gap-2.5 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="!m-0 font-normal">I have seen the applicant&apos;s business letter</FormLabel>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="officerVerifiedPayslip"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center gap-2.5 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="!m-0 font-normal">I have seen the applicant&apos;s payslip for the current month</FormLabel>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="officerSignatureData"
                  render={({ field }) => (
                    <FormItem className="max-w-md">
                      <FormLabel required>Officer signature</FormLabel>
                      <FormControl>
                        <SignaturePad value={field.value} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4 rounded-lg border border-(--border-subtle) bg-(--bg-card) p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[15px] font-semibold text-(--text-primary)">Guarantors</h3>
                  <p className="text-sm text-(--text-secondary)">Optional, but recommended for larger loans.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => guarantorFields.append({ memberId: "", guaranteeAmount: 0 })}
                >
                  <Plus className="size-4" />
                  Add guarantor
                </Button>
              </div>
              {guarantorFields.fields.length === 0 ? (
                <p className="text-sm text-(--text-secondary)">No guarantors added yet.</p>
              ) : null}
              {guarantorFields.fields.map((field, index) => (
                <div key={field.id} className="flex items-end gap-3 rounded-sm border border-(--border-subtle) p-4">
                  <FormField
                    control={form.control}
                    name={`guarantors.${index}.memberId`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel required>Guarantor</FormLabel>
                        <FormControl>
                          <SearchableSelect
                            options={memberOptions.filter((m) => m.value !== values.memberId)}
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Select member"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`guarantors.${index}.guaranteeAmount`}
                    render={({ field }) => (
                      <FormItem className="w-48">
                        <FormLabel required>Amount</FormLabel>
                        <FormControl>
                          <CurrencyInput value={field.value} onChange={(v) => field.onChange(v ?? 0)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => guarantorFields.remove(index)}
                    aria-label="Remove guarantor"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-6">
              <div className="space-y-4 rounded-lg border border-(--border-subtle) bg-(--bg-card) p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-[15px] font-semibold text-(--text-primary)">Collateral</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => collateralFields.append({ description: "", estimatedValue: 0, documentUrl: "" })}
                  >
                    <Plus className="size-4" />
                    Add collateral
                  </Button>
                </div>
                {collateralFields.fields.length === 0 ? (
                  <p className="text-sm text-(--text-secondary)">No collateral added.</p>
                ) : null}
                {collateralFields.fields.map((field, index) => (
                  <div key={field.id} className="flex items-end gap-3 rounded-sm border border-(--border-subtle) p-4">
                    <FormField
                      control={form.control}
                      name={`collateral.${index}.description`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel required>Description</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Motorcycle logbook" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`collateral.${index}.estimatedValue`}
                      render={({ field }) => (
                        <FormItem className="w-48">
                          <FormLabel required>Estimated value</FormLabel>
                          <FormControl>
                            <CurrencyInput value={field.value} onChange={(v) => field.onChange(v ?? 0)} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => collateralFields.remove(index)}
                      aria-label="Remove collateral"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-(--border-subtle) bg-(--bg-card) p-6">
                <h3 className="mb-4 text-[15px] font-semibold text-(--text-primary)">Supporting documents</h3>
                <FileUploadField
                  label="Attach a document (optional)"
                  value={undefined}
                  onChange={(url) => {
                    if (url) {
                      form.setValue("supportingDocumentUrls", [...values.supportingDocumentUrls, url])
                    }
                  }}
                />
                {values.supportingDocumentUrls.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-sm text-(--text-secondary)">
                    {values.supportingDocumentUrls.map((url, i) => (
                      <li key={url} className="flex items-center justify-between">
                        <span>Document {i + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() =>
                            form.setValue(
                              "supportingDocumentUrls",
                              values.supportingDocumentUrls.filter((_, idx) => idx !== i)
                            )
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          ) : null}

          {step === 5 ? (
            <div className="space-y-4 rounded-lg border border-(--border-subtle) bg-(--bg-card) p-6">
              <h3 className="text-[15px] font-semibold text-(--text-primary)">Review</h3>
              {values.applicantPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={values.applicantPhotoUrl}
                  alt="Applicant"
                  className="size-20 rounded-md border border-(--border-subtle) object-cover"
                />
              ) : null}
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <span className="text-(--text-secondary)">Member</span>
                <span className="text-(--text-primary)">{selectedMember?.label ?? "—"}</span>
                <span className="text-(--text-secondary)">Loan product</span>
                <span className="text-(--text-primary)">{selectedProduct?.name ?? "—"}</span>
                <span className="text-(--text-secondary)">Amount</span>
                <span className="font-mono tabular-nums text-(--text-primary)">{formatUGX(values.amount)}</span>
                <span className="text-(--text-secondary)">Repayment period</span>
                <span className="text-(--text-primary)">{values.repaymentPeriodMonths} months</span>
                <span className="text-(--text-secondary)">ID</span>
                <span className="text-(--text-primary)">
                  {values.idType ? ID_TYPE_LABELS[values.idType] : "—"} {values.idNumber}
                </span>
                <span className="text-(--text-secondary)">Dependents</span>
                <span className="text-(--text-primary)">{values.dependents}</span>
                <span className="text-(--text-secondary)">Business</span>
                <span className="text-(--text-primary)">{values.businessName || "—"}</span>
                <span className="text-(--text-secondary)">Employer</span>
                <span className="text-(--text-primary)">{values.employerName || "—"}</span>
                <span className="text-(--text-secondary)">Guarantors</span>
                <span className="text-(--text-primary)">{values.guarantors.length}</span>
                <span className="text-(--text-secondary)">Collateral items</span>
                <span className="text-(--text-primary)">{values.collateral.length}</span>
                <span className="text-(--text-secondary)">Officer verified</span>
                <span className="text-(--text-primary)">
                  {[
                    values.officerVerifiedBusinessLetter && "Business letter",
                    values.officerVerifiedPayslip && "Payslip",
                  ]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </span>
                <span className="text-(--text-secondary)">Officer signature</span>
                <span className="text-(--text-primary)">{values.officerSignatureData ? "Signed" : "Not signed"}</span>
                <span className="text-(--text-secondary)">Affordability (30% rule)</span>
                <span className={affordability ? (affordability.passes ? "text-(--success-600)" : "text-(--error-600)") : "text-(--text-primary)"}>
                  {affordability ? (affordability.passes ? "Within limit" : "Exceeds limit") : "Not calculated"}
                </span>
                {values.idType === "NationalId" ? (
                  <>
                    <span className="text-(--text-secondary)">NIN verification</span>
                    <span
                      className={
                        values.ninVerificationStatus === "Matched"
                          ? "text-(--success-600)"
                          : values.ninVerificationStatus === "Mismatch"
                            ? "text-(--error-600)"
                            : "text-(--text-primary)"
                      }
                    >
                      {values.ninVerificationStatus && values.ninVerificationStatus !== "NotChecked" ? values.ninVerificationStatus : "Not checked"}
                    </span>
                  </>
                ) : null}
              </div>
              <p className="text-xs text-(--text-secondary)">
                Submitting runs an automatic eligibility check and sends this application to Secretary
                review — the first stage of the maker-checker approval chain.
              </p>
            </div>
          ) : null}

          <div className="mt-6 flex justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() => (step === 1 ? router.push("/dashboard/loans/applications") : setStep((s) => s - 1))}
            >
              {step === 1 ? "Cancel" : "Back"}
            </Button>
            {step < STEPS.length ? (
              <Button type="button" onClick={goNext}>
                Continue
              </Button>
            ) : (
              <Button type="submit" loading={mutation.isPending}>
                Submit application
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  )
}
