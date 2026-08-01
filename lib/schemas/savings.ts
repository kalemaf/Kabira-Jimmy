import { z } from "zod";

export const createSavingsAccountSchema = z.object({
  memberId: z.string().min(1, "Member is required"),
  type: z.enum(["Daily", "Fixed", "Shares"]),
  openingDeposit: z.number().int().min(0),
});

export type CreateSavingsAccountInput = z.infer<typeof createSavingsAccountSchema>;

export const createSavingsTransactionSchema = z.object({
  savingsAccountId: z.string().min(1),
  type: z.enum(["Deposit", "Withdrawal"]),
  amount: z.number().int().min(1, "Amount must be positive"),
});

export type CreateSavingsTransactionInput = z.infer<typeof createSavingsTransactionSchema>;
