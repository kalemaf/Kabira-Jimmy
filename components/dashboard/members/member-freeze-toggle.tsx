"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

export function MemberFreezeToggle({
  memberId,
  withdrawalsFrozen,
  frozenReason,
}: {
  memberId: string
  withdrawalsFrozen: boolean
  frozenReason: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [reason, setReason] = React.useState("")

  const mutation = useMutation({
    mutationFn: async (frozen: boolean) => {
      const res = await fetch(`/api/members/${memberId}/freeze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(frozen ? { frozen: true, reason } : { frozen: false }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error?.formErrors?.[0] ?? body.error ?? "Failed to update")
      }
      return res.json()
    },
    onSuccess: (_data, frozen) => {
      toast.success(frozen ? "Withdrawals frozen" : "Withdrawals unfrozen")
      setOpen(false)
      setReason("")
      router.refresh()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (withdrawalsFrozen) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-(--error-600)/30 bg-(--error-soft) p-4">
        <ShieldAlert className="size-5 shrink-0 text-(--error-600)" strokeWidth={1.75} />
        <div className="flex-1">
          <p className="text-sm font-medium text-(--text-primary)">Withdrawals frozen</p>
          <p className="text-xs text-(--text-secondary)">{frozenReason}</p>
        </div>
        <Button size="sm" variant="outline" loading={mutation.isPending} onClick={() => mutation.mutate(false)}>
          Unfreeze
        </Button>
      </div>
    )
  }

  return (
    <>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
        <ShieldAlert className="size-4" />
        Freeze withdrawals
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Freeze withdrawals</DialogTitle>
            <DialogDescription>
              Blocks every self-service Mobile Money withdrawal for this member (deposits and loans stay
              unaffected) — use this for accounts under investigation.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason (required — shown to the member and recorded in the audit log)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={reason.trim().length < 3}
              loading={mutation.isPending}
              onClick={() => mutation.mutate(true)}
            >
              Freeze withdrawals
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

