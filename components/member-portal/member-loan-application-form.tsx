"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Trash2, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { CurrencyInput } from "@/components/ui/currency-input"
import { DatePicker } from "@/components/ui/date-picker"
import { PhotoCapture } from "@/components/ui/photo-capture"
import { FileUploadField } from "@/components/dashboard/file-upload-field"
import { SearchableSelect, type SearchableSelectOption } from "@/components/searchable-select"
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
import { memberLoanApplicationSchema, type MemberLoanApplicationInput } from "@/lib/schemas/member-loan-application"
import { formatUGX } from "@/lib/utils"

type LoanProduct = {
  id: string
  name: string
  interestRate: number
  interestMethod: string
  minAmount: number
  maxAmount: number
  repaymentPeriodMonths: number
}

function useLoanProductOptions() {
  const { data } = useQuery({
    queryKey: ["member-loan-products"],
    queryFn: async () => {
      const res = await fetch("/api/member-portal/loan-products")
      if (!res.ok) throw new Error("Failed to load loan products")
      return res.json() as Promise<{ data: LoanProduct[] }>
    },
    staleTime: 60_000,
  })
  const products = data?.data ?? []
  const options: SearchableSelectOption[] = products.map((p) => ({
    value: p.id,
    label: p.name,
    description: `${p.interestRate}% · up to ${formatUGX(p.maxAmount)}`,
  }))
  return { products, options }
}

function useMemberSearch(query: string) {
  const { data } = useQuery({
    queryKey: ["member-portal-member-search", query],
    queryFn: async () => {
      const url = new URL("/api/member-portal/members-search", window.location.origin)
      url.searchParams.set("search", query)
      const res = await fetch(url)
      if (!res.ok) throw new Error("Search failed")
      return res.json() as Promise<{ data: { id: string; firstName: string; lastName: string; memberNumber: string }[] }>
    },
    enabled: query.length >= 2,
  })
  return data?.data ?? []
}

