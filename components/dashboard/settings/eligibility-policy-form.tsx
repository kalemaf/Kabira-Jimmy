"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

type EligibilityPolicy = {
  savingsToLoanRatio: number
  maxDebtToIncomeRatio: number
  guarantorExposureLimitUgx: number
  minimumSavingsForLoanUgx: number
}

type Draft = {
  savingsToLoanRatioPercent: number
  maxDebtToIncomeRatioPercent: number
  guarantorExposureLimitUgx: number
  minimumSavingsForLoanUgx: number
}

export function EligibilityPolicyForm() {
  const queryClient = useQueryClient()
  const [draft, setDraft] = React.useState<Draft | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["eligibility-policy"],
    queryFn: async () => {
      const res = await fetch("/api/settings/eligibility-policy")
      if (!res.ok) throw new Error("Failed to load eligibility policy")
      return res.json() as Promise<EligibilityPolicy>
    },
  })

  React.useEffect(() => {
    if (data && !draft) {
      setDraft({
        savingsToLoanRatioPercent: Math.round(data.savingsToLoanRatio * 100),
        maxDebtToIncomeRatioPercent: Math.round(data.maxDebtToIncomeRatio * 100),
        guarantorExposureLimitUgx: data.guarantorExposureLimitUgx,
        minimumSavingsForLoanUgx: data.minimumSavingsForLoanUgx,
      })
    }
  }, [data, draft])

  const saveMutation = useMutation({
    mutationFn: async (policy: Draft) => {
      const res = await fetch("/api/settings/eligibility-policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(policy),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "Failed to save")
      }
      return res.json() as Promise<EligibilityPolicy>
    },
    onSuccess: (updated) => {
      toast.success("Loan eligibility policy updated")
      setDraft({
        savingsToLoanRatioPercent: Math.round(updated.savingsToLoanRatio * 100),
        maxDebtToIncomeRatioPercent: Math.round(updated.maxDebtToIncomeRatio * 100),
        guarantorExposureLimitUgx: updated.guarantorExposureLimitUgx,
        minimumSavingsForLoanUgx: updated.minimumSavingsForLoanUgx,
      })
      queryClient.invalidateQueries({ queryKey: ["eligibility-policy"] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isLoading || !draft) {
    return <div className="h-64 animate-pulse rounded-lg bg-(--bg-card)" />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Loan eligibility policy</CardTitle>
        <CardDescription>
          Controls the automated checks run on every loan application — see the eligibility breakdown on
          each application for how these are applied.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-sm font-medium text-(--text-primary)">Minimum savings to qualify for a loan</p>
            <p className="mb-2 text-xs text-(--text-secondary)">
              A member below this savings balance is ineligible for any loan, regardless of amount requested.
            </p>
            <CurrencyInput
              value={draft.minimumSavingsForLoanUgx}
              onChange={(v) => setDraft({ ...draft, minimumSavingsForLoanUgx: v ?? 0 })}
            />
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-(--text-primary)">Required savings (% of loan amount)</p>
            <p className="mb-2 text-xs text-(--text-secondary)">
              A member's total savings must cover at least this fraction of a requested loan.
            </p>
            <Input
              type="number"
              min={0}
              max={100}
              step={1}
              value={draft.savingsToLoanRatioPercent}
              onChange={(e) => setDraft({ ...draft, savingsToLoanRatioPercent: parseFloat(e.target.value) || 0 })}
              className="max-w-[140px]"
            />
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-(--text-primary)">Max debt-to-income ratio (%)</p>
            <p className="mb-2 text-xs text-(--text-secondary)">
              The loan's monthly installment can't exceed this fraction of declared monthly income.
            </p>
            <Input
              type="number"
              min={0}
              max={100}
              step={1}
              value={draft.maxDebtToIncomeRatioPercent}
              onChange={(e) => setDraft({ ...draft, maxDebtToIncomeRatioPercent: parseFloat(e.target.value) || 0 })}
              className="max-w-[140px]"
            />
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-(--text-primary)">Guarantor exposure limit</p>
            <p className="mb-2 text-xs text-(--text-secondary)">
              Max total UGX one member can guarantee across all their guarantees combined.
            </p>
            <CurrencyInput
              value={draft.guarantorExposureLimitUgx}
              onChange={(v) => setDraft({ ...draft, guarantorExposureLimitUgx: v ?? 0 })}
            />
          </div>
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
