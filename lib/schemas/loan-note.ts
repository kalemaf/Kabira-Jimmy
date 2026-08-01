import { z } from "zod";

export const createLoanNoteSchema = z.object({
  body: z.string().min(1, "Note cannot be empty").max(2000),
});

export type CreateLoanNoteInput = z.infer<typeof createLoanNoteSchema>;
