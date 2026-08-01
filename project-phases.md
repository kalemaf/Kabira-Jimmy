# NextGen SACCO — Build Phases

## Phase 1 — Foundation
**Goal:** Project scaffolded, design system applied, env files created, database connected, Redis cache configured, staff auth working.

### Tasks
- [ ] Initialize Next.js 16 + shadcn/ui in ONE step: `pnpm dlx shadcn@latest init --preset b0 --template next`. **Do NOT use `--src-dir`** — the framework requires a flat root layout (`app/`, `components/`, `lib/` at the project root, no `src/` wrapper). If you fall back to `pnpm create next-app`, pass `--no-src-dir`.
- [ ] Confirm the resulting tsconfig has `"paths": { "@/*": ["./*"] }` (NOT `["./src/*"]`).
- [ ] Install the Form shadcn fallback: `pnpm dlx shadcn@latest add https://vibekit.desishub.com/r/form.json`. Every React Hook Form + Zod form (member registration, loan application, repayment) imports from `@/components/ui/form`.
- [ ] Create `.env.example` (committed) and `.env.local` (gitignored) with EVERY env var this project needs: `DATABASE_URL`, `UPSTASH_REDIS_URL`, `UPSTASH_REDIS_TOKEN`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_R2_ENDPOINT`, `CLOUDFLARE_R2_BUCKET_NAME`, `CLOUDFLARE_R2_PUBLIC_DEV_URL`, `DGATEWAY_API_URL`, `DGATEWAY_API_KEY`, `SMS_PROVIDER_API_KEY`, `SMS_PROVIDER_SENDER_ID`, `WHATSAPP_API_KEY`. Each var commented with what it is and where to get it.
- [ ] Add `.env.local` to `.gitignore`
- [ ] Set up Prisma v7 with Neon PostgreSQL (schema, config, db client, adapter-pg)
- [ ] Set up Upstash Redis cache client in `lib/cache.ts` with `getCachedOrFetch()` and `invalidateTag()` wrappers. Add `@upstash/redis` to dependencies.
- [ ] Apply design-style-guide.md tokens to globals.css (Tailwind v4 CSS-first config — @theme directive, no tailwind.config.ts)
- [ ] Create root layout with correct font, QueryClientProvider, ThemeProvider + next-themes (dark mode is required for this project)
- [ ] Build sidebar layout (collapsible, role-scoped nav items, user section, dark mode toggle, branch selector for head-office users)
- [ ] Build page header component (breadcrumb + title + global search + notifications bell + actions)
- [ ] Install JB Better Auth UI: `pnpm dlx shadcn@latest add https://better-auth-ui.desishub.com/r/auth-components.json`
- [ ] **Integrate installed auth files into existing routes — do NOT overwrite existing `page.tsx` or `layout.tsx`. Edit and merge.**
- [ ] Extend Better Auth with a custom `role` field (enum: SuperAdmin, Manager, Treasurer, Secretary, LoanOfficer, Cashier, AccountsOfficer, RecoveryOfficer, Auditor) and a `branchId` field on the Staff/User model.
- [ ] Configure Better Auth env vars (BETTER_AUTH_SECRET, BETTER_AUTH_URL)
- [ ] Create protected route middleware (middleware.ts) — edge-level auth check before `/dashboard` renders, plus role-based route guards (e.g. only Auditor/SuperAdmin can hit `/dashboard/audit-log`)
- [ ] Set up a **separate member-portal auth flow** at `/member-portal/*` (Better Auth supports multiple session scopes — keep staff and member sessions distinct)
- [ ] Build custom 404, error, and loading pages
- [ ] Verify: staff login, role-based redirect, member portal login, protected routes all work

### Dependencies
- Neon database created, DATABASE_URL set in .env.local
- Upstash Redis database created, UPSTASH_REDIS_URL and UPSTASH_REDIS_TOKEN set in .env.local
- Resend account created, RESEND_API_KEY set (for auth emails)
- Cloudflare R2 bucket created with credentials

