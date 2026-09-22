import { z } from "zod";

export const createLoanNoteSchema = z.object({
  body: z.string().min(1, "Note cannot be empty").max(2000),
  isDispute: z.boolean().optional(),
});

export type CreateLoanNoteInput = z.infer<typeof createLoanNoteSchema>;

export const updateLoanNoteDisputeSchema = z.object({
  disputeStatus: z.enum(["Open", "Investigating", "Resolved"]),
});

export type UpdateLoanNoteDisputeInput = z.infer<typeof updateLoanNoteDisputeSchema>;
