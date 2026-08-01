import { z } from "zod";
import { guarantorInputSchema, collateralInputSchema, identificationTypeSchema } from "@/lib/schemas/loan-application";

// Member self-service loan application — a trimmed version of the staff
// createLoanApplicationSchema. Deliberately excludes the officer
// verification/sign-off fields (officerVerifiedBusinessLetter,
// officerVerifiedPayslip, officerSignatureData) — those attest that a staff
// member physically reviewed supporting documents, which can't happen at
// submission time for a member applying from home. The Loan Officer's
// review now happens as their approval action at the PendingLoanOfficer
// stage instead, recorded as an ApprovalStep like any other stage.
export const memberLoanApplicationSchema = z
  .object({
    loanProductId: z.string().min(1, "Loan product is required"),
    amount: z.number().int().min(1, "Amount must be positive"),
    purpose: z.string().min(3, "Purpose is required").max(500),
    repaymentPeriodMonths: z.number().int().min(1),
    guarantors: z.array(guarantorInputSchema),
    collateral: z.array(collateralInputSchema),
    supportingDocumentUrls: z.array(z.string().url()),

    idType: identificationTypeSchema,
    idNumber: z.string().min(1, "ID number is required").max(50),
    idIssueDate: z.string().optional().or(z.literal("")),
    idExpiryDate: z.string().optional().or(z.literal("")),
    applicantPhotoUrl: z.string().url("Capture or upload a photo of yourself"),
    dependents: z.number().int().min(0, "Enter number of dependents"),

    businessName: z.string().max(150).optional().or(z.literal("")),
    businessAddress: z.string().max(200).optional().or(z.literal("")),
    businessLocation: z.string().max(200).optional().or(z.literal("")),
    businessPhone: z.string().max(20).optional().or(z.literal("")),
    yearsInBusiness: z.number().int().min(0).max(100).optional(),
    businessCapital: z.number().int().min(0).optional(),
    businessMonthlyIncome: z.number().int().min(0).optional(),

    employerName: z.string().max(150).optional().or(z.literal("")),
    position: z.string().max(100).optional().or(z.literal("")),
    yearsWithEmployer: z.number().int().min(0).max(100).optional(),
    employerPhone: z.string().max(20).optional().or(z.literal("")),
    netMonthlyIncome: z.number().int().min(0).optional(),
  })
  .refine((data) => !!data.businessName?.trim() || !!data.employerName?.trim(), {
    message: "Provide either business details or employment details",
    path: ["employerName"],
  })
  .refine((data) => (data.netMonthlyIncome ?? 0) > 0 || (data.businessMonthlyIncome ?? 0) > 0, {
    message: "Enter a monthly income (business or employment) so we can run the affordability check",
    path: ["netMonthlyIncome"],
  });

export type MemberLoanApplicationInput = z.infer<typeof memberLoanApplicationSchema>;
