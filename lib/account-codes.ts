// Split out from lib/ledger.ts so client components can reference account
// codes without pulling in that module's `db` (Prisma) import.
export const ACCOUNTS = {
  CASH: "1000",
  BANK: "1010",
  LOANS_RECEIVABLE: "1100",
  SAVINGS_DEPOSITS: "2000",
  MEMBER_SHARES: "3000",
  INTEREST_INCOME: "4000",
  PENALTY_INCOME: "4010",
  FEE_INCOME: "4020",
  // Already seeded (prisma/seed.ts) as "Loan Loss Provision" — just never
  // had a named constant until a caller (loan write-offs) actually needed
  // to post against it.
  LOAN_LOSS_PROVISION: "5030",
} as const;