---

## Phase 2 — Members, Loan Products & Core Data
**Goal:** Member registration, document capture, and loan product configuration fully working.

### Tasks
- [ ] Define Prisma schema for: Branch, Member, MemberDocument, LoanProduct, Guarantor, Collateral (per data model in project-description.md)
- [ ] Run database migration: `pnpm db:push && pnpm db:generate`
- [ ] Create `prisma/seed.ts` with 50+ realistic records: multiple branches, staff across all 9 roles, 50+ members with varied statuses, 6+ loan products, sample guarantors. Add `"db:seed": "tsx prisma/seed.ts"` to scripts.
- [ ] Run seed: `pnpm db:seed`
- [ ] Install JB Data Table: `pnpm dlx shadcn@latest add https://jb.desishub.com/r/data-table.json`
- [ ] Install Searchable Select: `pnpm dlx shadcn@latest add https://jb.desishub.com/r/searchable-select.json`
- [ ] Install File Storage UI (R2): `pnpm dlx shadcn@latest add https://file-storage.desishub.com/r/file-storage.json`
- [ ] Install Advanced Form Elements (phone input): `pnpm dlx shadcn@latest add https://vibekit.desishub.com/r/advanced-form-elements.json`
- [ ] Build API routes with Redis caching (`getCachedOrFetch` + `invalidateTag`) and server-side pagination for: `/api/members`, `/api/branches`, `/api/loan-products`, `/api/guarantors`
- [ ] Build member registration form (multi-section: personal info, employment, next of kin, document uploads) with React Hook Form + Zod, wrapped in Suspense + ErrorBoundary
- [ ] Build member list page with Data Table (search by name/phone/NIN/member number, filter by branch/status, Excel + PDF export)
- [ ] Build member profile page with tabs: Summary, Documents, Savings, Loan History, Guarantor History
- [ ] Build loan product configuration list + create/edit form (interest rate, min/max, period, fees, penalty rate, interest method)
- [ ] Build branch management page (head office only)
- [ ] Add stat cards for dashboard overview (total members, total branches placeholders — full KPIs land in Phase 3)
- [ ] Add empty states and loading skeletons for all pages
- [ ] Verify: every GET route caches via Redis, every mutation invalidates the cache

### Dependencies
- Phase 1 complete (auth + layout + RBAC working)

---

## Phase 3 — Loan Lifecycle & Approval Workflow
**Goal:** Loan applications flow through the full maker-checker pipeline with automatic calculation and audit logging.

### Tasks
- [ ] Define Prisma schema for: LoanApplication, ApprovalStep, Loan, Repayment, RecoveryCase, AuditLog
- [ ] Run migration: `pnpm db:push && pnpm db:generate`
- [ ] Install Multi-Step Form for the loan application wizard: `pnpm dlx shadcn@latest add https://vibekit.desishub.com/r/multi-step-form.json`
- [ ] Install Printable Templates (loan agreements, receipts): `pnpm dlx shadcn@latest add https://vibekit.desishub.com/r/printable-templates.json`
- [ ] Build the loan calculator engine in `lib/loan-calculator.ts` — supports flat rate, reducing balance, declining balance, compound, and custom formulas; produces full amortization schedules; pure functions, fully unit-testable
- [ ] Build the eligibility/risk-check engine in `lib/loan-eligibility.ts` — checks savings balance, existing exposure, guarantor availability, delinquency history, member status; returns a risk score
- [ ] Build loan application form (multi-step wizard): amount, purpose, product, period, guarantors, collateral, documents — auto-runs eligibility check on submit
- [ ] Build the approval queue screen — role-scoped (`/dashboard/loans/applications`), shows only applications at the current user's approval stage
- [ ] Build the approval action screen — Approve / Reject / Return with comments; on every action, write an `ApprovalStep` record (user, stage, action, comments, IP, timestamp) AND an `AuditLog` entry
- [ ] Implement the 4-stage state machine: Secretary review → Treasurer review → Manager review → Disbursement (Loan Officer/Cashier). Enforce that a user can only act at their own role's stage (maker-checker: the approver at each stage must differ from the applicant/preparer).
- [ ] Build disbursement screen — on disbursement, create the `Loan` record, generate the amortization schedule, and (if Mobile Money) trigger a DGateway payout
- [ ] Build the digital loan agreement generator using Printable Templates + `@react-pdf/renderer`, with an electronic signature capture field
- [ ] Build loan detail page: amortization schedule, repayment history, guarantors, collateral, documents, current status
- [ ] Build loans list page with Data Table — color-coded status column (Green/Yellow/Orange/Red/Dark Red) computed from due dates
- [ ] Build repayment collection screen — accepts cash/bank/mobile money/cheque/online, auto-splits into principal/interest/penalty, generates a receipt (Printable Templates), updates loan balance
- [ ] Wire DGateway for Mobile Money repayment collection and loan disbursement payouts
- [ ] Build guarantor exposure view — shows guarantee amount vs. available savings vs. current exposure across all guaranteed loans; auto-flag/block guarantor when limit exceeded
- [ ] Implement the automatic penalty engine — a scheduled job (Vercel Cron) that runs daily, flags overdue loans, calculates penalty/additional interest, and queues notifications
- [ ] Verify: a loan can move from application through all 4 approval stages to disbursement to repayment, with every step in the audit log

