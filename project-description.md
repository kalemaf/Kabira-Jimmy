# NextGen SACCO — Project Description

## What This App Does
NextGen SACCO is an enterprise-grade loan and savings management system built for Ugandan SACCOs, microfinance institutions, and cooperative societies. It digitizes the full member lifecycle — registration, savings, loan applications, multi-level approval, disbursement, repayment tracking, recovery, and accounting — replacing spreadsheets and manual ledgers with an audit-compliant, multi-branch banking-grade platform.

## Target Users
- **Primary user:** SACCO staff across nine roles (Super Administrator, Manager, Treasurer, Secretary, Loan Officer, Cashier, Accounts Officer, Recovery Officer, Auditor) who manage members, process loans, collect repayments, and produce financial reports.
- **Secondary user:** SACCO members (borrowers/savers) who log into a self-service portal to view savings, apply for loans, download statements, and track repayment schedules.

## Core Value Proposition
A single, audit-trailed system that enforces the maker-checker discipline real SACCOs are required to follow, while automating interest calculation, penalty accrual, and recovery tracking that Ugandan cooperatives currently do by hand.

## User Roles & Permissions
- **Super Administrator:** Full system access — configures loan products, branches, users, and system settings.
- **Manager:** Final loan approval authority, views all branch dashboards, can override at the final approval stage.
- **Treasurer:** Approves financial transactions and checks cash/savings position before loan disbursement.
- **Secretary:** First-line verification of member information, documents, guarantors, and eligibility.
- **Loan Officer:** Processes applications, prepares loan files, executes disbursement after approval.
- **Cashier:** Handles deposits, withdrawals, and loan disbursement payments at the branch.
- **Accounts Officer:** Manages the general ledger, produces financial statements and reports.
- **Recovery Officer:** Follows up on overdue and defaulted loans, logs visits and recovery notes.
- **Auditor:** Read-only access across the entire system, including the audit log.
- **Member (Portal):** Views own savings, loans, statements, and repayment schedule; applies for loans; updates own profile.

## Features — Complete List
1. **Member Management** — Full KYC registration: passport photo, National ID, NIN, signature, contact info, employer, address (district/sub-county/village), next of kin, biometric placeholder field, document uploads (ID, passport, utility bill, employment letter, membership agreement), auto-generated member number, membership status tracking.
2. **Loan Products Configuration** — Admin-defined products (Emergency, Salary, Business, Agricultural, School Fees, Asset, Development, Mortgage, Vehicle, custom) each with interest rate, min/max amount, repayment period, grace period, penalty rate, processing fee, insurance fee, late fee, service charge.
3. **Loan Application & Risk Check** — Captures amount, purpose, product, period, interest method, guarantors, collateral, supporting documents, income source; system auto-checks savings balance, existing loan exposure, credit score, guarantor availability, delinquency history, and member status to compute eligibility.
4. **Multi-Level Approval Workflow (Maker-Checker)** — Four mandatory stages: Secretary verification → Treasurer financial check → Manager final approval → Loan Officer/Cashier disbursement. Every stage records user, timestamp, IP address, comments, and electronic signature into the audit trail. Each stage supports Approve, Reject, and Return-with-comments.
5. **Loan Calculator & Amortization** — Automatic computation of principal, interest, fees, penalties, monthly/weekly/daily installments, remaining balance, total payable, and effective interest rate. Supports flat rate, reducing balance, declining balance, compound, and custom SACCO-defined formulas. Full amortization schedule generation.
6. **Repayment Management** — Accepts cash, bank transfer, mobile money (MTN/Airtel), cheque, and online payments. Auto-splits payments into interest, principal, and penalty; updates outstanding balance in real time; records receipt number, transaction ID, collector, and branch.
7. **Loan Status Tracking** — Color-coded status per loan (Green=Paid, Yellow=Near Due, Orange=Due Soon, Red=Overdue, Dark Red=Defaulted) with days remaining/overdue, accrued penalty, and assigned recovery officer.
8. **Automatic Penalty Engine** — On missed due dates, automatically calculates penalty/additional interest/fines and triggers SMS/Email/WhatsApp reminders, escalating to Manager and Recovery Officer alerts.
9. **Guarantor Management** — Individual guarantor profiles tracking guarantee amount, available savings, current exposure across all guaranteed loans, with automatic blocking once the guarantee limit is exceeded.
10. **Savings Management** — Daily savings, fixed deposits, and share accounts with deposit/withdrawal processing, interest accrual, account statements, and a digital passbook.
11. **Accounting Module** — General ledger, chart of accounts, cash book, bank book, trial balance, income statement, balance sheet, expense and revenue tracking, assets/liabilities/capital views.
12. **Reporting Suite** — PDF, Excel, and CSV export for daily/weekly/monthly/quarterly/yearly reports covering loans, savings, members, profit, interest, penalties, cash flow, balance sheet, income statement, audit, defaulters, collections, loan officer performance, branch performance, member statements, and guarantor exposure.
13. **Recovery Module** — Auto-generated lists of late and defaulted loans, recovery officer assignment, visit scheduling, recovery notes, payment promise tracking, recovered-amount logging, legal action flagging, and blacklist management.
14. **Multi-Branch Operations** — Unlimited branches, each with its own users, cashbook, and dashboard; head office has full roll-up visibility across all branches.
15. **Member Self-Service Portal** — Members log in to view savings, loans, statements and repayment schedules, apply for loans, download PDF statements, update their profile, and receive notifications.
16. **Notifications** — In-app, email, SMS, and WhatsApp notifications for due dates, approvals, rejections, disbursement, late payment, penalties, membership expiry, and system alerts.
17. **Audit Log** — Every login, logout, approval, create/update/delete, disbursement, repayment, deposit, withdrawal, export, and print action is logged with user, timestamp, IP, browser, and old/new values.
18. **Digital Loan Agreements** — Auto-generated, printable loan agreement documents with electronic signature capture.
19. **Global Search** — Search by member name, phone, NIN, loan number, member number, receipt number, or transaction number.
20. **Dashboard & Analytics** — Branch performance, top borrowers/defaulters/savers, portfolio at risk (PAR), recovery rate, default rate, cash flow, and monthly comparisons via bar/pie/line charts.

