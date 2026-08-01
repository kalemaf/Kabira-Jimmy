import { z } from "zod";

export const staffRoles = [
  "SuperAdmin",
  "Manager",
  "Treasurer",
  "Secretary",
  "LoanOfficer",
  "Cashier",
  "AccountsOfficer",
  "RecoveryOfficer",
  "Auditor",
] as const;

// KYC identity fields are required for every new hire — staff handle cash
// and approve loans, so anyone with access must be identifiable and
// locatable (national ID, a photo taken at registration, residential
// address, and a next of kin contact) before an account is created.
export const createStaffSchema = z.object({
  name: z.string().min(2, "Name is required").max(120),
  email: z.string().email("Invalid email"),
  phone: z.string().regex(/^\+256\d{9}$/, "Enter a valid Uganda phone number"),
  role: z.enum(staffRoles),
  branchId: z.string().min(1, "Branch is required"),
  nationalIdNumber: z.string().min(4, "National ID number is required").max(20),
  idDocumentUrl: z.string().url("Upload a copy of the staff member's national ID"),
  selfieUrl: z.string().url("Capture a photo for identity verification"),
  district: z.string().min(1, "District is required").max(80),
  subCounty: z.string().max(80).optional().or(z.literal("")),
  village: z.string().max(80).optional().or(z.literal("")),
  nextOfKinName: z.string().min(2, "Next of kin name is required").max(120),
  nextOfKinPhone: z.string().regex(/^\+256\d{9}$/, "Enter a valid Uganda phone number"),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;

export const updateStaffSchema = z.object({
  role: z.enum(staffRoles).optional(),
  branchId: z.string().min(1).optional(),
  phone: z.string().regex(/^\+256\d{9}$/, "Enter a valid Uganda phone number").optional(),
  nationalIdNumber: z.string().min(4).max(20).optional(),
  idDocumentUrl: z.string().url().optional(),
  selfieUrl: z.string().url().optional(),
  district: z.string().max(80).optional(),
  subCounty: z.string().max(80).optional().or(z.literal("")),
  village: z.string().max(80).optional().or(z.literal("")),
  nextOfKinName: z.string().max(120).optional(),
  nextOfKinPhone: z.string().regex(/^\+256\d{9}$/, "Enter a valid Uganda phone number").optional(),
});

export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
