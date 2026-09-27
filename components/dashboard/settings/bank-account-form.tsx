"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

type BankAccountDetails = {
  bankName: string | null
  bankAccountName: string | null
  bankAccountNumber: string | null
  bankBranch: string | null
}

const EMPTY: BankAccountDetails = { bankName: "", bankAccountName: "", bankAccountNumber: "", bankBranch: "" }

export function BankAccountForm() {
  const queryClient = useQueryClient()
  const [draft, setDraft] = React.useState<BankAccountDetails | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["bank-account-settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings/bank-account")
      if (!res.ok) throw new Error("Failed to load")
      return res.json() as Promise<BankAccountDetails>
    },
  })

  React.useEffect(() => {
    if (data && draft === null) {
      setDraft({
        bankName: data.bankName ?? "",
        bankAccountName: data.bankAccountName ?? "",
        bankAccountNumber: data.bankAccountNumber ?? "",
        bankBranch: data.bankBranch ?? "",
      })
    }
  }, [data, draft])

  const saveMutation = useMutation({
    mutationFn: async (values: BankAccountDetails) => {
      const res = await fetch("/api/settings/bank-account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankName: values.bankName || null,
          bankAccountName: values.bankAccountName || null,
          bankAccountNumber: values.bankAccountNumber || null,
          bankBranch: values.bankBranch || null,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.formErrors?.[0] ?? body.error ?? "Failed to save")
      }
      return res.json() as Promise<BankAccountDetails>
    },
    onSuccess: () => {
      toast.success("Bank account details updated")
      queryClient.invalidateQueries({ queryKey: ["bank-account-settings"] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isLoading || draft === null) {
    return <div className="h-64 animate-pulse rounded-lg bg-(--bg-card)" />
  }

  const current = draft ?? EMPTY

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bank account for deposits</CardTitle>
        <CardDescription>
          Shown to a member on the deposit page once they choose Bank Transfer, so they know where to
          actually send the money. The deposit itself still works the same way it always has — the member
          records their transfer reference, and a staff member confirms it against the real bank statement
          before the balance moves.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-sm font-medium text-(--text-primary)">Bank name</p>
            <Input
              placeholder="e.g. Stanbic Bank Uganda"
              value={current.bankName ?? ""}
              onChange={(e) => setDraft({ ...current, bankName: e.target.value })}
            />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-(--text-primary)">Branch</p>
            <Input
              placeholder="e.g. Kampala Road"
              value={current.bankBranch ?? ""}
              onChange={(e) => setDraft({ ...current, bankBranch: e.target.value })}
            />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-(--text-primary)">Account name</p>
            <Input
              placeholder="e.g. Nexcgen SACCO Ltd"
              value={current.bankAccountName ?? ""}
              onChange={(e) => setDraft({ ...current, bankAccountName: e.target.value })}
            />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-(--text-primary)">Account number</p>
            <Input
              placeholder="e.g. 9030012345678"
              value={current.bankAccountNumber ?? ""}
              onChange={(e) => setDraft({ ...current, bankAccountNumber: e.target.value })}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate(current)}>
            Save bank account
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