export function MemberLoanApplicationForm() {
  const router = useRouter()
  const [success, setSuccess] = React.useState<{ id: string; status: string } | null>(null)
  const [guarantorQuery, setGuarantorQuery] = React.useState("")
  const { products, options: productOptions } = useLoanProductOptions()
  const guarantorResults = useMemberSearch(guarantorQuery)
  const [guarantorNames, setGuarantorNames] = React.useState<Record<string, string>>({})

  const { data: dashboard } = useQuery({
    queryKey: ["member-dashboard-summary"],
    queryFn: async () => {
      const res = await fetch("/api/member-portal/dashboard-summary")
      if (!res.ok) throw new Error("Failed to load")
      return res.json() as Promise<{
        totalSavingsBalance: number
        savingsToLoanRatio: number
        minimumSavingsForLoanUgx: number
      }>
    },
    staleTime: 30_000,
  })
  // SuperAdmin-configurable (Settings page) — these fallbacks only matter
  // for the brief window before the query resolves.
  const savingsToLoanRatio = dashboard?.savingsToLoanRatio ?? 0.1
  const minimumSavingsForLoan = dashboard?.minimumSavingsForLoanUgx ?? 30000

  const form = useForm<MemberLoanApplicationInput>({
    resolver: zodResolver(memberLoanApplicationSchema),
    defaultValues: {
      loanProductId: "",
      amount: 0,
      purpose: "",
      repaymentPeriodMonths: 6,
      guarantors: [],
      collateral: [],
      supportingDocumentUrls: [],
      idType: "NationalId",
      idNumber: "",
      idIssueDate: "",
      idExpiryDate: "",
      applicantPhotoUrl: "",
      dependents: 0,
      businessName: "",
      businessAddress: "",
      businessLocation: "",
      businessPhone: "",
      employerName: "",
      position: "",
      employerPhone: "",
      netMonthlyIncome: undefined,
      businessMonthlyIncome: undefined,
    },
  })

  const guarantorFields = useFieldArray({ control: form.control, name: "guarantors" })

  const values = form.watch()
  const selectedProduct = products.find((p) => p.id === values.loanProductId)
  const requiredSavings = Math.max(Math.round((values.amount || 0) * savingsToLoanRatio), minimumSavingsForLoan)
  const savingsOk = (dashboard?.totalSavingsBalance ?? 0) >= requiredSavings

  const mutation = useMutation({
    mutationFn: async (input: MemberLoanApplicationInput) => {
      const res = await fetch("/api/member-portal/loan-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.formErrors?.[0] ?? body.error?.fieldErrors?.employerName?.[0] ?? body.error ?? "Failed to submit application")
      }
      return res.json()
    },
    onSuccess: (result) => {
      setSuccess({ id: result.application.id, status: result.application.status })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (success) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-(--border-subtle) bg-(--bg-card) p-8 text-center">
        <CheckCircle2 className="mx-auto size-12 text-(--success-600)" strokeWidth={1.5} />
        <h2 className="mt-4 text-[18px] font-semibold text-(--text-primary)">Application submitted</h2>
        <p className="mt-2 text-sm text-(--text-secondary)">
          Your application is now with a Loan Officer for review, then a Manager for final approval.
          You&apos;ll be able to track its progress from your loans page.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="outline" onClick={() => router.push("/member-portal/dashboard/loans")}>
            View my loans
          </Button>
          <Button onClick={() => router.push("/member-portal/dashboard")}>Back to overview</Button>
        </div>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="max-w-3xl space-y-6">
        <div className="rounded-lg border border-(--border-subtle) bg-(--bg-card) p-6">
          <h3 className="mb-4 text-[15px] font-semibold text-(--text-primary)">Loan details</h3>
          <div className="space-y-5">
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
                      onChange={(v) => {
                        field.onChange(v)
                        const p = products.find((pr) => pr.id === v)
                        if (p) form.setValue("repaymentPeriodMonths", p.repaymentPeriodMonths)
                      }}
                      placeholder="Select a loan product"
                    />
                  </FormControl>
                  {selectedProduct ? (
                    <p className="text-xs text-(--text-secondary)">
                      {selectedProduct.interestRate}% per month ({selectedProduct.interestMethod}) · amount range{" "}
                      {formatUGX(selectedProduct.minAmount)}–{formatUGX(selectedProduct.maxAmount)}
                    </p>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Amount requested</FormLabel>
                  <FormControl>
                    <CurrencyInput value={field.value} onChange={(v) => field.onChange(v ?? 0)} />
                  </FormControl>
                  <p className="text-xs text-(--text-secondary)">
                    Needs savings of at least {formatUGX(requiredSavings)} (
                    {requiredSavings === minimumSavingsForLoan
                      ? "minimum required to qualify for any loan"
                      : `${savingsToLoanRatio * 100}% of amount`}
                    ) — your current savings: {formatUGX(dashboard?.totalSavingsBalance ?? 0)}{" "}
                    {values.amount > 0 ? (savingsOk ? "✓" : "— below required") : ""}
                  </p>
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
                    <Input type="number" min={1} {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
        </div>

        <div className="rounded-lg border border-(--border-subtle) bg-(--bg-card) p-6">
          <h3 className="mb-4 text-[15px] font-semibold text-(--text-primary)">Identity</h3>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="idType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>ID type</FormLabel>
                  <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                    <FormControl>
                      <SelectTrigger className="h-[42px] w-full rounded-sm border-(--border-subtle) px-3.5">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="NationalId">National ID</SelectItem>
                      <SelectItem value="Passport">Passport</SelectItem>
                      <SelectItem value="VotersId">Voter&apos;s ID</SelectItem>
                      <SelectItem value="DriversLicense">Driver&apos;s License</SelectItem>
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
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="idIssueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Issue date (optional)</FormLabel>
                  <FormControl>
                    <DatePicker value={field.value ? new Date(field.value) : undefined} onChange={(d) => field.onChange(d ? d.toISOString() : "")} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dependents"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Number of dependents</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="mt-5">
            <FormField
              control={form.control}
              name="applicantPhotoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Your photo</FormLabel>
                  <FormControl>
                    <PhotoCapture value={field.value || undefined} onChange={(url) => field.onChange(url ?? "")} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="rounded-lg border border-(--border-subtle) bg-(--bg-card) p-6">
          <h3 className="mb-1 text-[15px] font-semibold text-(--text-primary)">Income</h3>
          <p className="mb-4 text-xs text-(--text-secondary)">
            <span className="font-semibold text-(--error-600)">* Required —</span> fill in business
            details, employment details, or both, with at least one monthly income figure so we can
            run the affordability check.
          </p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="businessName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="businessMonthlyIncome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business monthly income</FormLabel>
                  <FormControl>
                    <CurrencyInput value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="employerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employer name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="netMonthlyIncome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Net monthly salary</FormLabel>
                  <FormControl>
                    <CurrencyInput value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="rounded-lg border border-(--border-subtle) bg-(--bg-card) p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[15px] font-semibold text-(--text-primary)">Guarantors (optional)</h3>
          </div>
          <div className="space-y-3">
            {guarantorFields.fields.map((f, i) => (
              <div key={f.id} className="flex items-center gap-3 rounded-md border border-(--border-subtle) p-3">
                <span className="flex-1 text-sm text-(--text-primary)">
                  {guarantorNames[form.getValues(`guarantors.${i}.memberId`)] ?? "Member"}
                </span>
                <div className="w-40">
                  <FormField
                    control={form.control}
                    name={`guarantors.${i}.guaranteeAmount`}
                    render={({ field }) => (
                      <CurrencyInput value={field.value} onChange={(v) => field.onChange(v ?? 0)} />
                    )}
                  />
                </div>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => guarantorFields.remove(i)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Input
              placeholder="Search a member by name or number to add as guarantor..."
              value={guarantorQuery}
              onChange={(e) => setGuarantorQuery(e.target.value)}
            />
            {guarantorQuery.length >= 2 && guarantorResults.length > 0 ? (
              <div className="mt-2 divide-y divide-(--border-subtle) rounded-md border border-(--border-subtle)">
                {guarantorResults.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="flex w-full items-center justify-between p-2.5 text-left text-sm hover:bg-(--bg-card-hover)"
                    onClick={() => {
                      guarantorFields.append({ memberId: m.id, guaranteeAmount: 0 })
                      setGuarantorNames((prev) => ({ ...prev, [m.id]: `${m.firstName} ${m.lastName} (${m.memberNumber})` }))
                      setGuarantorQuery("")
                    }}
                  >
                    <span>{m.firstName} {m.lastName}</span>
                    <span className="text-xs text-(--text-secondary)">{m.memberNumber}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border border-(--border-subtle) bg-(--bg-card) p-6">
          <h3 className="mb-4 text-[15px] font-semibold text-(--text-primary)">Supporting documents (optional)</h3>
          <FileUploadField
            label="Attach a document"
            value={undefined}
            onChange={(url) => {
              if (url) form.setValue("supportingDocumentUrls", [...values.supportingDocumentUrls, url])
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

        <Button type="submit" size="lg" loading={mutation.isPending} className="w-full">
          Submit application
        </Button>
      </form>
    </Form>
  )
}
