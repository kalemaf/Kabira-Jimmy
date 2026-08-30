"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Check, X, Undo2, ShieldCheck, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PhoneInput } from "@/components/ui/phone-input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { StatusBadge } from "@/components/status-badge"
import { EmptyState } from "@/components/dashboard/empty-state"
import { formatUGX } from "@/lib/utils"
import { STATUS_STAGE, STATUS_LABELS, STAGE_LABELS, canActAtStage, type ApplicationStatus } from "@/lib/loan-workflow"
import type { StaffRole } from "@/components/dashboard/nav-config"

type ApplicationDetail = {
  id: string
  amount: number
  purpose: string
  repaymentPeriodMonths: number
  interestMethod: string
  riskScore: number
  riskFlags: string[]
  status: ApplicationStatus
  preparedByUserId: string | null
  disbursementTransactionRef: string | null
  member: { id: string; firstName: string; lastName: string; memberNumber: string; phone: string }
  loanProduct: { name: string; interestRate: number };
  preparedBy: { id: string; name: string; email: string } | null
  submittedByMemberUser: { name: string; email: string } | null
  guarantors: { id: string; guaranteeAmount: number; status: string; member: { firstName: string; lastName: string; memberNumber: string } }[]
  collateral: { id: string; description: string; estimatedValue: number }[]
  approvalSteps: { id: string; stage: string; action: string; comments: string | null; createdAt: string; user: { name: string; role: string } }[]
  loan: { id: string } | null
}

const STATUS_TONE: Record<string, "success" | "warning" | "error" | "info" | "neutral"> = {
  Disbursed: "success",
  Rejected: "error",
  Returned: "warning",
}

