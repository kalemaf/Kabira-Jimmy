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
    // Uganda's Mobile Money prefixes don't reliably identify the network
    // (numbers get ported between MTN and Airtel), so this can't be
    // inferred from the phone number — it has to be picked explicitly.
    network: z.enum(["MTN", "Airtel"], { message: "Select MTN or Airtel" }),
  }),
  z.object({
    savingsAccountId: z.string().min(1, "Account is required"),
    amount: z.number().int().min(1, "Amount must be positive"),
    method: z.literal("BankTransfer"),
    bankReference: z.string().min(3, "Enter the reference number from your bank transfer").max(80),
  }),
]);

export type MemberDepositInput = z.infer<typeof memberDepositSchema>;

// Deliberately no `phone` field — a withdrawal payout always goes to the
// member's REGISTERED phone number on file (set by staff during KYC), never
// a client-supplied one. Letting a member type in an arbitrary payout
// number would be a real fraud vector: if their account were compromised,
// an attacker could redirect withdrawals to a number they control. Deposits
// (memberDepositSchema above) are the opposite risk profile — it's the
// member's own money leaving their own pocket, so any number they control
// is fine there.
export const withdrawalOtpRequestSchema = z.object({
  savingsAccountId: z.string().min(1, "Account is required"),
  amount: z.number().int().min(1, "Amount must be positive"),
});

export const withdrawalConfirmSchema = z.object({
  requestId: z.string().min(1),
  code: z.string().length(6, "Enter the 6-digit code"),
});
