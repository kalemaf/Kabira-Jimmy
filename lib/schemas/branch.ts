import { z } from "zod";

export const branchSchema = z.object({
  name: z.string().min(2, "Name is required").max(120),
  code: z.string().min(2, "Code is required").max(20),
  district: z.string().min(2, "District is required").max(80),
  address: z.string().max(200).optional().or(z.literal("")),
  phone: z.string().max(20).optional().or(z.literal("")),
});

export type BranchInput = z.infer<typeof branchSchema>;
