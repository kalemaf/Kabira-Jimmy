"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

type WithdrawalPolicy = {
  minFlexibleSavingsBalance: number
  fixedEarlyWithdrawalAllowed: boolean
  fixedEarlyWithdrawalPenaltyPercent: number
  dailyWithdrawalAmountLimit: number
  maxWithdrawalsPerDay: number
  largeWithdrawalApprovalThreshold: number
}

export function WithdrawalPolicyForm() {
  const queryClient = useQueryClient()
  const [draft, setDraft] = React.useState<WithdrawalPolicy | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["withdrawal-policy"],
    queryFn: async () => {
      const res = await fetch("/api/settings/withdrawal-policy")
      if (!res.ok) throw new Error("Failed to load withdrawal policy")
      return res.json() as Promise<WithdrawalPolicy>
    },
  })

  React.useEffect(() => {
    if (data && !draft) setDraft(data)
  }, [data, draft])

  const saveMutation = useMutation({
    mutationFn: async (policy: WithdrawalPolicy) => {
      const res = await fetch("/api/settings/withdrawal-policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(policy),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "Failed to save")
      }
      return res.json() as Promise<WithdrawalPolicy>
    },
    onSuccess: (updated) => {
      toast.success("Withdrawal policy updated")
      setDraft(updated)
      queryClient.invalidateQueries({ queryKey: ["withdrawal-policy"] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isLoading || !draft) {
    return <div className="h-64 animate-pulse rounded-lg bg-(--bg-card)" />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Withdrawal policy</CardTitle>
        <CardDescription>
          Controls what members can self-service withdraw, and when staff approval is required.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-sm font-medium text-(--text-primary)">Minimum Flexible (Daily) balance</p>
            <p className="mb-2 text-xs text-(--text-secondary)">Kept in the account after any withdrawal.</p>
            <CurrencyInput
              value={draft.minFlexibleSavingsBalance}
              onChange={(v) => setDraft({ ...draft, minFlexibleSavingsBalance: v ?? 0 })}
            />
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-(--text-primary)">Large-withdrawal approval threshold</p>
            <p className="mb-2 text-xs text-(--text-secondary)">Above this, staff must approve before it's sent.</p>
            <CurrencyInput
              value={draft.largeWithdrawalApprovalThreshold}
              onChange={(v) => setDraft({ ...draft, largeWithdrawalApprovalThreshold: v ?? 0 })}
            />
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-(--text-primary)">Daily withdrawal amount limit</p>
            <p className="mb-2 text-xs text-(--text-secondary)">Per member, across all their accounts.</p>
            <CurrencyInput
              value={draft.dailyWithdrawalAmountLimit}
              onChange={(v) => setDraft({ ...draft, dailyWithdrawalAmountLimit: v ?? 0 })}
            />
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-(--text-primary)">Max withdrawals per day</p>
            <p className="mb-2 text-xs text-(--text-secondary)">Number of withdrawal transactions, per member.</p>
            <Input
              type="number"
              min={1}
              value={draft.maxWithdrawalsPerDay}
              onChange={(e) => setDraft({ ...draft, maxWithdrawalsPerDay: parseInt(e.target.value) || 1 })}
            />
          </div>
        </div>

        <div className="rounded-lg border border-(--border-subtle) p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-(--text-primary)">Allow early Fixed savings withdrawal</p>
              <p className="text-xs text-(--text-secondary)">If off, Fixed accounts are locked until maturity — no exceptions.</p>
            </div>
            <Switch
              checked={draft.fixedEarlyWithdrawalAllowed}
              onCheckedChange={(v) => setDraft({ ...draft, fixedEarlyWithdrawalAllowed: v })}
            />
          </div>
          {draft.fixedEarlyWithdrawalAllowed ? (
            <div className="mt-3">
              <p className="mb-1.5 text-sm font-medium text-(--text-primary)">Early-withdrawal penalty (%)</p>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={draft.fixedEarlyWithdrawalPenaltyPercent}
                onChange={(e) => setDraft({ ...draft, fixedEarlyWithdrawalPenaltyPercent: parseFloat(e.target.value) || 0 })}
                className="max-w-[140px]"
              />
            </div>
          ) : null}
        </div>

        <div className="flex justify-end">
          <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate(draft)}>
            Save policy
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