## Data Model
- **Branch:** id, name, code, district, address, phone, createdAt
- **Staff (User):** id, name, email, phone, role (enum), branchId, passwordHash, status, lastLogin, createdAt
- **Member:** id, memberNumber (auto), firstName, lastName, phone, email, NIN, nationalIdNumber, dob, gender, occupation, employer, district, subCounty, village, dateJoined, status (active/inactive/suspended), photoUrl, signatureUrl, nextOfKinName, nextOfKinPhone, emergencyContact, branchId
- **MemberDocument:** id, memberId, type (nationalId/passport/utilityBill/employmentLetter/agreement), fileUrl, uploadedAt
- **LoanProduct:** id, name, interestRate, minAmount, maxAmount, repaymentPeriodMonths, gracePeriodDays, penaltyRate, processingFee, insuranceFee, lateFee, serviceCharge, interestMethod (flat/reducingBalance/declining/compound/custom)
- **LoanApplication:** id, memberId, loanProductId, amount, purpose, repaymentPeriod, interestMethod, riskScore, status (pending/secretaryReview/treasuryReview/managerReview/approved/rejected/returned/disbursed), createdAt
- **ApprovalStep:** id, loanApplicationId, stage (secretary/treasurer/manager/disbursement), userId, action (approve/reject/return), comments, ipAddress, timestamp, signatureUrl
- **Loan:** id, loanApplicationId, memberId, principal, interestRate, disbursedAt, status (active/paidOff/overdue/defaulted), branchId
- **Repayment:** id, loanId, amountPaid, principalPortion, interestPortion, penaltyPortion, method (cash/bank/mobileMoney/cheque/online), receiptNumber, transactionId, collectorId, branchId, paidAt
- **Guarantor:** id, memberId, loanId, guaranteeAmount, status (active/blocked)
- **Collateral:** id, loanId, description, estimatedValue, documentUrl
- **SavingsAccount:** id, memberId, type (daily/fixed/shares), balance, openedAt
- **SavingsTransaction:** id, savingsAccountId, type (deposit/withdrawal/interest), amount, branchId, staffId, createdAt
- **LedgerEntry:** id, accountCode, description, debit, credit, branchId, createdAt
- **RecoveryCase:** id, loanId, recoveryOfficerId, status (active/promised/legal/blacklisted/recovered), notes, visitDate, recoveredAmount
- **Notification:** id, memberId or staffId, channel (email/sms/whatsapp/inApp), message, status, sentAt
- **AuditLog:** id, userId, action, entityType, entityId, oldValue, newValue, ipAddress, browser, createdAt
- **Relationships:** A Branch has many Staff and Members. A Member has many SavingsAccounts, LoanApplications, and can be a Guarantor on multiple Loans. A LoanApplication belongs to a LoanProduct and progresses through many ApprovalSteps before becoming a Loan. A Loan has many Repayments, Guarantors, and Collateral items, and may have a RecoveryCase. Every mutating action writes an AuditLog entry.

