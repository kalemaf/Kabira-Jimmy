import {
  LayoutDashboard,
  Users,
  CreditCard,
  HandCoins,
  FileText,
  Wallet,
  PiggyBank,
  ShieldCheck,
  AlertTriangle,
  Calculator,
  BarChart3,
  Building2,
  UserCog,
  ScrollText,
  Settings,
  CalendarCheck,
  type LucideIcon,
} from "lucide-react"

export type StaffRole =
  | "SuperAdmin"
  | "Manager"
  | "Treasurer"
  | "Secretary"
  | "LoanOfficer"
  | "Cashier"
  | "AccountsOfficer"
  | "RecoveryOfficer"
  | "Auditor"

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  /** Omit to show for every role. */
  roles?: StaffRole[]
}

export type NavSection = {
  label: string
  items: NavItem[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Operations",
    items: [
      { label: "Members", href: "/dashboard/members", icon: Users },
      {
        label: "Loan products",
        href: "/dashboard/loan-products",
        icon: CreditCard,
        roles: ["SuperAdmin", "Manager", "Auditor"],
      },
      { label: "Loans", href: "/dashboard/loans", icon: HandCoins },
      {
        label: "Applications",
        href: "/dashboard/loans/applications",
        icon: FileText,
        roles: [
          "SuperAdmin",
          "Manager",
          "Treasurer",
          "Secretary",
          "LoanOfficer",
          "Cashier",
          "Auditor",
        ],
      },
      {
        label: "Repayments",
        href: "/dashboard/repayments",
        icon: Wallet,
        roles: ["SuperAdmin", "Manager", "Cashier", "LoanOfficer", "Auditor"],
      },
      {
        label: "Savings",
        href: "/dashboard/savings",
        icon: PiggyBank,
        roles: ["SuperAdmin", "Manager", "Cashier", "AccountsOfficer", "Auditor"],
      },
      {
        label: "Savings overview",
        href: "/dashboard/savings/overview",
        icon: CalendarCheck,
        roles: ["SuperAdmin", "Manager"],
      },
      { label: "Guarantors", href: "/dashboard/guarantors", icon: ShieldCheck },
      {
        label: "Recovery",
        href: "/dashboard/recovery",
        icon: AlertTriangle,
        roles: ["SuperAdmin", "Manager", "RecoveryOfficer", "Auditor"],
      },
    ],
  },
  {
    label: "Finance",
    items: [
      {
        label: "Accounting",
        href: "/dashboard/accounting",
        icon: Calculator,
        roles: ["SuperAdmin", "AccountsOfficer", "Auditor"],
      },
      {
        label: "Reports",
        href: "/dashboard/reports",
        icon: BarChart3,
        roles: ["SuperAdmin", "Manager", "AccountsOfficer", "Auditor"],
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        label: "Branches",
        href: "/dashboard/branches",
        icon: Building2,
        roles: ["SuperAdmin", "Manager"],
      },
      { label: "Staff", href: "/dashboard/staff", icon: UserCog, roles: ["SuperAdmin"] },
      {
        label: "Audit log",
        href: "/dashboard/audit-log",
        icon: ScrollText,
        roles: ["SuperAdmin", "Auditor"],
      },
      { label: "Settings", href: "/dashboard/settings", icon: Settings, roles: ["SuperAdmin"] },
    ],
  },
]

export function navSectionsForRole(role: StaffRole): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.roles || item.roles.includes(role)),
  })).filter((section) => section.items.length > 0)
}

export const ROLE_LABELS: Record<StaffRole, string> = {
  SuperAdmin: "Super Administrator",
  Manager: "Manager",
  Treasurer: "Treasurer",
  Secretary: "Secretary",
  LoanOfficer: "Loan Officer",
  Cashier: "Cashier",
  AccountsOfficer: "Accounts Officer",
  RecoveryOfficer: "Recovery Officer",
  Auditor: "Auditor",
}

/** Roles with cross-branch, head-office visibility. */
export const HEAD_OFFICE_ROLES: StaffRole[] = ["SuperAdmin", "Manager"]
