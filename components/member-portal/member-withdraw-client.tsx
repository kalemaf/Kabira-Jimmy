"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery, useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { PiggyBank, CheckCircle2, Clock, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CurrencyInput } from "@/components/ui/currency-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmptyState } from "@/components/dashboard/empty-state"
import { formatUGX } from "@/lib/utils"

type SavingsAccount = { id: string; accountNumber: string; type: "Daily" | "Fixed" | "Shares"; balance: number }
type Response = { data: SavingsAccount[] }

type OtpRequestResult = {
  requestId: string
  maskedEmail: string
  maskedPhone: string
  requiresApproval: boolean
  penaltyAmount: number
  netPayoutAmount: number
}

type WithdrawResult = { status: "confirmed" | "pending" | "pending_approval"; message: string }

export function MemberWithdrawClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedAccountId = searchParams.get("accountId") ?? ""

  const [savingsAccountId, setSavingsAccountId] = React.useState(preselectedAccountId)
  const [amount, setAmount] = React.useState(0)
  const [otpInfo, setOtpInfo] = React.useState<OtpRequestResult | null>(null)
  const [code, setCode] = React.useState("")
  const [result, setResult] = React.useState<WithdrawResult | null>(null)

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

  React.useEffect(() => {
    if (!preselectedAccountId && accounts.length === 1) setSavingsAccountId(accounts[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts.length, preselectedAccountId])

  const requestOtpMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/member-portal/savings/withdraw/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ savingsAccountId, amount }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.formErrors?.[0] ?? body.error ?? "Could not start withdrawal")
      }
      return res.json() as Promise<OtpRequestResult>
    },
    onSuccess: (data) => setOtpInfo(data),
    onError: (err: Error) => toast.error(err.message),
  })

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/member-portal/savings/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: otpInfo!.requestId, code }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "Withdrawal failed")
      }
      return res.json() as Promise<WithdrawResult>
    },
    onSuccess: (data) => setResult(data),
    onError: (err: Error) => toast.error(err.message),
  })

  if (isLoading) return <div className="h-64 animate-pulse rounded-lg bg-(--bg-card)" />

  if (accounts.length === 0) {
    return (
      <EmptyState
        icon={PiggyBank}
        title="No savings account yet"
        description="Visit your branch to open a savings account before you can withdraw."
      />
    )
  }

  if (result) {
    const Icon = result.status === "confirmed" ? CheckCircle2 : result.status === "pending_approval" ? ShieldAlert : Clock
    const tone = result.status === "confirmed" ? "text-(--success-600)" : "text-(--warning-600)"
    return (
      <div className="mx-auto max-w-md rounded-lg border border-(--border-subtle) bg-(--bg-card) p-8 text-center">
        <Icon className={`mx-auto size-12 ${tone}`} strokeWidth={1.5} />
        <h2 className="mt-4 text-[17px] font-semibold text-(--text-primary)">
          {result.status === "confirmed" ? "Withdrawal successful" : result.status === "pending_approval" ? "Awaiting staff approval" : "Withdrawal submitted"}
        </h2>
        <p className="mt-2 text-sm text-(--text-secondary)">{result.message}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="outline" onClick={() => { setResult(null); setOtpInfo(null); setCode(""); setAmount(0) }}>
            Make another withdrawal
          </Button>
          <Button onClick={() => router.push("/member-portal/dashboard/savings")}>View savings</Button>
        </div>
      </div>
    )
  }

  const selectedAccount = accounts.find((a) => a.id === savingsAccountId)

  if (otpInfo) {
    return (
      <div className="mx-auto max-w-md space-y-6">
        <div className="rounded-lg border border-(--border-subtle) bg-(--bg-card) p-5">
          <p className="text-sm text-(--text-secondary)">
            A 6-digit code was sent to <span className="font-medium text-(--text-primary)">{otpInfo.maskedEmail}</span>.
            {otpInfo.requiresApproval ? (
              <> This withdrawal is above the automatic limit and will need staff approval before it's sent.</>
            ) : (
              <> Funds will be sent to <span className="font-medium text-(--text-primary)">{otpInfo.maskedPhone}</span> once confirmed.</>
            )}
          </p>
          {otpInfo.penaltyAmount > 0 ? (
            <p className="mt-2 text-sm text-(--warning-600)">
              An early-withdrawal fee of {formatUGX(otpInfo.penaltyAmount)} applies — you'll receive{" "}
              {formatUGX(otpInfo.netPayoutAmount)}.
            </p>
          ) : null}
        </div>

        <div>
          <p className="mb-2 text-[13px] font-medium text-(--text-secondary)">
            Confirmation code <span className="text-(--error-600)">*</span>
          </p>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            className="text-center text-lg tracking-[0.3em]"
            maxLength={6}
          />
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setOtpInfo(null)}>
            Back
          </Button>
          <Button
            className="flex-1"
            loading={confirmMutation.isPending}
            disabled={code.length !== 6}
            onClick={() => confirmMutation.mutate()}
          >
            Confirm withdrawal
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <p className="mb-2 text-[13px] font-medium text-(--text-secondary)">
          Withdraw from <span className="text-(--error-600)">*</span>
        </p>
        <Select value={savingsAccountId} onValueChange={(v) => v && setSavingsAccountId(v)}>
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
        {selectedAccount?.type === "Shares" ? (
          <p className="mt-2 text-xs text-(--error-600)">
            Share capital cannot be withdrawn while you remain an active member.
          </p>
        ) : null}
      </div>

      <div>
        <p className="mb-2 text-[13px] font-medium text-(--text-secondary)">
          Amount <span className="text-(--error-600)">*</span>
        </p>
        <CurrencyInput value={amount} onChange={(v) => setAmount(v ?? 0)} />
      </div>

      <Button
        className="w-full"
        loading={requestOtpMutation.isPending}
        disabled={!savingsAccountId || amount <= 0}
        onClick={() => requestOtpMutation.mutate()}
      >
        Send confirmation code
      </Button>
    </div>
  )
}
