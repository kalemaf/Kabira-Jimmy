"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

type MaintenanceFeePolicy = {
  enabled: boolean
  amountUgx: number
}

export function MaintenanceFeeForm() {
  const queryClient = useQueryClient()
  const [draft, setDraft] = React.useState<MaintenanceFeePolicy | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["maintenance-fee-policy"],
    queryFn: async () => {
      const res = await fetch("/api/settings/maintenance-fee")
      if (!res.ok) throw new Error("Failed to load maintenance fee policy")
      return res.json() as Promise<MaintenanceFeePolicy>
    },
  })

  React.useEffect(() => {
    if (data && !draft) setDraft(data)
  }, [data, draft])

  const saveMutation = useMutation({
    mutationFn: async (policy: MaintenanceFeePolicy) => {
      const res = await fetch("/api/settings/maintenance-fee", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(policy),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.formErrors?.[0] ?? body.error ?? "Failed to save")
      }
      return res.json() as Promise<MaintenanceFeePolicy>
    },
    onSuccess: (updated) => {
      toast.success("Account maintenance fee policy updated")
      setDraft(updated)
      queryClient.invalidateQueries({ queryKey: ["maintenance-fee-policy"] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isLoading || !draft) {
    return <div className="h-48 animate-pulse rounded-lg bg-(--bg-card)" />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account maintenance fee</CardTitle>
        <CardDescription>
          Charges every Active member&apos;s Daily savings account this amount, once a month, on the 1st.
          An account without enough balance to cover the fee is skipped that month rather than going
          negative. Each member is notified (SMS/email, plus it shows in their transaction history) when
          charged.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border border-(--border-subtle) p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-(--text-primary)">Enable monthly maintenance fee</p>
              <p className="text-xs text-(--text-secondary)">Off by default — no fee is charged until you turn this on.</p>
            </div>
            <Switch
              checked={draft.enabled}
              onCheckedChange={(v) => setDraft({ ...draft, enabled: v })}
            />
          </div>
          {draft.enabled ? (
            <div className="mt-3">
              <p className="mb-1.5 text-sm font-medium text-(--text-primary)">Fee amount</p>
              <CurrencyInput
                value={draft.amountUgx}
                onChange={(v) => setDraft({ ...draft, amountUgx: v ?? 0 })}
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
