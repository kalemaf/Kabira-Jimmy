"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { AlertTriangle, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { CurrencyInput } from "@/components/ui/currency-input"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { SearchableSelect } from "@/components/searchable-select"
import { EmptyState } from "@/components/dashboard/empty-state"
import { StatusBadge } from "@/components/status-badge"
import { useRecoveryOfficerOptions } from "@/hooks/use-staff-options"
import { formatUGX } from "@/lib/utils"
import { recoveryStatuses } from "@/lib/schemas/recovery"

type RecoveryCaseRow = {
  id: string
  status: string
  notes: string | null
  visitDate: string | null
  recoveredAmount: number
  loan: {
    id: string
    principal: number
    status: string
    member: { firstName: string; lastName: string; memberNumber: string; phone: string }
    branch: { name: string }
  }
  recoveryOfficer: { id: string; name: string } | null
}

type DefaulterLoan = {
  id: string
  principal: number
  status: string
  member: { firstName: string; lastName: string; memberNumber: string; phone: string }
  branch: { name: string }
}

type Response = { data: RecoveryCaseRow[]; unassignedDefaulters: DefaulterLoan[] }

const STATUS_TONE: Record<string, "success" | "warning" | "error" | "info" | "neutral"> = {
  Active: "warning",
  Promised: "info",
  Legal: "error",
  Blacklisted: "error",
  Recovered: "success",
}

export function RecoveryClient() {
  const queryClient = useQueryClient()
  const [openCase, setOpenCase] = React.useState<RecoveryCaseRow | null>(null)
  const [openDefaulter, setOpenDefaulter] = React.useState<DefaulterLoan | null>(null)
  const { options: officerOptions } = useRecoveryOfficerOptions()

  const { data, isLoading } = useQuery({
    queryKey: ["recovery-cases"],
    queryFn: async () => {
      const res = await fetch("/api/recovery-cases?limit=50")
      if (!res.ok) throw new Error("Failed to load recovery cases")
      return res.json() as Promise<Response>
    },
    staleTime: 15_000,
  })

  const createMutation = useMutation({
    mutationFn: async (loanId: string) => {
      const res = await fetch("/api/recovery-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loanId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "Failed to open case")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success("Recovery case opened")
      setOpenDefaulter(null)
      queryClient.invalidateQueries({ queryKey: ["recovery-cases"] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const [status, setStatus] = React.useState("Active")
  const [officerId, setOfficerId] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [visitDate, setVisitDate] = React.useState<Date | undefined>()
  const [recoveredAmount, setRecoveredAmount] = React.useState<number | undefined>(0)

  React.useEffect(() => {
    if (openCase) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time form init when the dialog opens for a case
      setStatus(openCase.status)
      setOfficerId(openCase.recoveryOfficer?.id ?? "")
      setNotes(openCase.notes ?? "")
      setVisitDate(openCase.visitDate ? new Date(openCase.visitDate) : undefined)
      setRecoveredAmount(openCase.recoveredAmount)
    }
  }, [openCase])

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/recovery-cases/${openCase!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          recoveryOfficerId: officerId || undefined,
          notes: notes || undefined,
          visitDate,
          recoveredAmount,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.formErrors?.[0] ?? body.error ?? "Update failed")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success("Recovery case updated")
      setOpenCase(null)
      queryClient.invalidateQueries({ queryKey: ["recovery-cases"] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isLoading) return <div className="h-96 animate-pulse rounded-lg bg-(--bg-card)" />

  return (
    <div className="space-y-8">
      {data && data.unassignedDefaulters.length > 0 ? (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-(--text-primary)">
            <AlertTriangle className="size-4 text-(--warning-600)" />
            Unassigned defaulters
          </h3>
          <div className="overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-card)">
            <div className="divide-y divide-(--border-subtle)">
              {data.unassignedDefaulters.map((loan) => (
                <div key={loan.id} className="flex items-center justify-between p-4 text-sm">
                  <div>
                    <p className="font-medium text-(--text-primary)">
                      {loan.member.firstName} {loan.member.lastName}
                    </p>
                    <p className="text-xs text-(--text-secondary)">
                      {loan.member.memberNumber} · {loan.branch.name} · {formatUGX(loan.principal)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={loan.status} tone="error" />
                    <Button size="sm" onClick={() => setOpenDefaulter(loan)}>
                      Open case
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div>
        <h3 className="mb-3 text-sm font-semibold text-(--text-primary)">Recovery cases</h3>
        {!data || data.data.length === 0 ? (
          <EmptyState icon={ShieldAlert} title="No recovery cases" description="Defaulted loans will appear here for follow-up." />
        ) : (
          <div className="overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-card)">
            <div className="divide-y divide-(--border-subtle)">
              {data.data.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setOpenCase(c)}
                  className="flex w-full items-center justify-between p-4 text-left text-sm transition-colors hover:bg-(--bg-card-hover)"
                >
                  <div>
                    <p className="font-medium text-(--text-primary)">
                      {c.loan.member.firstName} {c.loan.member.lastName}
                    </p>
                    <p className="text-xs text-(--text-secondary)">
                      {c.loan.member.memberNumber} · {c.loan.branch.name} · {formatUGX(c.loan.principal)}
                      {c.recoveryOfficer ? ` · Officer: ${c.recoveryOfficer.name}` : " · Unassigned"}
                    </p>
                  </div>
                  <StatusBadge status={c.status} tone={STATUS_TONE[c.status]} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!openDefaulter} onOpenChange={(open) => !open && setOpenDefaulter(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Open recovery case</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-(--text-secondary)">
            Open a case for {openDefaulter?.member.firstName} {openDefaulter?.member.lastName} (
            {openDefaulter?.member.memberNumber})?
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenDefaulter(null)}>
              Cancel
            </Button>
            <Button
              loading={createMutation.isPending}
              onClick={() => openDefaulter && createMutation.mutate(openDefaulter.id)}
            >
              Open case
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!openCase} onOpenChange={(open) => !open && setOpenCase(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {openCase?.loan.member.firstName} {openCase?.loan.member.lastName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-(--text-secondary)">Status</label>
              <Select value={status} onValueChange={(v) => v && setStatus(v)}>
                <SelectTrigger className="h-[42px] w-full rounded-sm border-(--border-subtle) px-3.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {recoveryStatuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-(--text-secondary)">Recovery officer</label>
              <SearchableSelect options={officerOptions} value={officerId} onChange={setOfficerId} placeholder="Assign officer" />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-(--text-secondary)">Next visit date</label>
              <DatePicker value={visitDate} onChange={setVisitDate} />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-(--text-secondary)">Recovered amount</label>
              <CurrencyInput value={recoveredAmount} onChange={setRecoveredAmount} />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-(--text-secondary)">Notes</label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Visit notes, promises made..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenCase(null)}>
              Cancel
            </Button>
            <Button loading={updateMutation.isPending} onClick={() => updateMutation.mutate()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
