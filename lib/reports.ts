export type ReportColumn = { key: string; label: string; align?: "left" | "right" };
export type ReportRow = Record<string, string | number>;
export type ReportResponse = {
  title: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  summary?: Record<string, string | number>;
  requiresMember?: boolean;
};

export const REPORT_TYPES = [
  { type: "loans", label: "Loan Report", category: "Loans" },
  { type: "collections", label: "Collection Report", category: "Loans" },
  { type: "defaulters", label: "Defaulters Report", category: "Loans" },
  { type: "par-aging", label: "PAR Aging & Provisioning", category: "Loans" },
  { type: "loan-officer-performance", label: "Loan Officer Performance", category: "Loans" },
  { type: "guarantor", label: "Guarantor Report", category: "Loans" },
  { type: "savings", label: "Savings Report", category: "Savings" },
  { type: "members", label: "Member Report", category: "Members" },
  { type: "member-statement", label: "Member Statement", category: "Members" },
  { type: "profit", label: "Profit Report", category: "Finance" },
  { type: "interest", label: "Interest Report", category: "Finance" },
  { type: "penalty", label: "Penalty Report", category: "Finance" },
  { type: "cash-flow", label: "Cash Flow Report", category: "Finance" },
  { type: "income-statement", label: "Income Statement", category: "Finance" },
  { type: "balance-sheet", label: "Balance Sheet", category: "Finance" },
  { type: "branch-performance", label: "Branch Performance", category: "Operations" },
  { type: "audit", label: "Audit Report", category: "Operations" },
] as const;

export type ReportType = (typeof REPORT_TYPES)[number]["type"];
