# Claude Code — Build Prompt

You are building **NextGen SACCO** — an enterprise-grade Loan & Savings Management System for Ugandan SACCOs, MFIs, and Cooperative Societies. Production-quality code only. Never write demo/placeholder logic for core financial calculations — the loan calculator, penalty engine, and maker-checker approval workflow must be real and correct.

Read the following files in order before doing anything:
1. `master_prompt.md` — Your tech stack rules, Prisma v7 patterns, and coding standards. Follow EXACTLY.
2. `design-style-guide.md` — The visual design system for this project (dark-first fintech aesthetic). Apply to every component you build.
3. `jb-components.md` — The JB component reference. Use these components before writing from scratch.
4. `project-description.md` — What we are building. Every decision must align with this.
5. `project-phases.md` — The build plan. Work through phases in order.

## Rules
- Work through ONE phase at a time. Complete all tasks in a phase before moving to the next.
- After completing each phase, stop and confirm with me before proceeding.
- Follow design-style-guide.md tokens exactly (colors, typography, spacing, radius). Dark mode is the default theme — build it first, then verify light mode.
- Use Prisma v7 patterns (NOT v6). See master_prompt.md for the exact setup.
- **Use React Query for all client data fetching + Redis for API-layer caching** (getCachedOrFetch + invalidateTag from lib/cache.ts). Never useEffect for data.
- Use React Hook Form + Zod for all forms.
- Use API Routes (Route Handlers) for all server-side logic.
- Use Framer Motion for animation (default). Keep motion minimal — this is a financial tool, not a marketing site.
- Use @react-pdf/renderer for all PDF generation (loan agreements, statements, receipts, reports). Never jsPDF.
- Use xlsx for Excel export.
- **Follow performance budget:** next/dynamic for heavy imports, Suspense boundaries on every data-fetching section, ErrorBoundary on major page blocks, aspect-ratio on all images, animate transform/opacity only.
- **Before building auth, file uploads, data tables, multi-step forms, charts, or notification UI from scratch — check jb-components.md and install the relevant component first.**

## Domain-Specific Rules (critical — do not deviate)
- **Every financial calculation lives in a pure, testable function** (`lib/loan-calculator.ts`, `lib/loan-eligibility.ts`). Never inline interest/penalty math in a component or API route handler.
- **Maker-checker is mandatory and enforced server-side.** A user may only act on a loan application at their own role's approval stage. The API must reject an approval action from the wrong role, not just hide the button client-side.
- **Every mutating action writes an AuditLog entry** — user, action, entity, old value, new value, IP address, timestamp. This is not optional and not a "nice to have for later" — build it into the mutation layer from Phase 3 onward, not bolted on at the end.
- **All currency is UGX.** Never hardcode `$`. Use a shared `formatUGX()` helper everywhere money is displayed.
- **Loan status colors (Green/Yellow/Orange/Red/Dark Red) are computed, not stored** — derive status from due dates and payment history at query/render time so it's always accurate, and always pair the color with text (see design-style-guide.md §16 Accessibility).
- **Member-portal queries must be scoped to the logged-in member's own records at the query layer**, not just hidden in the UI — this is a data-leakage risk, treat it as a security requirement.
- **Mobile Money (DGateway) failures must not silently corrupt loan state** — a disbursement or repayment is only marked complete after a confirmed webhook/status callback, never optimistically on request.

## Start
Begin with **Phase 1 — Foundation** from project-phases.md. Read the phase tasks and execute them in order.