export function ApplicationDetail({
  applicationId,
  currentUserId,
  role,
}: {
  applicationId: string
  currentUserId: string
  role: StaffRole
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [confirmAction, setConfirmAction] = React.useState<"Approve" | "Reject" | "Return" | null>(null)
  const [comments, setComments] = React.useState("")
  const [disbursementMethod, setDisbursementMethod] = React.useState<"Cash" | "Bank" | "MobileMoney" | null>(null)
  const [phone, setPhone] = React.useState("")
  const [confirmDisburse, setConfirmDisburse] = React.useState(false)
  const [confirmReverse, setConfirmReverse] = React.useState(false)
  const [reverseReason, setReverseReason] = React.useState("")
  const [attestedHandedOver, setAttestedHandedOver] = React.useState(false)

  const { data: application, isLoading } = useQuery({
    queryKey: ["loan-application", applicationId],
    queryFn: async () => {
      const res = await fetch(`/api/loan-applications/${applicationId}`)
      if (!res.ok) throw new Error("Failed to load application")
      return res.json() as Promise<ApplicationDetail>
    },
  })

  const approveMutation = useMutation({
    mutationFn: async (action: "Approve" | "Reject" | "Return") => {
      const res = await fetch(`/api/loan-applications/${applicationId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comments: comments.trim() || undefined }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "Action failed")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success("Action recorded")
      setConfirmAction(null)
      setComments("")
      queryClient.invalidateQueries({ queryKey: ["loan-application", applicationId] })
      queryClient.invalidateQueries({ queryKey: ["loan-applications"] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const disburseMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/loan-applications/${applicationId}/disburse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disbursementMethod,
          comments: comments.trim() || undefined,
          phone: disbursementMethod === "MobileMoney" ? phone : undefined,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.formErrors?.[0] ?? body.error ?? "Disbursement failed")
      }
      return res.json() as Promise<{ status: string; loan?: { id: string } }>
    },
    onSuccess: (result) => {
      setConfirmDisburse(false)
      if (result.status === "disbursed" && result.loan) {
        toast.success("Loan disbursed")
        router.push(`/dashboard/loans/${result.loan.id}`)
      } else {
        toast.success(result.status === "pending" ? "Mobile Money payout initiated" : "Disbursement recorded")
        queryClient.invalidateQueries({ queryKey: ["loan-application", applicationId] })
      }
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const reconcileMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/loan-applications/${applicationId}/reconcile`, { method: "POST" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "Failed to check with RohoPay")
      }
      return res.json() as Promise<{ status: "disbursed" | "failed" | "pending"; message?: string }>
    },
    onSuccess: (data) => {
      if (data.status === "disbursed") {
        toast.success("RohoPay confirms this payout succeeded — loan created")
        queryClient.invalidateQueries({ queryKey: ["loan-application", applicationId] })
        queryClient.invalidateQueries({ queryKey: ["loan-applications"] })
      } else if (data.status === "failed") {
        toast.error("RohoPay reports this payout failed")
        queryClient.invalidateQueries({ queryKey: ["loan-application", applicationId] })
      } else {
        toast.info(data.message ?? "RohoPay still shows this as pending — try again shortly")
      }
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const reverseMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/loan-applications/${applicationId}/reverse-disbursement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reverseReason.trim() }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.formErrors?.[0] ?? body.error ?? "Failed to reverse disbursement")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success("Disbursement reversed — application returned to Pending disbursement")
      setConfirmReverse(false)
      setReverseReason("")
      queryClient.invalidateQueries({ queryKey: ["loan-application", applicationId] })
      queryClient.invalidateQueries({ queryKey: ["loan-applications"] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isLoading) return <div className="h-96 animate-pulse rounded-lg bg-(--bg-card)" />
  if (!application) {
    return <EmptyState icon={FileText} title="Application not found" />
  }

  const stage = STATUS_STAGE[application.status]
  const isPreparer = application.preparedByUserId === currentUserId
  const canAct = !!stage && canActAtStage(role, stage) && !isPreparer
  const isApprovalStage =
    stage === "LoanOfficer" || stage === "Secretary" || stage === "Treasurer" || stage === "Manager"
  const isDisbursementStage = stage === "Disbursement"
  const canReverse =
    (role === "SuperAdmin" || role === "Manager") && application.status === "Disbursed" && !!application.loan

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-(--border-subtle) bg-(--bg-card) p-6">
        <div>
          <h2 className="text-[18px] font-semibold text-(--text-primary)">
            {application.member.firstName} {application.member.lastName}
          </h2>
          <p className="text-sm text-(--text-secondary)">
            {application.member.memberNumber} · {application.loanProduct.name}
          </p>
        </div>
        <StatusBadge
          status={application.status}
          tone={STATUS_TONE[application.status] ?? "info"}
          label={STATUS_LABELS[application.status]}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-(--border-subtle) bg-(--bg-card) p-5">
          <h4 className="mb-2 text-sm font-semibold text-(--text-primary)">Loan details</h4>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-(--text-secondary)">Amount</dt>
              <dd className="font-mono tabular-nums text-(--text-primary)">{formatUGX(application.amount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-(--text-secondary)">Period</dt>
              <dd className="text-(--text-primary)">{application.repaymentPeriodMonths} months</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-(--text-secondary)">Interest</dt>
              <dd className="text-(--text-primary)">
                {application.loanProduct.interestRate}% ({application.interestMethod})
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-(--text-secondary)">
                {application.preparedBy ? "Prepared by" : "Submitted by"}
              </dt>
              <dd className="text-(--text-primary)">
                {application.preparedBy?.name ?? (application.submittedByMemberUser ? `${application.submittedByMemberUser.name} (member self-service)` : "—")}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-sm text-(--text-secondary)">{application.purpose}</p>
        </div>

        <div className="rounded-lg border border-(--border-subtle) bg-(--bg-card) p-5">
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-(--text-primary)">
            <ShieldCheck className="size-4" />
            Risk assessment
          </h4>
          <p className="text-2xl font-bold tabular-nums text-(--text-primary)">{application.riskScore}/100</p>
          {application.riskFlags.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs text-(--warning-600)">
              {application.riskFlags.map((flag, i) => (
                <li key={i}>• {flag}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-(--success-600)">No risk flags raised.</p>
          )}
        </div>
      </div>

      {application.guarantors.length > 0 ? (
        <div className="rounded-lg border border-(--border-subtle) bg-(--bg-card) p-5">
          <h4 className="mb-3 text-sm font-semibold text-(--text-primary)">Guarantors</h4>
          <div className="space-y-2">
            {application.guarantors.map((g) => (
              <div key={g.id} className="flex items-center justify-between text-sm">
                <span className="text-(--text-primary)">
                  {g.member.firstName} {g.member.lastName} ({g.member.memberNumber})
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-mono tabular-nums text-(--text-secondary)">
                    {formatUGX(g.guaranteeAmount)}
                  </span>
                  <StatusBadge status={g.status} />
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {application.collateral.length > 0 ? (
        <div className="rounded-lg border border-(--border-subtle) bg-(--bg-card) p-5">
          <h4 className="mb-3 text-sm font-semibold text-(--text-primary)">Collateral</h4>
          <div className="space-y-2">
            {application.collateral.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <span className="text-(--text-primary)">{c.description}</span>
                <span className="font-mono tabular-nums text-(--text-secondary)">
                  {formatUGX(c.estimatedValue)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-(--border-subtle) bg-(--bg-card) p-5">
        <h4 className="mb-3 text-sm font-semibold text-(--text-primary)">Approval history</h4>
        {application.approvalSteps.length === 0 ? (
          <p className="text-sm text-(--text-secondary)">No approval actions yet.</p>
        ) : (
          <ol className="space-y-3">
            {application.approvalSteps.map((step) => (
              <li key={step.id} className="border-l-2 border-(--border-subtle) pl-3 text-sm">
                <p className="text-(--text-primary)">
                  <span className="font-medium">{step.user.name}</span> {step.action.toLowerCase()}d at{" "}
                  {STAGE_LABELS[step.stage as keyof typeof STAGE_LABELS] ?? step.stage}
                </p>
                {step.comments ? <p className="text-(--text-secondary)">&ldquo;{step.comments}&rdquo;</p> : null}
                <p className="text-xs text-(--text-muted)">{new Date(step.createdAt).toLocaleString("en-UG")}</p>
              </li>
            ))}
          </ol>
        )}
      </div>

      {isPreparer && stage ? (
        <p className="rounded-lg border border-(--warning-border) bg-(--warning-soft) p-4 text-sm text-(--warning-600)">
          You prepared this application, so you cannot act on it yourself — maker-checker requires a
          different staff member to review it.
        </p>
      ) : null}

      {canAct && isApprovalStage ? (
        <div className="flex justify-end gap-3">
          <Button variant="destructive" onClick={() => setConfirmAction("Reject")}>
            <X className="size-4" />
            Reject
          </Button>
          <Button variant="outline" onClick={() => setConfirmAction("Return")}>
            <Undo2 className="size-4" />
            Return
          </Button>
          <Button onClick={() => setConfirmAction("Approve")}>
            <Check className="size-4" />
            Approve
          </Button>
        </div>
      ) : null}

      {canAct && isDisbursementStage && application.disbursementTransactionRef ? (
        <div className="space-y-3 rounded-lg border border-(--border-subtle) bg-(--bg-card) p-6">
          <h4 className="text-sm font-semibold text-(--text-primary)">Mobile Money payout in progress</h4>
          <p className="text-sm text-(--text-secondary)">
            A payout was already initiated for this loan and is awaiting confirmation — it cannot be
            disbursed again. Check its real status with RohoPay instead.
          </p>
          <Button
            variant="outline"
            loading={reconcileMutation.isPending}
            onClick={() => reconcileMutation.mutate()}
          >
            Check with RohoPay
          </Button>
        </div>
      ) : canAct && isDisbursementStage ? (
        <div className="space-y-4 rounded-lg border border-(--border-subtle) bg-(--bg-card) p-6">
          <h4 className="text-sm font-semibold text-(--text-primary)">Disburse this loan</h4>
          <Select
            value={disbursementMethod ?? undefined}
            onValueChange={(v) => {
              if (!v) return
              setDisbursementMethod(v as Exclude<typeof disbursementMethod, null>)
              setAttestedHandedOver(false)
            }}
          >
            <SelectTrigger className="h-[42px] w-full rounded-sm border-(--border-subtle) px-3.5">
              <SelectValue placeholder="Choose a disbursement method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Cash">Cash</SelectItem>
              <SelectItem value="Bank">Bank transfer</SelectItem>
              <SelectItem value="MobileMoney">Mobile Money</SelectItem>
            </SelectContent>
          </Select>
          {disbursementMethod === "MobileMoney" ? (
            <PhoneInput value={phone} onChange={setPhone} />
          ) : null}
          {disbursementMethod === "Cash" || disbursementMethod === "Bank" ? (
            <label className="flex items-start gap-2 text-sm text-(--text-secondary)">
              <Checkbox
                checked={attestedHandedOver}
                onCheckedChange={(v) => setAttestedHandedOver(!!v)}
                className="mt-0.5"
              />
              {disbursementMethod === "Cash"
                ? `I confirm ${formatUGX(application.amount)} in cash has already been physically handed to the member.`
                : `I confirm ${formatUGX(application.amount)} has already been transferred to the member's bank account.`}
            </label>
          ) : null}
          <div className="flex justify-end">
            <Button
              disabled={
                !disbursementMethod ||
                (disbursementMethod === "MobileMoney" && !phone) ||
                ((disbursementMethod === "Cash" || disbursementMethod === "Bank") && !attestedHandedOver)
              }
              onClick={() => setConfirmDisburse(true)}
            >
              Disburse loan
            </Button>
          </div>
        </div>
      ) : null}

      {canReverse ? (
        <div className="space-y-3 rounded-lg border border-(--warning-border) bg-(--warning-soft) p-6">
          <h4 className="text-sm font-semibold text-(--text-primary)">Reverse this disbursement</h4>
          <p className="text-sm text-(--text-secondary)">
            Use this only if the member disputes receiving the funds, or the wrong method was confirmed by
            mistake. This deletes the loan record, reverses the ledger entries, and returns the application
            to Pending disbursement so it can be redone correctly. Only possible while no repayments have
            been made against it.
          </p>
          <div className="flex justify-end">
            <Button variant="destructive" onClick={() => setConfirmReverse(true)}>
              Reverse disbursement
            </Button>
          </div>
        </div>
      ) : null}

      {/* Approve/Reject/Return confirmation */}
      <Dialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmAction} this application?</DialogTitle>
            <DialogDescription>
              This action is recorded permanently in the audit log and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              placeholder={confirmAction === "Approve" ? "Comments (optional)" : "Comments (required)"}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button
              variant={confirmAction === "Reject" ? "destructive" : "default"}
              loading={approveMutation.isPending}
              disabled={confirmAction !== "Approve" && !comments.trim()}
              onClick={() => confirmAction && approveMutation.mutate(confirmAction)}
            >
              Confirm {confirmAction}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disbursement confirmation */}
      <Dialog open={confirmDisburse} onOpenChange={setConfirmDisburse}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm disbursement</DialogTitle>
            <DialogDescription>
              {disbursementMethod === "MobileMoney"
                ? `${formatUGX(application.amount)} will be sent to ${phone} via Mobile Money. This cannot be undone.`
                : `This records that ${formatUGX(application.amount)} was already handed to the member via ${disbursementMethod}. Only confirm if that has genuinely happened — this cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDisburse(false)}>
              Cancel
            </Button>
            <Button loading={disburseMutation.isPending} onClick={() => disburseMutation.mutate()}>
              Confirm disbursement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reverse disbursement confirmation */}
      <Dialog open={confirmReverse} onOpenChange={(open) => { setConfirmReverse(open); if (!open) setReverseReason("") }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reverse this disbursement?</DialogTitle>
            <DialogDescription>
              This deletes the loan record and reverses its ledger entries. The application returns to
              Pending disbursement. This cannot be undone and is permanently recorded in the audit log.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              placeholder="Reason for reversal (required)"
              value={reverseReason}
              onChange={(e) => setReverseReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmReverse(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={reverseMutation.isPending}
              disabled={reverseReason.trim().length < 10}
              onClick={() => reverseMutation.mutate()}
            >
              Confirm reversal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