## Pages / Screens
1. `/` — Public landing page introducing NextGen SACCO (for staff/member login entry, not public marketing-heavy)
2. `/login` — Staff login
3. `/member-portal/login` — Member portal login
4. `/dashboard` — Staff dashboard: KPIs, charts, PAR, recovery rate, recent transactions, pending approvals, alerts
5. `/dashboard/members` — Member list (search, filter, export)
6. `/dashboard/members/[id]` — Member profile: summary, documents, savings, loan history, guarantor history
7. `/dashboard/members/new` — Member registration form
8. `/dashboard/loan-products` — Loan product configuration list
9. `/dashboard/loan-products/new` — Create/edit loan product
10. `/dashboard/loans` — All loans list with color-coded status, filters
11. `/dashboard/loans/[id]` — Loan detail: amortization schedule, repayments, guarantors, collateral, documents
12. `/dashboard/loans/applications` — Pending applications queue (per approval stage, role-scoped)
13. `/dashboard/loans/applications/new` — New loan application form
14. `/dashboard/loans/applications/[id]` — Application review/approval screen (maker-checker actions)
15. `/dashboard/repayments` — Repayment collection screen (record payment, generate receipt)
16. `/dashboard/savings` — Savings accounts list
17. `/dashboard/savings/[id]` — Savings account detail + passbook/statement
18. `/dashboard/guarantors` — Guarantor exposure overview
19. `/dashboard/recovery` — Recovery module: defaulter list, visit schedule, recovery notes
20. `/dashboard/accounting` — General ledger, trial balance, income statement, balance sheet
21. `/dashboard/branches` — Branch management (head office only)
22. `/dashboard/staff` — Staff/user management with RBAC
23. `/dashboard/reports` — Report builder/export center
24. `/dashboard/audit-log` — Audit trail (Auditor + Super Admin)
25. `/dashboard/notifications` — Notification center
26. `/dashboard/settings` — System settings, branding, integrations
27. `/member-portal/dashboard` — Member overview: savings, active loans, notifications
28. `/member-portal/loans` — Member's loan list + apply for loan
29. `/member-portal/loans/apply` — Member-facing loan application form
30. `/member-portal/statements` — Downloadable savings/loan statements
31. `/member-portal/profile` — Member profile update

## Integrations
- **Auth:** Better Auth, staff email/password (OAuth optional for staff), member portal separate email/password login
- **Email:** Resend
- **Payments/Disbursement:** DGateway (MTN Mobile Money + Airtel Money, UGX) for disbursement and repayment collection
- **File uploads:** Cloudflare R2 (national IDs, agreements, collateral documents, member photos)
- **SMS/WhatsApp:** External API layer (e.g. Africa's Talking or equivalent) — configured as a pluggable notification provider; env vars documented but provider chosen at build time
- **AI features:** None in v1
- **Dark mode:** Yes — full light/dark theme support with a toggle in the sidebar

## JB Components to Install
- Form (shadcn fallback): `pnpm dlx shadcn@latest add https://vibekit.desishub.com/r/form.json`
- JB Better Auth UI: `pnpm dlx shadcn@latest add https://better-auth-ui.desishub.com/r/auth-components.json`
- Data Table: `pnpm dlx shadcn@latest add https://jb.desishub.com/r/data-table.json`
- Searchable Select: `pnpm dlx shadcn@latest add https://jb.desishub.com/r/searchable-select.json`
- File Storage UI (R2): `pnpm dlx shadcn@latest add https://file-storage.desishub.com/r/file-storage.json`
- Charts & Dashboard Grid: `pnpm dlx shadcn@latest add https://vibekit.desishub.com/r/charts-grid.json`
- Multi-Step Form (loan application wizard): `pnpm dlx shadcn@latest add https://vibekit.desishub.com/r/multi-step-form.json`
- Notification Center: `pnpm dlx shadcn@latest add https://vibekit.desishub.com/r/notification-center.json`
- Printable Templates (loan agreements, receipts, statements): `pnpm dlx shadcn@latest add https://vibekit.desishub.com/r/printable-templates.json`
- Advanced Form Elements (phone input for members/staff): `pnpm dlx shadcn@latest add https://vibekit.desishub.com/r/advanced-form-elements.json`
- Command Palette (staff power-user navigation): `pnpm dlx shadcn@latest add https://vibekit.desishub.com/r/command-palette.json`
- DGateway Shop primitives (mobile money checkout, adapted for disbursement/repayment): `pnpm dlx shadcn@latest add https://ui-components.desishub.com/r/dgateway-shop.json`

## Out of Scope (v1)
- Live bank API integrations (Uganda bank connections) — integration layer is stubbed, not connected to live bank rails
- Automated legal action workflows — legal status is flagged manually by Recovery Officers, no court-filing automation
- Biometric authentication — field captured as a placeholder only, no live fingerprint/facial hardware integration
- Multi-tenant SaaS mode (serving multiple independent SACCOs from one deployment) — v1 is single-organization with multi-branch support
- Native mobile apps — member portal and staff dashboard are responsive web only
