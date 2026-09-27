"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Landmark, PiggyBank, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MobileMoneyBadges, NetworkToggle } from "@/components/ui/mobile-money-badges"
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { EmptyState } from "@/components/dashboard/empty-state"
import { formatUGX } from "@/lib/utils"
import {
  memberDepositSchema,
  type MemberDepositInput,
} from "@/lib/schemas/member-savings"

type SavingsAccount = {
  id: string
  accountNumber: string
  type: "Daily" | "Fixed" | "Shares"
  balance: number
}
type Response = { data: SavingsAccount[] }

const CHANNELS = [
  {
    value: "MobileMoney" as const,
    label: "Mobile Money",
    description:
      "MTN or Airtel — you'll get a prompt on your phone to approve the payment.",
  },
  {
    value: "BankTransfer" as const,
    label: "Bank Transfer",
    description:
      "Already transferred via bank? Record the reference and a staff member will confirm it.",
  },
]

export function MemberDepositClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedAccountId = searchParams.get("accountId") ?? ""
  // "InstantBankTransfer" (RohoPay's bank_transfer rail) is deliberately not
  // offered here — a live test transaction failed on RohoPay's own side
  // (confirmed via their dashboard) even though the /collect call itself
  // succeeded. The backend route/schema/dgateway support is left in place
  // so it can be re-enabled once RohoPay confirms why, without re-doing
  // this work — see app/api/member-portal/savings/deposit/route.ts.
  const [channel, setChannel] = React.useState<"MobileMoney" | "BankTransfer">(
    "MobileMoney"
  )
  const [result, setResult] = React.useState<{
    status: string
    message: string
  } | null>(null)

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

  const { data: bankAccount } = useQuery({
    queryKey: ["member-bank-account-settings"],
    queryFn: async () => {
      const res = await fetch("/api/member-portal/settings/bank-account")
      if (!res.ok) throw new Error("Failed to load bank account details")
      return res.json() as Promise<{
        bankName: string | null
        bankAccountName: string | null
        bankAccountNumber: string | null
        bankBranch: string | null
      }>
    },
    enabled: channel === "BankTransfer",
  })

  const form = useForm<MemberDepositInput>({
    resolver: zodResolver(memberDepositSchema),
    defaultValues: {
      savingsAccountId: preselectedAccountId,
      amount: 0,
      method: "MobileMoney",
      phone: "",
      network: undefined,
    } as unknown as MemberDepositInput,
  })

  const selectedAccountId = form.watch("savingsAccountId")
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId)

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
      (next === "MobileMoney"
        ? { savingsAccountId, amount, method: "MobileMoney", phone: "", network: undefined }
        : {
            savingsAccountId,
            amount,
            method: "BankTransfer",
            bankReference: "",
          }) as unknown as MemberDepositInput
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
        throw new Error(
          body.error?.formErrors?.[0] ?? body.error ?? "Deposit failed"
        )
      }
      return res.json()
    },
    onSuccess: (data) =>
      setResult({ status: data.status, message: data.message }),
    onError: (err: Error) => toast.error(err.message),
  })

  if (isLoading)
    return <div className="h-64 animate-pulse rounded-lg bg-(--bg-card)" />

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
        <CheckCircle2
          className="mx-auto size-12 text-(--success-600)"
          strokeWidth={1.5}
        />
        <h2 className="mt-4 text-[17px] font-semibold text-(--text-primary)">
          Deposit submitted
        </h2>
        <p className="mt-2 text-sm text-(--text-secondary)">{result.message}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setResult(null)
              form.reset()
            }}
          >
            Make another deposit
          </Button>
          <Button
            onClick={() => router.push("/member-portal/dashboard/savings")}
          >
            View savings
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 rounded-2xl border border-(--border-subtle) bg-(--bg-card) p-6 shadow-sm sm:p-8">
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

      {selectedAccount && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-(--brand-green) p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white p-1.5">
              <Image src="/nexcgen.png" alt="" width={28} height={28} className="size-full object-contain" />
            </span>
            <div>
              <p className="text-[11px] font-semibold tracking-[0.04em] text-white/80 uppercase">
                Current balance · {selectedAccount.type}
              </p>
              <p className="text-[13px] text-white/70">{selectedAccount.accountNumber}</p>
            </div>
          </div>
          <p className="text-[22px] leading-[1.1] font-bold text-white tabular-nums">
            {formatUGX(selectedAccount.balance)}
          </p>
        </div>
      )}

      <div>
        <p className="mb-2 text-[13px] font-medium text-(--text-secondary)">
          How are you paying?
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CHANNELS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => switchChannel(c.value)}
              className={`flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors ${
                channel === c.value
                  ? "border-(--accent-500) bg-(--accent-soft)"
                  : "border-(--border-subtle) bg-(--bg-card) hover:bg-(--bg-card-hover)"
              }`}
            >
              {c.value === "MobileMoney" ? (
                <MobileMoneyBadges />
              ) : (
                <Landmark
                  className={`size-5 ${channel === c.value ? "text-(--accent-500)" : "text-(--text-muted)"}`}
                  strokeWidth={1.75}
                />
              )}
              <span className="text-sm font-semibold text-(--text-primary)">
                {c.label}
              </span>
              <span className="text-xs text-(--text-secondary)">
                {c.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="space-y-5"
        >
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Amount</FormLabel>
                <FormControl>
                  <CurrencyInput
                    value={field.value}
                    onChange={(v) => field.onChange(v ?? 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {channel === "MobileMoney" ? (
            <>
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
              <FormField
                control={form.control}
                name="network"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Network</FormLabel>
                    <FormControl>
                      <NetworkToggle value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          ) : (
            <>
              {bankAccount?.bankAccountNumber ? (
                <div className="space-y-1.5 rounded-lg border border-(--border-subtle) bg-(--bg-card-hover) p-4 text-sm">
                  <p className="mb-1 text-[11px] font-semibold tracking-[0.04em] text-(--text-secondary) uppercase">
                    Transfer to this account first
                  </p>
                  <div className="flex justify-between gap-3">
                    <span className="text-(--text-secondary)">Bank</span>
                    <span className="text-right font-medium text-(--text-primary)">{bankAccount.bankName}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-(--text-secondary)">Account name</span>
                    <span className="text-right font-medium text-(--text-primary)">{bankAccount.bankAccountName}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-(--text-secondary)">Account number</span>
                    <span className="text-right font-mono font-medium text-(--text-primary)">{bankAccount.bankAccountNumber}</span>
                  </div>
                  {bankAccount.bankBranch ? (
                    <div className="flex justify-between gap-3">
                      <span className="text-(--text-secondary)">Branch</span>
                      <span className="text-right font-medium text-(--text-primary)">{bankAccount.bankBranch}</span>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="rounded-lg border border-(--warning-border) bg-(--warning-soft) p-4 text-sm text-(--text-secondary)">
                  Bank account details aren&apos;t set up yet — please visit your branch to deposit by bank
                  transfer for now.
                </p>
              )}
              <FormField
                control={form.control}
                name="bankReference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Bank transfer reference</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. transaction reference from your bank slip"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          <Button
            type="submit"
            className="w-full"
            loading={mutation.isPending}
            disabled={!form.watch("savingsAccountId")}
          >
            {channel === "MobileMoney"
              ? "Send Mobile Money prompt"
              : "Submit for confirmation"}
          </Button>
        </form>
      </Form>
    </div>
  )
}
