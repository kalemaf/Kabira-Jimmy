import { z } from "zod";

export const interestMethods = [
  "Flat",
  "ReducingBalance",
  "Declining",
  "Compound",
  "Custom",
] as const;

export const loanProductSchema = z
  .object({
    name: z.string().min(2, "Name is required").max(80),
    interestRate: z.number().min(0).max(100),
    minAmount: z.number().int().min(0),
    maxAmount: z.number().int().min(0),
    repaymentPeriodMonths: z.number().int().min(1),
    gracePeriodDays: z.number().int().min(0),
    penaltyRate: z.number().min(0).max(100),
    processingFee: z.number().min(0).max(100),
    insuranceFee: z.number().min(0).max(100),
    lateFee: z.number().min(0).max(100),
    serviceCharge: z.number().min(0).max(100),
    interestMethod: z.enum(interestMethods),
    isActive: z.boolean(),
  })
  .refine((data) => data.maxAmount >= data.minAmount, {
    message: "Max amount must be greater than or equal to min amount",
    path: ["maxAmount"],
  });

export type LoanProductInput = z.infer<typeof loanProductSchema>;
