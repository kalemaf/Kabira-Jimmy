"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Check, X, FileClock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/dashboard/empty-state"
import { formatUGX } from "@/lib/utils"
import type { LoanProductInput } from "@/lib/schemas/loan-product"

type ChangeRequest = {
  id: string
  targetProductId: string | null
  targetProduct: { id: string; name: string } | null
  changes: LoanProductInput
  requestedBy: { id: string; name: string }
  createdAt: string
}

const FIELD_LABELS: Partial<Record<keyof LoanProductInput, string>> = {
  name: "Name",
  interestRate: "Interest rate",
  minAmount: "Min amount",
  maxAmount: "Max amount",
  repaymentPeriodMonths: "Repayment period",
  gracePeriodDays: "Grace period",
  penaltyRate: "Penalty rate",
  processingFee: "Processing fee",
  insuranceFee: "Insurance fee",
  lateFee: "Late fee",
  serviceCharge: "Service charge",
  interestMethod: "Interest method",
  isActive: "Active",
}

function formatValue(key: keyof LoanProductInput, value: unknown) {
  if (key === "minAmount" || key === "maxAmount") return formatUGX(value as number)
  if (key === "isActive") return value ? "Yes" : "No"
  if (typeof value === "number") return String(value)
  return String(value)
}

function ChangeRequestRow({ request, currentUserId }: { request: ChangeRequest; currentUserId: string }) {
  const queryClient = useQueryClient()

  const { data: current } = useQuery({
    queryKey: ["loan-product", request.targetProductId],
    queryFn: async () => {
      const res = await fetch(`/api/loan-products/${request.targetProductId}`)
      if (!res.ok) throw new Error("Failed to load current product")
      return res.json() as Promise<LoanProductInput>
    },
    enabled: !!request.targetProductId,
  })

  const reviewMutation = useMutation({
    mutationFn: async (action: "Approve" | "Reject") => {
      const res = await fetch(`/api/loan-product-change-requests/${request.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "Failed to review change request")
      }
      return res.json()
    },
    onSuccess: (_data, action) => {
      toast.success(action === "Approve" ? "Change approved and applied" : "Change rejected")
      queryClient.invalidateQueries({ queryKey: ["loan-product-change-requests"] })
      queryClient.invalidateQueries({ queryKey: ["loan-products"] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const isOwnRequest = request.requestedBy.id === currentUserId
  const changedFields = (Object.keys(request.changes) as (keyof LoanProductInput)[]).filter(
    (key) => !current || current[key] !== request.changes[key]
  )

  return (
    <div className="space-y-3 rounded-lg border border-(--border-subtle) bg-(--bg-card) p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-(--text-primary)">
            {request.targetProductId ? `Edit — ${request.targetProduct?.name}` : `New product — ${request.changes.name}`}
          </p>
          <p className="text-xs text-(--text-secondary)">
            Requested by {request.requestedBy.name} · {new Date(request.createdAt).toLocaleString("en-UG")}
          </p>
        </div>
        {isOwnRequest ? (
          <p className="text-xs text-(--warning-600)">Awaiting a different SuperAdmin/Manager</p>
        ) : (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              loading={reviewMutation.isPending}
              onClick={() => reviewMutation.mutate("Reject")}
            >
              <X className="size-3.5" />
              Reject
            </Button>
            <Button size="sm" loading={reviewMutation.isPending} onClick={() => reviewMutation.mutate("Approve")}>
              <Check className="size-3.5" />
              Approve
            </Button>
          </div>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
        {(request.targetProductId ? changedFields : (Object.keys(request.changes) as (keyof LoanProductInput)[])).map(
          (key) => (
            <div key={key} className="flex flex-col">
              <dt className="text-xs text-(--text-secondary)">{FIELD_LABELS[key] ?? key}</dt>
              <dd className="text-(--text-primary)">
                {current && request.targetProductId ? (
                  <>
                    <span className="text-(--text-muted) line-through">{formatValue(key, current[key])}</span>{" "}
                    → {formatValue(key, request.changes[key])}
                  </>
                ) : (
                  formatValue(key, request.changes[key])
                )}
              </dd>
            </div>
          )
        )}
      </dl>
    </div>
  )
}

export function PendingChangeRequests({ currentUserId }: { currentUserId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["loan-product-change-requests"],
    queryFn: async () => {
      const res = await fetch("/api/loan-product-change-requests?status=Pending")
      if (!res.ok) throw new Error("Failed to load pending change requests")
      return res.json() as Promise<{ data: ChangeRequest[] }>
    },
  })

  if (isLoading || !data || data.data.length === 0) {
    return isLoading ? null : (
      <EmptyState icon={FileClock} title="No pending changes" description="Proposed product changes awaiting approval will appear here." />
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-(--text-primary)">Pending changes ({data.data.length})</h3>
      {data.data.map((r) => (
        <ChangeRequestRow key={r.id} request={r} currentUserId={currentUserId} />
      ))}
    </div>
  )
}
