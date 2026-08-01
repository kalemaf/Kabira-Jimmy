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
    transactionId: z.string().optional(),
  })
  .refine((data) => data.method !== "MobileMoney" || !!data.phone, {
    message: "Phone number is required for Mobile Money repayments",
    path: ["phone"],
  });

export type CreateRepaymentInput = z.infer<typeof createRepaymentSchema>;