### Dependencies
- Phase 2 complete (members, loan products, branches exist)

---

## Phase 4 — Savings, Accounting & Recovery
**Goal:** Savings accounts, general ledger, and recovery tracking are fully functional.

### Tasks
- [ ] Define Prisma schema for: SavingsAccount, SavingsTransaction, LedgerEntry
- [ ] Run migration: `pnpm db:push && pnpm db:generate`
- [ ] Build savings account creation + list page (daily / fixed / shares)
- [ ] Build deposit/withdrawal transaction screen (Cashier role), auto-updates balance, writes AuditLog entry
- [ ] Build savings account detail page with statement/passbook view (Printable Templates)
- [ ] Build the accounting module: chart of accounts, general ledger entry list, cash book, bank book
- [ ] Build trial balance, income statement, and balance sheet report views, computed from LedgerEntry data
- [ ] Build the Recovery module: auto-generated defaulter list (loans past due beyond grace period), recovery officer assignment, visit scheduling, recovery notes, payment-promise tracking, recovered-amount logging, legal-action flag, blacklist toggle
- [ ] Wire loan status changes (overdue → defaulted) to auto-create a RecoveryCase and assign to a Recovery Officer
- [ ] Verify: a deposit correctly increases savings balance and appears in the passbook; a defaulted loan correctly appears in the Recovery module

### Dependencies
- Phase 3 complete (loans exist to reconcile against)

---

## Phase 5 — Notifications, Reporting & Dashboard Analytics
**Goal:** Full dashboard KPIs, multi-channel notifications, and the complete reporting suite are live.

