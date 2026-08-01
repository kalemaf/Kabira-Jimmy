import { z } from "zod";

export const recoveryStatuses = ["Active", "Promised", "Legal", "Blacklisted", "Recovered"] as const;

export const createRecoveryCaseSchema = z.object({
  loanId: z.string().min(1),
  recoveryOfficerId: z.string().optional(),
});

export type CreateRecoveryCaseInput = z.infer<typeof createRecoveryCaseSchema>;

export const updateRecoveryCaseSchema = z.object({
  recoveryOfficerId: z.string().optional(),
  status: z.enum(recoveryStatuses).optional(),
  notes: z.string().max(2000).optional(),
  visitDate: z.coerce.date().optional(),
  recoveredAmount: z.number().int().min(0).optional(),
});

export type UpdateRecoveryCaseInput = z.infer<typeof updateRecoveryCaseSchema>;
