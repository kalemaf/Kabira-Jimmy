"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export function RepaymentFeePolicyForm() {
  const queryClient = useQueryClient()
  const [draft, setDraft] = React.useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["repayment-fee-policy"],
    queryFn: async () => {
      const res = await fetch("/api/settings/repayment-fee-policy")
      if (!res.ok) throw new Error("Failed to load")
      return res.json() as Promise<{ mobileMoneyRepaymentFeePercent: number }>
    },
  })

  React.useEffect(() => {
    if (data && draft === null) setDraft(data.mobileMoneyRepaymentFeePercent)
  }, [data, draft])

  const saveMutation = useMutation({
    mutationFn: async (percent: number) => {
      const res = await fetch("/api/settings/repayment-fee-policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobileMoneyRepaymentFeePercent: percent }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "Failed to save")
      }
      return res.json() as Promise<{ mobileMoneyRepaymentFeePercent: number }>
    },
    onSuccess: (updated) => {
      toast.success("Repayment fee policy updated")
      setDraft(updated.mobileMoneyRepaymentFeePercent)
      queryClient.invalidateQueries({ queryKey: ["repayment-fee-policy"] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isLoading || draft === null) {
    return <div className="h-40 animate-pulse rounded-lg bg-(--bg-card)" />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mobile Money repayment collection fee</CardTitle>
        <CardDescription>
          When staff collect a loan repayment via Mobile Money, the member is charged this much extra on
          top of what they owe. The extra amount is retained as SACCO fee income — it's never applied
          toward the loan balance. Doesn't apply to Cash, Bank, or member self-service repayments.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <p className="mb-1.5 text-sm font-medium text-(--text-primary)">Fee (%)</p>
          <Input
            type="number"
            min={0}
            max={100}
            step={1}
            value={draft}
            onChange={(e) => setDraft(parseFloat(e.target.value) || 0)}
            className="max-w-[140px]"
          />
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