### Tasks
- [ ] Install Charts & Dashboard Grid: `pnpm dlx shadcn@latest add https://vibekit.desishub.com/r/charts-grid.json`
- [ ] Install Notification Center: `pnpm dlx shadcn@latest add https://vibekit.desishub.com/r/notification-center.json`
- [ ] Install Command Palette (staff power-user navigation): `pnpm dlx shadcn@latest add https://vibekit.desishub.com/r/command-palette.json`
- [ ] Configure Resend + React Email for notification emails (due date reminders, approval/rejection, disbursement, late payment, penalty, membership expiry)
- [ ] Build the SMS/WhatsApp provider adapter in `lib/notifications.ts` — pluggable interface so the actual provider (e.g. Africa's Talking) can be swapped via env vars
- [ ] Wire the daily penalty-engine cron job (from Phase 3) to also trigger SMS/Email/WhatsApp reminders and escalate to Manager/Recovery Officer on default
- [ ] Build the full dashboard: Total Members, Total Savings, Total Loans, Outstanding Loans, Active/Overdue Loans, Today's Collections/Deposits/Withdrawals, Expected Collections, Interest Earned, Monthly/Net Profit, Operational Expenses, Cash Flow, Portfolio at Risk (PAR), Loan Recovery Rate, Default Rate — with pie/bar/line charts, branch performance comparison, top borrowers/defaulters/savers, recent transactions feed
- [ ] Build the reporting center — Loan, Savings, Member, Profit, Interest, Penalty, Cash Flow, Balance Sheet, Income Statement, Audit, Defaulters, Collection, Loan Officer Performance, Branch Performance, Member Statement, and Guarantor reports, each exportable as PDF (via @react-pdf/renderer), Excel (via xlsx), and CSV, filterable by daily/weekly/monthly/quarterly/yearly
- [ ] Build the audit log viewer (`/dashboard/audit-log`), Auditor + Super Admin only, filterable by user/action/date/entity
- [ ] Build global search (member name, phone, NIN, loan number, member number, receipt number, transaction number)
- [ ] Verify: dashboard KPIs match underlying data, all report exports produce correctly formatted files, notifications fire on the correct triggers

### Dependencies
- Phase 4 complete (savings + accounting + recovery data exists to report on)

---

## Phase 6 — Member Portal
**Goal:** Members can self-serve: view accounts, apply for loans, download statements.

### Tasks
- [ ] Build `/member-portal/dashboard` — savings summary, active loans, notifications
- [ ] Build `/member-portal/loans` — list of the member's own loans with status
- [ ] Build `/member-portal/loans/apply` — member-facing loan application (reuses the Multi-Step Form from Phase 3, submits into the same approval pipeline starting at Secretary review)
- [ ] Build `/member-portal/statements` — downloadable PDF savings/loan statements (Printable Templates)
- [ ] Build `/member-portal/profile` — profile view/update (contact info only; KYC document changes require staff approval)
- [ ] Ensure member-portal routes are scoped strictly to the logged-in member's own data (no cross-member data leakage — enforce at the query layer, not just the UI)
- [ ] Verify: a member can log in, apply for a loan, and see it appear in the staff-side Secretary approval queue

### Dependencies
- Phase 3 complete (loan application pipeline working)
- Phase 1 member-portal auth scope working

---

## Phase 7 — Polish & Deploy
**Goal:** App is production-ready and live.

### Tasks
- [ ] Test all CRUD operations end-to-end (members, loan products, loans, savings, ledger)
- [ ] Test the full maker-checker approval chain with 4 different role accounts
- [ ] Test auth flows (staff + member portal) on mobile and desktop
- [ ] Test Mobile Money disbursement and repayment flow via DGateway in sandbox mode
- [ ] Verify responsive design on mobile — data tables convert to stacked cards below `md`
- [ ] **Run pre-deploy code review:** paste the prompt from `pre-deploy-review.md` (in the VibeKit repo root) into Claude Code. Address every Critical issue. Save the report to `pre-deploy-review-report.md`.
- [ ] Address all Critical findings from the review, with particular attention to: unauthenticated routes, role-escalation bugs, N+1 queries on the dashboard KPIs, and audit-log completeness
- [ ] Set all environment variables in Vercel
- [ ] Apply database migrations to production
- [ ] Deploy to Vercel
- [ ] Configure Cloudflare DNS + custom domain
- [ ] Verify Resend sending domain
- [ ] Run production checklist

### Production Checklist
- [ ] All env vars set in Vercel (Database, Redis, Auth, Resend, R2, DGateway, SMS/WhatsApp)
- [ ] Database migrations applied to production
- [ ] Staff and member portal auth flows work on production URL
- [ ] Custom domain live with SSL
- [ ] Emails land in inbox (not spam)
- [ ] File uploads (member documents) work in production
- [ ] Maker-checker approval chain verified with real role accounts
- [ ] Penalty-engine cron job runs on schedule in production
- [ ] 404 and error pages styled
