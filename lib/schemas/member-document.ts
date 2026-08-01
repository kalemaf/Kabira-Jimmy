import { z } from "zod";

export const memberDocumentTypes = [
  "NationalId",
  "Passport",
  "UtilityBill",
  "EmploymentLetter",
  "MembershipAgreement",
] as const;

export const memberDocumentSchema = z.object({
  type: z.enum(memberDocumentTypes),
  fileUrl: z.string().url("A valid file URL is required"),
});

export type MemberDocumentInput = z.infer<typeof memberDocumentSchema>;
