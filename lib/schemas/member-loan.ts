import { z } from "zod";

// Member self-service loan repayment is Mobile Money only — cash/bank/cheque
// repayments need a human teller, same reasoning as savings deposits.
export const memberRepaymentSchema = z.object({
  amount: z.number().int().min(1, "Amount must be positive"),
  phone: z.string().regex(/^\+256\d{9}$/, "Enter a valid Uganda phone number"),
});

export type MemberRepaymentInput = z.infer<typeof memberRepaymentSchema>;
