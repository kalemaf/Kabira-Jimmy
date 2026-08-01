import type { StaffRole } from "@/components/dashboard/nav-config";

export type ApprovalStage = "LoanOfficer" | "Secretary" | "Treasurer" | "Manager" | "Disbursement";
export type ApplicationStatus =
  | "PendingLoanOfficer"
  | "PendingSecretary"
  | "PendingTreasurer"
  | "PendingManager"
  | "PendingDisbursement"
  | "Disbursed"
  | "Rejected"
  | "Returned";

/**
 * Maker-checker state machine. Two entry points, sharing the same
 * Manager → Disbursement tail:
 *  - Staff-prepared:  Secretary → Treasurer → Manager → Disbursement
 *  - Member self-service: LoanOfficer → Manager → Disbursement
 * A member has no Secretary to prepare on their behalf, but a Loan Officer
 * must still vet the application before it reaches Manager review.
 */
export const STATUS_STAGE: Partial<Record<ApplicationStatus, ApprovalStage>> = {
  PendingLoanOfficer: "LoanOfficer",
  PendingSecretary: "Secretary",
  PendingTreasurer: "Treasurer",
  PendingManager: "Manager",
  PendingDisbursement: "Disbursement",
};

/** The status an application moves to when APPROVED at a given stage (Disbursement excluded — see /disburse). */
export const NEXT_STATUS_ON_APPROVE: Record<Exclude<ApprovalStage, "Disbursement">, ApplicationStatus> = {
  LoanOfficer: "PendingManager",
  Secretary: "PendingTreasurer",
  Treasurer: "PendingManager",
  Manager: "PendingDisbursement",
};

/** Which staff roles may act at each stage. SuperAdmin may always act as an override. */
export const STAGE_ROLES: Record<ApprovalStage, StaffRole[]> = {
  LoanOfficer: ["LoanOfficer"],
  Secretary: ["Secretary"],
  Treasurer: ["Treasurer"],
  Manager: ["Manager"],
  Disbursement: ["LoanOfficer", "Cashier"],
};

export function canActAtStage(role: StaffRole, stage: ApprovalStage): boolean {
  return role === "SuperAdmin" || STAGE_ROLES[stage].includes(role);
}

export const STAGE_LABELS: Record<ApprovalStage, string> = {
  LoanOfficer: "Loan Officer review",
  Secretary: "Secretary review",
  Treasurer: "Treasurer review",
  Manager: "Manager review",
  Disbursement: "Disbursement",
};

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  PendingLoanOfficer: "Pending Loan Officer review",
  PendingSecretary: "Pending Secretary review",
  PendingTreasurer: "Pending Treasurer review",
  PendingManager: "Pending Manager review",
  PendingDisbursement: "Pending disbursement",
  Disbursed: "Disbursed",
  Rejected: "Rejected",
  Returned: "Returned",
};
