import { z } from "zod";

export const guarantorSchema = z.object({
  memberId: z.string().min(1, "Member is required"),
  guaranteeAmount: z.number().int().min(1, "Amount must be positive"),
  status: z.enum(["Active", "Blocked"]),
});

export type GuarantorInput = z.infer<typeof guarantorSchema>;
