"use client"

import Link from "next/link"
import { FileText, PiggyBank, HandCoins, ShieldCheck, Pencil } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/status-badge"
import { EmptyState } from "@/components/dashboard/empty-state"
import { MemberFreezeToggle } from "@/components/dashboard/members/member-freeze-toggle"
import type { LoanDisplayStatus } from "@/lib/loan-status"
import type { StaffRole } from "@/components/dashboard/nav-config"
import { getInitials, formatUGX } from "@/lib/utils"
import { format } from "date-fns"

type MemberDocument = {
  id: string
  type: string
  fileUrl: string
  uploadedAt: string
}

type Guarantor = {
  id: string
  guaranteeAmount: number
  status: string
  createdAt: string
}

type SavingsAccount = {
  id: string
  accountNumber: string
  type: string
  balance: number
  openedAt: string
}

type MemberLoan = {
  id: string
  principal: number
  disbursedAt: string
  productName: string
  displayStatus: LoanDisplayStatus
}

const SAVINGS_TYPE_LABELS: Record<string, string> = {
  Daily: "Daily savings",
  Fixed: "Fixed deposit",
  Shares: "Shares",
}

type MemberDetail = {
  id: string
  memberNumber: string
  firstName: string
  lastName: string
  phone: string
  email: string | null
  nin: string | null
  dob: string | null
  gender: string | null
  occupation: string | null
  employer: string | null
  district: string | null
  subCounty: string | null
  village: string | null
  dateJoined: string
  status: "Active" | "Inactive" | "Suspended"
  photoUrl: string | null
  nextOfKinName: string | null
  nextOfKinPhone: string | null
  emergencyContact: string | null
  withdrawalsFrozen: boolean
  frozenReason: string | null
  branch: { id: string; name: string; code: string }
  documents: MemberDocument[]
  guarantors: Guarantor[]
  savingsAccounts: SavingsAccount[]
  loans: MemberLoan[]
}

const DOCUMENT_LABELS: Record<string, string> = {
  NationalId: "National ID",
  Passport: "Passport",
  UtilityBill: "Utility bill",
  EmploymentLetter: "Employment letter",
  MembershipAgreement: "Membership agreement",
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-(--border-subtle) py-3 text-sm last:border-b-0">
      <span className="text-(--text-secondary)">{label}</span>
      <span className="text-(--text-primary)">{value ?? "—"}</span>
    </div>
  )
}

