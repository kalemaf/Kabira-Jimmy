import Link from "next/link"
import Image from "next/image"
import {
  ShieldCheck,
  Calculator,
  Building2,
  UserPlus,
  ClipboardCheck,
  Wallet,
  FileCheck2,
  Lock,
  History,
  Fingerprint,
  DatabaseBackup,
  ArrowRight,
  GitBranch,
  Smartphone,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"

const FEATURES = [
  {
    icon: ShieldCheck,
    color: "blue",
    title: "Maker-checker approval",
    description:
      "Every loan moves through Secretary, Treasurer, and Manager review before disbursement — with a full audit trail at each stage.",
  },
  {
    icon: Calculator,
    color: "green",
    title: "Automatic interest & penalties",
    description:
      "Flat, reducing balance, and declining interest methods compute amortization schedules and late penalties without manual spreadsheets.",
  },
  {
    icon: Building2,
    color: "orange",
    title: "Multi-branch operations",
    description:
      "Unlimited branches, each with its own cashbook and staff, rolling up to a single head-office view across the SACCO.",
  },
] as const

const STEPS = [
  {
    icon: UserPlus,
    title: "Register members & branches",
    description:
      "Capture full KYC — identity, address, next of kin — for every member and staff account from day one.",
  },
  {
    icon: ClipboardCheck,
    title: "Apply, review, approve",
    description:
      "Loan officers submit applications; Secretary, Treasurer, and Manager sign off in sequence before a shilling moves.",
  },
  {
    icon: Wallet,
    title: "Disburse, repay, track",
    description:
      "Cash, bank, or mobile money disbursement, with repayments, penalties, and balances updating automatically.",
  },
]

const STATS = [
  { icon: GitBranch, value: "3-stage", label: "Maker-checker approval chain" },
  { icon: Users, value: "24/7", label: "Member self-service portal" },
  {
    icon: Smartphone,
    value: "MTN & Airtel",
    label: "Native Mobile Money support",
  },
  { icon: Building2, value: "Unlimited", label: "Branches on one system" },
] as const

const FAQS = [
  {
    question:
      "How does maker-checker actually stop one person from moving money alone?",
    answer:
      "Every loan application moves through a fixed approval chain — Secretary, Treasurer, and Manager for staff-prepared applications, or Loan Officer then Manager for member self-service ones — before it can be disbursed. Whoever prepared or requested an application can never be the one who approves it, and every step is written to a permanent audit log.",
  },
  {
    question: "Can members apply for loans and manage savings themselves?",
    answer:
      "Yes. The member portal lets a member apply for a loan, track it through approval, deposit or withdraw savings, and repay a loan — all without visiting a branch. Everything they do still flows through the same approval and audit trail staff transactions do.",
  },
  {
    question: "Does it support Mobile Money?",
    answer:
      "Yes — MTN and Airtel Mobile Money are supported natively for savings deposits, loan repayments, and loan disbursement. A payout is never marked complete until the mobile money provider actually confirms it, so a failed or pending transaction can never be mistaken for a successful one.",
  },
  {
    question: "What happens if a Mobile Money payment fails partway through?",
    answer:
      "Nothing is assumed to have succeeded until it's confirmed. A pending transaction is reconciled against the provider's own record before any balance changes, and staff can flag and track a disputed transaction directly against the loan or account it relates to until it's resolved.",
  },
  {
    question: "Can we run more than one branch from a single system?",
    answer:
      "Yes — branches are unlimited. Each branch keeps its own cashbook, staff, and members, while a head-office view rolls everything up across the whole SACCO.",
  },
  {
    question: "Is our members' data secure?",
    answer:
      "Sessions are encrypted, sign-in is rate-limited against brute-force attempts, and every sensitive action — approvals, disbursements, edits to a member's record — is written to an audit trail showing who did what, when, and from where.",
  },
] as const

const TRUST_POINTS = [
  { icon: FileCheck2, text: "Maker-checker on every disbursement" },
  { icon: History, text: "Full audit trail — who, when, from where" },
  { icon: Fingerprint, text: "KYC-verified staff and member onboarding" },
  { icon: Lock, text: "Encrypted sessions, rate-limited logins" },
  { icon: DatabaseBackup, text: "Daily encrypted backups" },
  { icon: ShieldCheck, text: "National ID verification on applications" },
]

const ICON_CHIP: Record<(typeof FEATURES)[number]["color"], string> = {
  blue: "bg-(--accent-soft) text-(--brand-blue)",
  green:
    "bg-[color-mix(in_srgb,var(--brand-green)_14%,transparent)] text-(--brand-green)",
  orange:
    "bg-[color-mix(in_srgb,var(--brand-orange)_16%,transparent)] text-(--brand-orange)",
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-(--bg-canvas)">
      <header className="sticky top-0 z-40 border-b border-(--border-subtle) bg-(--bg-canvas)/80 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-[1200px] items-center justify-between px-4 md:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size="lg" />
            <span className="text-[20px] font-bold tracking-[-0.01em] text-(--text-primary)">
              nexcgen
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <a
              href="#features"
              className="rounded-full px-4 py-2.5 text-[15px] font-medium text-(--text-secondary) transition-colors hover:bg-(--accent-soft) hover:text-(--brand-blue)"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="rounded-full px-4 py-2.5 text-[15px] font-medium text-(--text-secondary) transition-colors hover:bg-(--accent-soft) hover:text-(--brand-blue)"
            >
              How it works
            </a>
            <a
              href="#security"
              className="rounded-full px-4 py-2.5 text-[15px] font-medium text-(--text-secondary) transition-colors hover:bg-(--accent-soft) hover:text-(--brand-blue)"
            >
              Security
            </a>
            <a
              href="#faq"
              className="rounded-full px-4 py-2.5 text-[15px] font-medium text-(--text-secondary) transition-colors hover:bg-(--accent-soft) hover:text-(--brand-blue)"
            >
              FAQ
            </a>
          </nav>
          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <Button
              size="sm"
              variant="outline"
              render={<Link href="/member-portal/login" />}
              nativeButton={false}
              className="hidden border-(--brand-blue)/40 text-[15px] font-medium text-(--brand-blue) hover:bg-(--accent-soft) sm:inline-flex"
            >
              Member portal
            </Button>
            <Button
              size="sm"
              render={<Link href="/auth/sign-in" />}
              nativeButton={false}
              className="bg-brand-gradient border-0 text-[15px] font-medium text-white hover:opacity-90"
            >
              Staff login
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden px-4 py-16 md:px-8 md:py-24">
        <div className="mx-auto grid max-w-[1300px] grid-cols-1 items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-8">
          <div>
            <h1 className="text-[38px] leading-[1.08] font-bold tracking-[-0.02em] text-(--text-primary) sm:text-[52px]">
              Smart savings.
              <br />
              Better loans.
              <br />
              <span className="text-brand-gradient">Stronger tomorrow.</span>
            </h1>
            <p className="mt-5 max-w-[480px] text-base leading-[1.6] text-(--text-secondary) sm:text-[17px]">
              Manage savings, loans, and repayments securely — all in one place,
              with a full audit trail and maker-checker discipline at every
              step.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Button
                size="lg"
                render={<Link href="/auth/sign-in" />}
                nativeButton={false}
                className="bg-brand-gradient gap-1.5 rounded-full border-0 text-white hover:opacity-90"
              >
                Staff login
                <ArrowRight className="size-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                render={<Link href="/member-portal/login" />}
                nativeButton={false}
                className="rounded-full"
              >
                Member portal
              </Button>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2">
              {["Audit-trailed", "Maker-checker", "Multi-branch"].map(
                (label) => (
                  <span
                    key={label}
                    className="flex items-center gap-1.5 text-sm text-(--text-secondary)"
                  >
                    <ShieldCheck
                      className="size-4 text-(--accent-500)"
                      strokeWidth={1.75}
                    />
                    {label}
                  </span>
                )
              )}
            </div>
          </div>

          <div className="relative aspect-[6/5]">
            <Image
              src="/display.png"
              alt="The Nexcgen team"
              fill
              priority
              sizes="(min-width: 1024px) 600px, 100vw"
              className="hero-photo-fade object-cover object-right"
            />
          </div>
        </div>
      </section>

      <section className="border-y border-(--border-subtle) px-4 py-10 md:px-8">
        <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-8 sm:grid-cols-4">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col items-center gap-1.5 text-center sm:items-start sm:text-left"
            >
              <stat.icon
                className="size-5 text-(--accent-500)"
                strokeWidth={1.75}
              />
              <span className="text-[20px] font-bold tracking-[-0.01em] text-(--text-primary)">
                {stat.value}
              </span>
              <span className="text-xs leading-[1.4] text-(--text-secondary)">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section
        id="features"
        className="border-y border-(--border-subtle) bg-(--bg-surface) px-4 py-24 md:px-8"
      >
        <div className="mx-auto max-w-[1200px]">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-[28px] font-semibold tracking-[-0.015em] text-(--text-primary) sm:text-[32px]">
              Everything a SACCO needs, in one place
            </h2>
            <p className="mt-3 text-(--text-secondary)">
              Built around how SACCOs actually operate — branches, approval
              chains, and cash.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-(--border-subtle) bg-(--bg-card) p-8"
              >
                <div
                  className={`flex size-10 items-center justify-center rounded-[0.625rem] ${ICON_CHIP[feature.color]}`}
                >
                  <feature.icon className="size-5" strokeWidth={1.75} />
                </div>
                <h3 className="mt-4 text-[18px] font-semibold text-(--text-primary)">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-[1.55] text-(--text-secondary)">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="px-4 py-24 md:px-8">
        <div className="mx-auto max-w-[1200px]">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-[28px] font-semibold tracking-[-0.015em] text-(--text-primary) sm:text-[32px]">
              How it works
            </h2>
            <p className="mt-3 text-(--text-secondary)">
              From onboarding to repayment, every step is tracked.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                className="relative text-center sm:text-left"
              >
                <div className="bg-brand-gradient mx-auto flex size-11 items-center justify-center rounded-full text-[15px] font-bold text-white sm:mx-0">
                  {i + 1}
                </div>
                <step.icon
                  className="mt-4 size-5 text-(--text-muted)"
                  strokeWidth={1.75}
                />
                <h3 className="mt-2 text-[16px] font-semibold text-(--text-primary)">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-[1.55] text-(--text-secondary)">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-24 md:px-8">
        <div className="mx-auto max-w-[1200px]">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-[28px] font-semibold tracking-[-0.015em] text-(--text-primary) sm:text-[32px]">
              See it in action
            </h2>
            <p className="mt-3 text-(--text-secondary)">
              A real dashboard, not a spreadsheet — everything a branch needs on
              one screen.
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-[1200px] grid-cols-1 items-center gap-8 lg:grid-cols-2">
            <div className="overflow-hidden rounded-xl border border-(--border-subtle) bg-(--bg-card) shadow-lg">
              <div className="flex items-center gap-2 border-b border-(--border-subtle) bg-(--bg-surface) px-4 py-3">
                <span className="size-2.5 rounded-full bg-(--error-600)" />
                <span className="size-2.5 rounded-full bg-(--warning-600)" />
                <span className="size-2.5 rounded-full bg-(--success-600)" />
                <span className="ml-3 truncate rounded-md bg-(--bg-card) px-3 py-1 text-xs text-(--text-muted)">
                  nexcgen.efficraftconsultants.com/dashboard
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
                <div className="rounded-lg border border-(--border-subtle) p-4">
                  <p className="text-xs text-(--text-secondary)">
                    Outstanding balance
                  </p>
                  <p className="mt-1 text-[20px] font-bold text-(--text-primary)">
                    UGX 4,820,000
                  </p>
                </div>
                <div className="rounded-lg border border-(--border-subtle) p-4">
                  <p className="text-xs text-(--text-secondary)">
                    Active loans
                  </p>
                  <p className="mt-1 text-[20px] font-bold text-(--text-primary)">
                    128
                  </p>
                </div>
                <div className="rounded-lg border border-(--border-subtle) p-4">
                  <p className="text-xs text-(--text-secondary)">Members</p>
                  <p className="mt-1 text-[20px] font-bold text-(--text-primary)">
                    642
                  </p>
                </div>
              </div>
              <div className="border-t border-(--border-subtle) px-5 pb-5">
                <div className="mt-4 overflow-hidden rounded-lg border border-(--border-subtle)">
                  <div className="bg-brand-gradient grid grid-cols-4 gap-2 px-4 py-2.5 text-[11px] font-semibold tracking-wide text-white uppercase">
                    <span>Member</span>
                    <span>Principal</span>
                    <span>Next due</span>
                    <span>Status</span>
                  </div>
                  {[
                    {
                      name: "Jimmy",
                      principal: "UGX 600,000",
                      due: "02/10/2026",
                      status: "Active",
                    },
                    {
                      name: "Kabira Jimmy",
                      principal: "UGX 20,000",
                      due: "30/09/2026",
                      status: "Due in 4d",
                    },
                  ].map((row) => (
                    <div
                      key={row.name}
                      className="grid grid-cols-4 gap-2 border-t border-(--border-subtle) px-4 py-2.5 text-sm text-(--text-primary)"
                    >
                      <span className="truncate">{row.name}</span>
                      <span className="font-mono text-xs tabular-nums">
                        {row.principal}
                      </span>
                      <span className="text-xs">{row.due}</span>
                      <span>
                        <span className="rounded-full bg-(--accent-soft) px-2 py-0.5 text-[11px] font-medium text-(--brand-blue)">
                          {row.status}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-(--border-subtle) shadow-lg">
                <Image
                  src="/money.png"
                  alt="A member sending a Mobile Money payment at the branch counter, with a confirmed transaction shown on their phone"
                  fill
                  sizes="(min-width: 1024px) 560px, 100vw"
                  className="object-cover"
                />
              </div>
              <p className="mt-3 text-center text-sm text-(--text-secondary) lg:text-left">
                MTN and Airtel Mobile Money, confirmed in real time — never
                marked paid until the provider actually says so.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        id="security"
        className="border-y border-(--border-subtle) bg-(--bg-surface) px-4 py-24 md:px-8"
      >
        <div className="mx-auto max-w-[1200px]">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-[28px] font-semibold tracking-[-0.015em] text-(--text-primary) sm:text-[32px]">
              Built for accountability
            </h2>
            <p className="mt-3 text-(--text-secondary)">
              Every SACCO worries about money going missing. Here&apos;s what
              stands in the way.
            </p>
          </div>
          <div className="mx-auto mt-12 grid max-w-[900px] grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
            {TRUST_POINTS.map((point) => (
              <div
                key={point.text}
                className="flex items-center gap-3 rounded-lg border border-(--border-subtle) bg-(--bg-card) p-4"
              >
                <point.icon
                  className="size-5 shrink-0 text-(--accent-500)"
                  strokeWidth={1.75}
                />
                <span className="text-sm font-medium text-(--text-primary)">
                  {point.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="px-4 py-24 md:px-8">
        <div className="mx-auto max-w-[760px]">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-[28px] font-semibold tracking-[-0.015em] text-(--text-primary) sm:text-[32px]">
              Frequently asked questions
            </h2>
            <p className="mt-3 text-(--text-secondary)">
              What SACCO boards and staff usually ask before switching over.
            </p>
          </div>
          <Accordion className="mt-10">
            {FAQS.map((faq) => (
              <AccordionItem key={faq.question} value={faq.question}>
                <AccordionTrigger>{faq.question}</AccordionTrigger>
                <AccordionContent>{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <section className="bg-brand-gradient px-4 py-20 text-center md:px-8">
        <h2 className="mx-auto max-w-xl text-[26px] font-semibold tracking-[-0.015em] text-white sm:text-[32px]">
          Ready to bring your operations into one system?
        </h2>
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button
            size="lg"
            render={<Link href="/auth/sign-in" />}
            nativeButton={false}
            className="bg-white text-(--text-primary) hover:bg-white/90"
          >
            Staff login
          </Button>
          <Button
            size="lg"
            variant="outline"
            render={<Link href="/member-portal/login" />}
            nativeButton={false}
            className="border-white/40 text-white hover:bg-white/10"
          >
            Member portal
          </Button>
        </div>
      </section>

      <footer className="border-t border-(--border-subtle) px-4 py-16 md:px-8">
        <div className="mx-auto max-w-[1200px]">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Link href="/" className="flex items-center gap-2.5">
                <Logo />
                <span className="text-[17px] font-bold tracking-[-0.01em] text-(--text-primary)">
                  nexcgen
                </span>
              </Link>
              <p className="mt-3 max-w-[220px] text-sm leading-[1.55] text-(--text-secondary)">
                Loan &amp; savings management, run with discipline.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-(--text-primary)">
                Product
              </h4>
              <nav className="mt-3 flex flex-col gap-2.5">
                <a
                  href="#features"
                  className="text-sm text-(--text-secondary) transition-colors hover:text-(--text-primary)"
                >
                  Features
                </a>
                <a
                  href="#how-it-works"
                  className="text-sm text-(--text-secondary) transition-colors hover:text-(--text-primary)"
                >
                  How it works
                </a>
                <a
                  href="#security"
                  className="text-sm text-(--text-secondary) transition-colors hover:text-(--text-primary)"
                >
                  Security
                </a>
              </nav>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-(--text-primary)">
                Access
              </h4>
              <nav className="mt-3 flex flex-col gap-2.5">
                <Link
                  href="/auth/sign-in"
                  className="text-sm text-(--text-secondary) transition-colors hover:text-(--text-primary)"
                >
                  Staff login
                </Link>
                <Link
                  href="/member-portal/login"
                  className="text-sm text-(--text-secondary) transition-colors hover:text-(--text-primary)"
                >
                  Member portal
                </Link>
              </nav>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-(--text-primary)">
                Contact
              </h4>
              <nav className="mt-3 flex flex-col gap-2.5">
                <a
                  href="https://www.efficraftconsultants.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-(--text-secondary) transition-colors hover:text-(--text-primary)"
                >
                  www.efficraftconsultants.com
                </a>
                <a
                  href="mailto:info@kfmms.com"
                  className="text-sm text-(--text-secondary) transition-colors hover:text-(--text-primary)"
                >
                  info@kfmms.com
                </a>
              </nav>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-(--border-subtle) pt-8 text-center sm:flex-row sm:text-left">
            <p className="text-[13px] text-(--text-secondary)">
              Managed by{" "}
              <span className="font-medium text-(--text-primary)">
                Efficraft Consultants Limited
              </span>
            </p>
            <p className="text-[13px] text-(--text-secondary)">
              &copy; {new Date().getFullYear()} Efficraft Consultants Limited.
              All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
