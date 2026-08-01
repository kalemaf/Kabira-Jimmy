"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import dynamic from "next/dynamic"
import {
  PiggyBank,
  Layers,
  HandCoins,
  TrendingUp,
  Calendar,
  Wallet,
  Wallet2,
  Download,
  UserCog,
  PhoneCall,
} from "lucide-react"
import { toast } from "sonner"
import { StatCard } from "@/components/dashboard/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { formatUGX } from "@/lib/utils"

// recharts is heavy (d3 internals) — this is the member's landing page after
// login, so keep it out of the initial bundle and load it only once this
// section is reached, same treatment as the staff dashboard.
const ChartSkeleton = () => <div className="h-[220px] animate-pulse rounded-md bg-(--bg-card-hover)" />
const SavingsGrowthChart = dynamic(() => import("./charts/savings-growth-chart"), { ssr: false, loading: ChartSkeleton })
const MonthlyDepositsChart = dynamic(() => import("./charts/monthly-deposits-chart"), { ssr: false, loading: ChartSkeleton })
const LoanProgressChart = dynamic(() => import("./charts/loan-progress-chart"), { ssr: false, loading: ChartSkeleton })

type DashboardSummary = {
  member: {
    firstName: string
    lastName: string
    memberNumber: string
    status: string
    photoUrl: string | null
    branchName: string
    dateJoined: string
  }
  totalSavingsBalance: number
  sharesBalance: number
  totalDepositsThisMonth: number
  interestEarned: number
  maxEligibleLoan: number
  loan: {
    id: string
    productName: string
    principal: number
    outstandingBalance: number
    totalPayable: number
    repaidAmount: number
    progressPercent: number
    status: string
    tone: "success" | "info" | "warning" | "accent" | "error" | "defaulted"
    nextRepayment: { amount: number; dueDate: string }
  } | null
  monthlyDeposits: { month: string; deposits: number }[]
  savingsGrowth: { month: string; balance: number }[]
}

function QuickAction({
  href,
  onClick,
  icon: Icon,
  label,
}: {
  href?: string
  onClick?: () => void
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  label: string
}) {
  const content = (
    <>
      <Icon className="size-5 text-(--accent-500)" strokeWidth={1.75} />
      <span className="text-sm font-medium text-(--text-primary)">{label}</span>
    </>
  )
  const className =
    "flex flex-col items-center justify-center gap-2 rounded-lg border border-(--border-subtle) bg-(--bg-card) p-5 text-center transition-colors hover:bg-(--bg-card-hover)"
  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  )
}

export function MemberDashboardClient() {
  const { data, isLoading } = useQuery({
    queryKey: ["member-dashboard-summary"],
    queryFn: async () => {
      const res = await fetch("/api/member-portal/dashboard-summary")
      if (!res.ok) throw new Error("Failed to load dashboard")
      return res.json() as Promise<DashboardSummary>
    },
    staleTime: 30_000,
  })

  if (isLoading || !data) {
    return <div className="h-96 animate-pulse rounded-lg bg-(--bg-card)" />
  }

  const loanProgressData = data.loan
    ? [
        { name: "Repaid", value: data.loan.repaidAmount },
        { name: "Outstanding", value: data.loan.outstandingBalance },
      ]
    : []

  return (
    <div className="space-y-8">
      {/* Financial summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Savings Balance" value={formatUGX(data.totalSavingsBalance)} icon={PiggyBank} color="blue" />
        <StatCard label="Available Shares" value={formatUGX(data.sharesBalance)} icon={Layers} color="purple" />
        <StatCard
          label="Loan Balance"
          value={data.loan ? formatUGX(data.loan.outstandingBalance) : "No active loan"}
          icon={HandCoins}
          color="orange"
        />
        <StatCard label="Loan Eligibility" value={formatUGX(data.maxEligibleLoan)} icon={TrendingUp} color="green" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Next Loan Repayment"
          value={data.loan ? `${formatUGX(data.loan.nextRepayment.amount)}` : "—"}
          icon={Calendar}
          color="orange"
        />
        <StatCard label="Interest Earned" value={formatUGX(data.interestEarned)} icon={Wallet2} color="green" />
        <StatCard label="Deposits This Month" value={formatUGX(data.totalDepositsThisMonth)} icon={Wallet} color="blue" />
      </div>

      {data.loan ? (
        <div className="rounded-lg border border-(--border-subtle) bg-(--bg-card) p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-[15px] font-semibold text-(--text-primary)">{data.loan.productName}</h3>
              <p className="text-sm text-(--text-secondary)">
                Next repayment {formatUGX(data.loan.nextRepayment.amount)} due{" "}
                {new Date(data.loan.nextRepayment.dueDate).toLocaleDateString("en-UG")}
              </p>
            </div>
            <StatusBadge status={data.loan.status} tone={data.loan.tone} />
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-(--bg-card-hover)">
            <div
              className="h-full rounded-full bg-(--success-600) transition-all"
              style={{ width: `${data.loan.progressPercent}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-(--text-secondary)">{data.loan.progressPercent}% repaid</p>
        </div>
      ) : null}

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-md border border-(--border-subtle) bg-(--bg-card)">
          <h3 className="border-b border-(--border-subtle) bg-(--bg-card-hover) px-5 py-3 text-[13px] font-semibold text-(--text-primary)">
            Savings growth
          </h3>
          <div className="p-6">
            <SavingsGrowthChart data={data.savingsGrowth} />
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-(--border-subtle) bg-(--bg-card)">
          <h3 className="border-b border-(--border-subtle) bg-(--bg-card-hover) px-5 py-3 text-[13px] font-semibold text-(--text-primary)">
            Monthly deposits
          </h3>
          <div className="p-6">
            <MonthlyDepositsChart data={data.monthlyDeposits} />
          </div>
        </div>
      </div>

      {data.loan ? (
        <div className="overflow-hidden rounded-md border border-(--border-subtle) bg-(--bg-card)">
          <h3 className="border-b border-(--border-subtle) bg-(--bg-card-hover) px-5 py-3 text-[13px] font-semibold text-(--text-primary)">
            Loan repayment progress
          </h3>
          <div className="p-6">
            <LoanProgressChart data={loanProgressData} />
          </div>
        </div>
      ) : null}

      {/* Quick actions */}
      <div>
        <h3 className="mb-3 text-[15px] font-semibold text-(--text-primary)">Quick actions</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <QuickAction href="/member-portal/dashboard/savings/deposit" icon={Wallet} label="Deposit Money" />
          <QuickAction href="/member-portal/dashboard/loans/apply" icon={HandCoins} label="Apply for Loan" />
          <QuickAction href="/member-portal/dashboard/loans" icon={HandCoins} label="Repay Loan" />
          <QuickAction href="/member-portal/dashboard/savings" icon={PiggyBank} label="View Savings" />
          <QuickAction href="/member-portal/dashboard/savings" icon={Download} label="Download Statement" />
          <QuickAction href="/member-portal/dashboard/profile" icon={UserCog} label="Update Profile" />
          <QuickAction
            icon={PhoneCall}
            label="Contact Support"
            onClick={() => toast.message(`Call or visit ${data.member.branchName} for support.`)}
          />
        </div>
      </div>
    </div>
  )
}