export function MemberProfileTabs({ member, role }: { member: MemberDetail; role: StaffRole }) {
  const canManageFreeze = role === "SuperAdmin" || role === "Manager"
  const canEdit = ["SuperAdmin", "Manager", "Secretary", "LoanOfficer"].includes(role)

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-4 rounded-lg border border-(--border-subtle) bg-(--bg-card) p-6 sm:flex-row sm:items-start">
        <Avatar className="size-20">
          <AvatarImage src={member.photoUrl ?? undefined} alt={`${member.firstName} ${member.lastName}`} />
          <AvatarFallback className="text-lg">
            {getInitials(`${member.firstName} ${member.lastName}`)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 text-center sm:text-left">
          <h2 className="text-[18px] font-semibold text-(--text-primary)">
            {member.firstName} {member.lastName}
          </h2>
          <p className="font-mono text-sm tabular-nums text-(--text-secondary)">{member.memberNumber}</p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <StatusBadge status={member.status} />
            <span className="text-xs text-(--text-secondary)">{member.branch.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit ? (
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`/dashboard/members/${member.id}/edit`} />}
              nativeButton={false}
              className="gap-1.5"
            >
              <Pencil className="size-3.5" />
              Edit
            </Button>
          ) : null}
          {canManageFreeze ? (
            <MemberFreezeToggle memberId={member.id} withdrawalsFrozen={member.withdrawalsFrozen} frozenReason={member.frozenReason} />
          ) : null}
        </div>
      </div>

      <Tabs defaultValue="summary">
        <TabsList variant="banner">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="savings">Savings</TabsTrigger>
          <TabsTrigger value="loans">Loan History</TabsTrigger>
          <TabsTrigger value="guarantors">Guarantor History</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-(--border-subtle) bg-(--bg-card) p-5">
              <h4 className="mb-2 text-sm font-semibold text-(--text-primary)">Personal</h4>
              <SummaryRow label="Phone" value={member.phone} />
              <SummaryRow label="Email" value={member.email} />
              <SummaryRow label="NIN" value={member.nin} />
              <SummaryRow label="Gender" value={member.gender} />
              <SummaryRow
                label="Date of birth"
                value={member.dob ? format(new Date(member.dob), "PPP") : undefined}
              />
              <SummaryRow label="Date joined" value={format(new Date(member.dateJoined), "PPP")} />
            </div>
            <div className="rounded-lg border border-(--border-subtle) bg-(--bg-card) p-5">
              <h4 className="mb-2 text-sm font-semibold text-(--text-primary)">Employment &amp; location</h4>
              <SummaryRow label="Occupation" value={member.occupation} />
              <SummaryRow label="Employer" value={member.employer} />
              <SummaryRow label="District" value={member.district} />
              <SummaryRow label="Sub-county" value={member.subCounty} />
              <SummaryRow label="Village" value={member.village} />
            </div>
            <div className="rounded-lg border border-(--border-subtle) bg-(--bg-card) p-5 md:col-span-2">
              <h4 className="mb-2 text-sm font-semibold text-(--text-primary)">Next of kin</h4>
              <SummaryRow label="Name" value={member.nextOfKinName} />
              <SummaryRow label="Phone" value={member.nextOfKinPhone} />
              <SummaryRow label="Emergency contact" value={member.emergencyContact} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          {member.documents.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No documents uploaded"
              description="KYC documents for this member will appear here once uploaded."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {member.documents.map((doc) => (
                <a
                  key={doc.id}
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-lg border border-(--border-subtle) bg-(--bg-card) p-4 text-sm transition-colors hover:bg-(--bg-card-hover)"
                >
                  <span className="text-(--text-primary)">{DOCUMENT_LABELS[doc.type] ?? doc.type}</span>
                  <span className="text-xs text-(--text-secondary)">
                    {format(new Date(doc.uploadedAt), "PP")}
                  </span>
                </a>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="savings" className="mt-4">
          {member.savingsAccounts.length === 0 ? (
            <EmptyState
              icon={PiggyBank}
              title="No savings accounts"
              description="Savings accounts opened for this member will appear here."
            />
          ) : (
            <div className="overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-card)">
              {member.savingsAccounts.map((s) => (
                <Link
                  key={s.id}
                  href={`/dashboard/savings/${s.id}`}
                  className="flex items-center justify-between border-b border-(--border-subtle) px-5 py-3 text-sm transition-colors last:border-b-0 hover:bg-(--bg-card-hover)"
                >
                  <div>
                    <p className="font-mono tabular-nums text-(--text-primary)">{s.accountNumber}</p>
                    <p className="text-xs text-(--text-secondary)">
                      {SAVINGS_TYPE_LABELS[s.type] ?? s.type} · Opened {format(new Date(s.openedAt), "PP")}
                    </p>
                  </div>
                  <span className="font-mono tabular-nums text-(--text-primary)">{formatUGX(s.balance)}</span>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="loans" className="mt-4">
          {member.loans.length === 0 ? (
            <EmptyState
              icon={HandCoins}
              title="No loan history"
              description="Applications, approvals, and repayment history will appear here."
            />
          ) : (
            <div className="overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-card)">
              {member.loans.map((loan) => (
                <Link
                  key={loan.id}
                  href={`/dashboard/loans/${loan.id}`}
                  className="flex items-center justify-between border-b border-(--border-subtle) px-5 py-3 text-sm transition-colors last:border-b-0 hover:bg-(--bg-card-hover)"
                >
                  <div>
                    <p className="text-(--text-primary)">{loan.productName}</p>
                    <p className="text-xs text-(--text-secondary)">
                      {formatUGX(loan.principal)} · Disbursed {format(new Date(loan.disbursedAt), "PP")}
                    </p>
                  </div>
                  <StatusBadge status={loan.displayStatus.label} tone={loan.displayStatus.tone} />
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="guarantors" className="mt-4">
          {member.guarantors.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No guarantor history"
              description="Loans this member has guaranteed for others will appear here."
            />
          ) : (
            <div className="overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-card)">
              {member.guarantors.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between border-b border-(--border-subtle) px-5 py-3 text-sm last:border-b-0"
                >
                  <span className="font-mono tabular-nums text-(--text-primary)">
                    {formatUGX(g.guaranteeAmount)}
                  </span>
                  <StatusBadge status={g.status} />
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
