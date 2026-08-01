import { z } from "zod";

// Deliberately narrow — a member may update their own contact/location and
// next-of-kin details, but never identity-critical KYC fields (name, phone,
// NIN, DOB, gender). Those stay staff-controlled so the branch that verified
// the member's ID in person is the only party that can change it.
export const memberProfileUpdateSchema = z.object({
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  occupation: z.string().max(80).optional().or(z.literal("")),
  employer: z.string().max(120).optional().or(z.literal("")),
  district: z.string().max(80).optional().or(z.literal("")),
  subCounty: z.string().max(80).optional().or(z.literal("")),
  village: z.string().max(80).optional().or(z.literal("")),
  nextOfKinName: z.string().max(120).optional().or(z.literal("")),
  nextOfKinPhone: z.string().max(20).optional().or(z.literal("")),
  emergencyContact: z.string().max(20).optional().or(z.literal("")),
});

export type MemberProfileUpdateInput = z.infer<typeof memberProfileUpdateSchema>;
