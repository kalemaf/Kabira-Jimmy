"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Switch } from "@/components/ui/switch"
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
  FormDescription,
} from "@/components/ui/form"
import { loanProductSchema, interestMethods, type LoanProductInput } from "@/lib/schemas/loan-product"

const INTEREST_METHOD_LABELS: Record<(typeof interestMethods)[number], string> = {
  Flat: "Flat rate",
  ReducingBalance: "Reducing balance",
  Declining: "Declining balance",
  Compound: "Compound",
  Custom: "Custom formula",
}

function PercentField({
  control,
  name,
  label,
  description,
}: {
  control: ReturnType<typeof useForm<LoanProductInput>>["control"]
  name: keyof LoanProductInput
  label: string
  description?: string
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <div className="relative">
              <Input
                type="number"
                step="0.1"
                min={0}
                max={100}
                className="pr-9"
                value={field.value as number}
                onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
              />
              <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-sm text-(--text-muted)">
                %
              </span>
            </div>
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

const DEFAULT_VALUES: LoanProductInput = {
  name: "",
  interestRate: 2,
  minAmount: 100_000,
  maxAmount: 5_000_000,
  repaymentPeriodMonths: 12,
  gracePeriodDays: 0,
  penaltyRate: 2,
  processingFee: 1,
  insuranceFee: 0.5,
  lateFee: 1,
  serviceCharge: 0.5,
  interestMethod: "ReducingBalance",
  isActive: true,
}

export function LoanProductForm({ productId }: { productId?: string }) {
  const router = useRouter()
  const isEdit = !!productId

  const { data: existing, isLoading: isLoadingExisting } = useQuery({
    queryKey: ["loan-product", productId],
    queryFn: async () => {
      const res = await fetch(`/api/loan-products/${productId}`)
      if (!res.ok) throw new Error("Failed to load loan product")
      return res.json() as Promise<LoanProductInput>
    },
    enabled: isEdit,
  })

  const form = useForm<LoanProductInput>({
    resolver: zodResolver(loanProductSchema),
    defaultValues: DEFAULT_VALUES,
  })

  React.useEffect(() => {
    if (existing) form.reset(existing)
  }, [existing, form])

  const mutation = useMutation({
    mutationFn: async (values: LoanProductInput) => {
      const res = await fetch(isEdit ? `/api/loan-products/${productId}` : "/api/loan-products", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.formErrors?.[0] ?? body.error ?? "Failed to save loan product")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success(isEdit ? "Loan product updated" : "Loan product created")
      router.push("/dashboard/loan-products")
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isEdit && isLoadingExisting) {
    return <div className="h-96 animate-pulse rounded-lg bg-(--bg-card)" />
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        className="max-w-2xl space-y-8"
      >
        <div className="space-y-5 rounded-lg border border-(--border-subtle) bg-(--bg-card) p-6">
          <h3 className="text-[15px] font-semibold text-(--text-primary)">Product details</h3>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Product name</FormLabel>
                <FormControl>
                  <Input placeholder="Business Loan" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="interestMethod"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Interest method</FormLabel>
                <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                  <FormControl>
                    <SelectTrigger className="h-[42px] w-full rounded-sm border-(--border-subtle) px-3.5">
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {interestMethods.map((m) => (
                      <SelectItem key={m} value={m}>
                        {INTEREST_METHOD_LABELS[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="minAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Minimum amount</FormLabel>
                  <FormControl>
                    <CurrencyInput value={field.value} onChange={(v) => field.onChange(v ?? 0)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="maxAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Maximum amount</FormLabel>
                  <FormControl>
                    <CurrencyInput value={field.value} onChange={(v) => field.onChange(v ?? 0)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="repaymentPeriodMonths"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Repayment period (months)</FormLabel>
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
            <FormField
              control={form.control}
              name="gracePeriodDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Grace period (days)</FormLabel>
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
        </div>

        <div className="space-y-5 rounded-lg border border-(--border-subtle) bg-(--bg-card) p-6">
          <h3 className="text-[15px] font-semibold text-(--text-primary)">Rates &amp; fees</h3>
          <div className="grid grid-cols-2 gap-4">
            <PercentField control={form.control} name="interestRate" label="Interest rate" />
            <PercentField control={form.control} name="penaltyRate" label="Penalty rate" />
            <PercentField control={form.control} name="processingFee" label="Processing fee" />
            <PercentField control={form.control} name="insuranceFee" label="Insurance fee" />
            <PercentField control={form.control} name="lateFee" label="Late fee" />
            <PercentField control={form.control} name="serviceCharge" label="Service charge" />
          </div>
          <p className="text-xs text-(--text-secondary)">
            Rates and fees are percentages of the principal amount.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-(--border-subtle) bg-(--bg-card) p-6">
          <div>
            <p className="text-sm font-medium text-(--text-primary)">Active</p>
            <p className="text-xs text-(--text-secondary)">
              Inactive products are hidden from new loan applications.
            </p>
          </div>
          <FormField
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
        </div>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/dashboard/loan-products")}
          >
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            {isEdit ? "Save changes" : "Create product"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
