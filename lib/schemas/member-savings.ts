import { z } from "zod";

// Member self-service only ever deposits — withdrawals stay a staff/teller
// action (cash has to physically change hands), so there's no `type` field
// here the way there is on the staff-side createSavingsTransactionSchema.
//
// Two channels, both requiring real verification before the balance moves
// (see app/api/member-portal/savings/deposit/route.ts):
//  - MobileMoney: a real DGateway collection charge to `phone`, confirmed by
//    the DGateway webhook.
//  - BankTransfer: the member declares a reference for a transfer they
//    already made; a staff member checks the bank statement and confirms it.
// "Cash" isn't offered here — you can't self-service a cash deposit.
export const memberDepositSchema = z.discriminatedUnion("method", [
  z.object({
    savingsAccountId: z.string().min(1, "Account is required"),
    amount: z.number().int().min(1, "Amount must be positive"),
    method: z.literal("MobileMoney"),
    phone: z.string().regex(/^\+256\d{9}$/, "Enter a valid Uganda phone number"),
  }),
  z.object({
    savingsAccountId: z.string().min(1, "Account is required"),
    amount: z.number().int().min(1, "Amount must be positive"),
    method: z.literal("BankTransfer"),
    bankReference: z.string().min(3, "Enter the reference number from your bank transfer").max(80),
  }),
]);

export type MemberDepositInput = z.infer<typeof memberDepositSchema>;
