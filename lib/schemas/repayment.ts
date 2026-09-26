import { z } from "zod";

export const createRepaymentSchema = z
  .object({
    loanId: z.string().min(1),
    amountPaid: z.number().int().min(1, "Amount must be positive"),
    method: z.enum(["Cash", "Bank", "MobileMoney", "Cheque", "Online"]),
    phone: z
      .string()
      .regex(/^\+256\d{9}$/, "Enter a valid Uganda phone number")
      .optional(),
    // Not inferable from the number itself — Uganda numbers get ported
    // between networks — so it's picked explicitly rather than guessed.
    network: z.enum(["MTN", "Airtel"]).optional(),
    transactionId: z.string().optional(),
  })
  .refine((data) => data.method !== "MobileMoney" || !!data.phone, {
    message: "Phone number is required for Mobile Money repayments",
    path: ["phone"],
  })
  .refine((data) => data.method !== "MobileMoney" || !!data.network, {
    message: "Select MTN or Airtel for Mobile Money repayments",
    path: ["network"],
  });

export type CreateRepaymentInput = z.infer<typeof createRepaymentSchema>;
