import { z } from "zod";

export const guarantorInputSchema = z.object({
  memberId: z.string().min(1),
  guaranteeAmount: z.number().int().min(1),
});

export const collateralInputSchema = z.object({
  description: z.string().min(1),
  estimatedValue: z.number().int().min(0),
  documentUrl: z.string().url().optional().or(z.literal("")),
});

export const identificationTypeSchema = z.enum(["NationalId", "Passport", "VotersId", "DriversLicense"]);

export const createLoanApplicationSchema = z.object({
  memberId: z.string().min(1, "Member is required"),
  loanProductId: z.string().min(1, "Loan product is required"),
  amount: z.number().int().min(1, "Amount must be positive"),
  purpose: z.string().min(3, "Purpose is required").max(500),
  repaymentPeriodMonths: z.number().int().min(1),
  guarantors: z.array(guarantorInputSchema),
  collateral: z.array(collateralInputSchema),
  supportingDocumentUrls: z.array(z.string().url()),

  // Applicant profile — identity fields are mandatory for KYC; business and
  // employment sections are each optional but at least one must be filled
  // so every application carries some capacity-assessment evidence.
  idType: identificationTypeSchema,
  idNumber: z.string().min(1, "ID number is required").max(50),
  idIssueDate: z.string().optional().or(z.literal("")),
  idExpiryDate: z.string().optional().or(z.literal("")),
  applicantPhotoUrl: z.string().url("Capture or upload a photo of the applicant"),
  dependents: z.number().int().min(0, "Enter number of dependents"),
  ninVerificationStatus: z.enum(["NotChecked", "Matched", "Mismatch", "Unavailable"]).optional(),
  ninVerificationDetail: z.string().optional(),
  ninVerifiedAt: z.string().optional(),

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

  // Loan officer's document-verification + electronic sign-off.
  officerVerifiedBusinessLetter: z.boolean(),
  officerVerifiedPayslip: z.boolean(),
  officerSignatureData: z.string(),
})
  .refine(
    (data) => !!data.businessName?.trim() || !!data.employerName?.trim(),
    {
      message: "Provide either business details or employment details",
      path: ["employerName"],
    }
  )
  .refine((data) => (data.netMonthlyIncome ?? 0) > 0 || (data.businessMonthlyIncome ?? 0) > 0, {
    message: "Enter a monthly income (business or employment) to run the affordability check",
    path: ["netMonthlyIncome"],
  })
  .refine((data) => data.officerVerifiedBusinessLetter || data.officerVerifiedPayslip, {
    message: "Confirm you've seen either a business letter or a current payslip",
    path: ["officerVerifiedPayslip"],
  })
  .refine((data) => !!data.officerSignatureData, {
    message: "Officer signature is required before submitting",
    path: ["officerSignatureData"],
  });

export type CreateLoanApplicationInput = z.infer<typeof createLoanApplicationSchema>;

export const approvalActionSchema = z
  .object({
    action: z.enum(["Approve", "Reject", "Return"]),
    comments: z.string().max(1000).optional(),
  })
  .refine((data) => data.action === "Approve" || !!data.comments?.trim(), {
    message: "Comments are required for Reject and Return",
    path: ["comments"],
  });

export type ApprovalActionInput = z.infer<typeof approvalActionSchema>;

export const disbursementSchema = z
  .object({
    disbursementMethod: z.enum(["Cash", "Bank", "MobileMoney"]),
    comments: z.string().max(1000).optional(),
    phone: z
      .string()
      .regex(/^\+256\d{9}$/, "Enter a valid Uganda phone number")
      .optional(),
  })
  .refine((data) => data.disbursementMethod !== "MobileMoney" || !!data.phone, {
    message: "Phone number is required for Mobile Money disbursement",
    path: ["phone"],
  });

export type DisbursementInput = z.infer<typeof disbursementSchema>;
