/**
 * Shared eligibility constants — kept dependency-free (no `db` import) so
 * client components (e.g. the loan application wizard's live affordability
 * preview) can import these without pulling Prisma into the browser bundle.
 * lib/loan-eligibility.ts re-exports these for server-side use.
 */

/**
 * A member's savings balance must cover at least this fraction of the
 * requested loan amount — a standard SACCO collateral-savings convention.
 */
export const SAVINGS_TO_LOAN_RATIO = 0.1;

/**
 * Debt-service ratio cap — a borrower's loan installment must not exceed
 * this fraction of their declared monthly income. Standard affordability
 * convention for SACCO/MFI lending; not a spec'd figure, so tunable here.
 */
export const MAX_DEBT_TO_INCOME_RATIO = 0.3;
