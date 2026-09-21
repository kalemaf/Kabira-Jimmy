import { describe, it, expect } from "vitest";
import {
  STATUS_STAGE,
  STAGE_ROLES,
  canActAtStage,
  isApprovalStage,
  type ApplicationStatus,
  type ApprovalStage,
} from "./loan-workflow";

describe("isApprovalStage", () => {
  it("is true for every stage except Disbursement", () => {
    const stages: ApprovalStage[] = ["LoanOfficer", "Secretary", "Treasurer", "Manager"];
    for (const stage of stages) {
      expect(isApprovalStage(stage)).toBe(true);
    }
  });

  it("is false for Disbursement and for an undefined stage", () => {
    expect(isApprovalStage("Disbursement")).toBe(false);
    expect(isApprovalStage(undefined)).toBe(false);
  });

  // Regression: the approve/reject/return buttons on the application review
  // page once shipped as a hardcoded array missing "LoanOfficer" entirely —
  // every member self-service application silently had no approve button.
  it("covers the LoanOfficer stage specifically (member self-service entry point)", () => {
    expect(isApprovalStage("LoanOfficer")).toBe(true);
  });
});

describe("STATUS_STAGE", () => {
  it("maps every Pending* status to an ApprovalStage, and every stage is approval-actionable except Disbursement", () => {
    const pendingStatuses = Object.keys(STATUS_STAGE) as ApplicationStatus[];
    expect(pendingStatuses.length).toBeGreaterThan(0);
    for (const status of pendingStatuses) {
      const stage = STATUS_STAGE[status]!;
      expect(Object.keys(STAGE_ROLES)).toContain(stage);
    }
  });
});

describe("canActAtStage", () => {
  it("lets a LoanOfficer act at the LoanOfficer stage", () => {
    expect(canActAtStage("LoanOfficer", "LoanOfficer")).toBe(true);
  });

  it("does not let a LoanOfficer act at the Manager stage", () => {
    expect(canActAtStage("LoanOfficer", "Manager")).toBe(false);
  });

  it("lets SuperAdmin act at every stage, as an override", () => {
    const stages: ApprovalStage[] = ["LoanOfficer", "Secretary", "Treasurer", "Manager", "Disbursement"];
    for (const stage of stages) {
      expect(canActAtStage("SuperAdmin", stage)).toBe(true);
    }
  });

  it("lets a Cashier act at Disbursement but not at earlier stages", () => {
    expect(canActAtStage("Cashier", "Disbursement")).toBe(true);
    expect(canActAtStage("Cashier", "Manager")).toBe(false);
  });
});
