"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Smartphone, Landmark, PiggyBank, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CurrencyInput } from "@/components/ui/currency-input"
import { PhoneInput } from "@/components/ui/phone-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { EmptyState } from "@/components/dashboard/empty-state"
import { formatUGX } from "@/lib/utils"
import { memberDepositSchema, type MemberDepositInput } from "@/lib/schemas/member-savings"

type SavingsAccount = { id: string; accountNumber: string; type: "Daily" | "Fixed" | "Shares"; balance: number }
type Response = { data: SavingsAccount[] }

const CHANNELS = [
  {
    value: "MobileMoney" as const,
    label: "Mobile Money",
    description: "MTN or Airtel — you'll get a prompt on your phone to approve the payment.",
    icon: Smartphone,
  },
  {
    value: "BankTransfer" as const,
    label: "Bank Transfer",
    description: "Already transferred via bank? Record the reference and a staff member will confirm it.",
    icon: Landmark,
  },
]

export function MemberDepositClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedAccountId = searchParams.get("accountId") ?? ""
  const [channel, setChannel] = React.useState<"MobileMoney" | "BankTransfer">("MobileMoney")
  const [result, setResult] = React.useState<{ status: string; message: string } | null>(null)

  const { data: response, isLoading } = useQuery({
    queryKey: ["member-savings-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/member-portal/savings")
      if (!res.ok) throw new Error("Failed to load your savings accounts")
      const body = await res.json()
      return { data: body.data } as Response
    },
  })

  const accounts = response?.data ?? []

  const form = useForm<MemberDepositInput>({
    resolver: zodResolver(memberDepositSchema),
    defaultValues: {
      savingsAccountId: preselectedAccountId,
      amount: 0,
      method: "MobileMoney",
      phone: "",
    } as MemberDepositInput,
  })

  React.useEffect(() => {
    if (!preselectedAccountId && accounts.length === 1) {
      form.setValue("savingsAccountId", accounts[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts.length, preselectedAccountId, form])

  function switchChannel(next: "MobileMoney" | "BankTransfer") {
    setChannel(next)
    const savingsAccountId = form.getValues("savingsAccountId")
    const amount = form.getValues("amount")
    form.reset(
      next === "MobileMoney"
        ? { savingsAccountId, amount, method: "MobileMoney", phone: "" }
        : { savingsAccountId, amount, method: "BankTransfer", bankReference: "" }
    )
  }

  const mutation = useMutation({
    mutationFn: async (values: MemberDepositInput) => {
      const res = await fetch("/api/member-portal/savings/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.formErrors?.[0] ?? body.error ?? "Deposit failed")
      }
      return res.json()
    },
    onSuccess: (data) => setResult({ status: data.status, message: data.message }),
    onError: (err: Error) => toast.error(err.message),
  })

  if (isLoading) return <div className="h-64 animate-pulse rounded-lg bg-(--bg-card)" />

  if (accounts.length === 0) {
    return (
      <EmptyState
        icon={PiggyBank}
        title="No savings account yet"
        description="Visit your branch to open a savings account before you can deposit."
      />
    )
  }

  if (result) {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-(--border-subtle) bg-(--bg-card) p-8 text-center">
        <CheckCircle2 className="mx-auto size-12 text-(--success-600)" strokeWidth={1.5} />
        <h2 className="mt-4 text-[17px] font-semibold text-(--text-primary)">Deposit submitted</h2>
        <p className="mt-2 text-sm text-(--text-secondary)">{result.message}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="outline" onClick={() => { setResult(null); form.reset() }}>
            Make another deposit
          </Button>
          <Button onClick={() => router.push("/member-portal/dashboard/savings")}>View savings</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <p className="mb-2 text-[13px] font-medium text-(--text-secondary)">
          Deposit into <span className="text-(--error-600)">*</span>
        </p>
        <Select
          value={form.watch("savingsAccountId")}
          onValueChange={(v) => v && form.setValue("savingsAccountId", v)}
        >
          <SelectTrigger className="h-[42px] w-full rounded-sm border-(--border-subtle) px-3.5">
            <SelectValue placeholder="Select account" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.accountNumber} · {a.type} · {formatUGX(a.balance)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <p className="mb-2 text-[13px] font-medium text-(--text-secondary)">How are you paying?</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CHANNELS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => switchChannel(c.value)}
              className={`flex flex-col items-start gap-1.5 rounded-lg border p-4 text-left transition-colors ${
                channel === c.value
                  ? "border-(--accent-500) bg-(--accent-soft)"
                  : "border-(--border-subtle) bg-(--bg-card) hover:bg-(--bg-card-hover)"
              }`}
            >
              <c.icon className={`size-5 ${channel === c.value ? "text-(--accent-500)" : "text-(--text-muted)"}`} strokeWidth={1.75} />
              <span className="text-sm font-semibold text-(--text-primary)">{c.label}</span>
              <span className="text-xs text-(--text-secondary)">{c.description}</span>
            </button>
          ))}
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="space-y-5">
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

          {channel === "MobileMoney" ? (
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Phone number</FormLabel>
                  <FormControl>
                    <PhoneInput value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            <FormField
              control={form.control}
              name="bankReference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Bank transfer reference</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. transaction reference from your bank slip" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <Button type="submit" className="w-full" loading={mutation.isPending} disabled={!form.watch("savingsAccountId")}>
            {channel === "MobileMoney" ? "Send Mobile Money prompt" : "Submit for confirmation"}
          </Button>
        </form>
      </Form>
    </div>
  )
}
