import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import { ACCOUNTS } from "@/lib/account-codes";
import { formatUGX } from "@/lib/utils";
import type { ReportResponse, ReportType } from "@/lib/reports";
import { NextResponse } from "next/server";

function parseRange(searchParams: URLSearchParams) {
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const from = fromParam ? new Date(fromParam) : new Date(Date.now() - 30 * 86_400_000);
  const to = toParam ? new Date(toParam) : new Date();
  return { from, to };
}

export async function GET(req: Request, { params }: { params: Promise<{ type: string }> }) {
  // Matches nav-config's Reports section — every report here (loan
  // portfolio, collections, and the Finance-category financial statements)
  // is restricted the same way the sidebar already implies, rather than
  // being reachable by any authenticated staff member via direct API call.
  const { error } = await requireRole(["SuperAdmin", "Manager", "AccountsOfficer", "Auditor"]);
  if (error) return error;

  const { type } = await params;
  const { searchParams } = new URL(req.url);
  const { from, to } = parseRange(searchParams);
  const memberId = searchParams.get("memberId")?.trim() ?? "";

  const report = await buildReport(type as ReportType, from, to, memberId);
  if (!report) return NextResponse.json({ error: "Unknown report type" }, { status: 404 });

  return NextResponse.json(report);
}

async function buildReport(type: ReportType, from: Date, to: Date, memberId: string): Promise<ReportResponse | null> {
  switch (type) {
    case "loans": {
      const loans = await db.loan.findMany({
        where: { disbursedAt: { gte: from, lte: to } },
        include: { member: { select: { firstName: true, lastName: true, memberNumber: true } }, branch: { select: { name: true } } },
        orderBy: { disbursedAt: "desc" },
      });
      return {
        title: "Loan Report",
        columns: [
          { key: "member", label: "Member" },
          { key: "branch", label: "Branch" },
          { key: "principal", label: "Principal", align: "right" },
          { key: "status", label: "Status" },
          { key: "disbursedAt", label: "Disbursed" },
        ],
        rows: loans.map((l) => ({
          member: `${l.member.firstName} ${l.member.lastName} (${l.member.memberNumber})`,
          branch: l.branch.name,
          principal: formatUGX(l.principal),
          status: l.status,
          disbursedAt: l.disbursedAt.toLocaleDateString("en-UG"),
        })),
        summary: { "Total principal": formatUGX(loans.reduce((s, l) => s + l.principal, 0)), Count: loans.length },
      };
    }

    case "collections": {
      const repayments = await db.repayment.findMany({
        where: { status: "Confirmed", paidAt: { gte: from, lte: to } },
        include: {
          loan: { include: { member: { select: { firstName: true, lastName: true, memberNumber: true } } } },
          collector: { select: { name: true } },
        },
        orderBy: { paidAt: "desc" },
      });
      return {
        title: "Collection Report",
        columns: [
          { key: "member", label: "Member" },
          { key: "amount", label: "Amount", align: "right" },
          { key: "method", label: "Method" },
          { key: "collector", label: "Collected by" },
          { key: "paidAt", label: "Date" },
        ],
        rows: repayments.map((r) => ({
          member: `${r.loan.member.firstName} ${r.loan.member.lastName} (${r.loan.member.memberNumber})`,
          amount: formatUGX(r.amountPaid),
          method: r.method,
          collector: r.collector?.name ?? (r.channel === "MemberPortal" ? "Member self-service" : r.collectorId ?? "—"),
          paidAt: r.paidAt.toLocaleDateString("en-UG"),
        })),
        summary: { "Total collected": formatUGX(repayments.reduce((s, r) => s + r.amountPaid, 0)), Count: repayments.length },
      };
    }

    case "defaulters": {
      const loans = await db.loan.findMany({
        where: { status: { in: ["Overdue", "Defaulted"] } },
        include: {
          member: { select: { firstName: true, lastName: true, memberNumber: true, phone: true } },
          branch: { select: { name: true } },
          recoveryCase: { include: { recoveryOfficer: { select: { name: true } } } },
        },
        orderBy: { principal: "desc" },
      });
      return {
        title: "Defaulters Report",
        columns: [
          { key: "member", label: "Member" },
          { key: "phone", label: "Phone" },
          { key: "branch", label: "Branch" },
          { key: "principal", label: "Principal", align: "right" },
          { key: "status", label: "Status" },
          { key: "officer", label: "Recovery Officer" },
        ],
        rows: loans.map((l) => ({
          member: `${l.member.firstName} ${l.member.lastName} (${l.member.memberNumber})`,
          phone: l.member.phone,
          branch: l.branch.name,
          principal: formatUGX(l.principal),
          status: l.status,
          officer: l.recoveryCase?.recoveryOfficer?.name ?? "Unassigned",
        })),
        summary: { "Total at risk": formatUGX(loans.reduce((s, l) => s + l.principal, 0)), Count: loans.length },
      };
    }

    case "loan-officer-performance": {
      const officers = await db.user.findMany({ where: { role: "LoanOfficer" } });
      const rows = await Promise.all(
        officers.map(async (o) => {
          const [prepared, disbursed] = await Promise.all([
            db.loanApplication.count({ where: { preparedByUserId: o.id, createdAt: { gte: from, lte: to } } }),
            db.loan.aggregate({
              where: { disbursedByUserId: o.id, disbursedAt: { gte: from, lte: to } },
              _count: true,
              _sum: { principal: true },
            }),
          ]);
          return {
            officer: o.name ?? o.email,
            applicationsPrepared: prepared,
            loansDisbursed: disbursed._count,
            totalDisbursed: formatUGX(disbursed._sum.principal ?? 0),
          };
        })
      );
      return {
        title: "Loan Officer Performance",
        columns: [
          { key: "officer", label: "Officer" },
          { key: "applicationsPrepared", label: "Applications Prepared", align: "right" },
          { key: "loansDisbursed", label: "Loans Disbursed", align: "right" },
          { key: "totalDisbursed", label: "Total Disbursed", align: "right" },
        ],
        rows,
      };
    }

    case "guarantor": {
      const guarantors = await db.guarantor.findMany({
        include: { member: { select: { firstName: true, lastName: true, memberNumber: true } } },
      });
      const grouped = new Map<string, { name: string; number: string; exposure: number; count: number; blocked: boolean }>();
      for (const g of guarantors) {
        const entry = grouped.get(g.memberId) ?? {
          name: `${g.member.firstName} ${g.member.lastName}`,
          number: g.member.memberNumber,
          exposure: 0,
          count: 0,
          blocked: false,
        };
        entry.exposure += g.guaranteeAmount;
        entry.count += 1;
        if (g.status === "Blocked") entry.blocked = true;
        grouped.set(g.memberId, entry);
      }
      const rows = Array.from(grouped.values());
      return {
        title: "Guarantor Report",
        columns: [
          { key: "member", label: "Member" },
          { key: "exposure", label: "Total Exposure", align: "right" },
          { key: "count", label: "Guarantees", align: "right" },
          { key: "status", label: "Status" },
        ],
        rows: rows.map((r) => ({
          member: `${r.name} (${r.number})`,
          exposure: formatUGX(r.exposure),
          count: r.count,
          status: r.blocked ? "Blocked" : "Active",
        })),
      };
    }

    case "savings": {
      const transactions = await db.savingsTransaction.findMany({
        where: { createdAt: { gte: from, lte: to } },
        include: { savingsAccount: { include: { member: { select: { firstName: true, lastName: true, memberNumber: true } } } } },
        orderBy: { createdAt: "desc" },
      });
      return {
        title: "Savings Report",
        columns: [
          { key: "member", label: "Member" },
          { key: "type", label: "Type" },
          { key: "status", label: "Status" },
          { key: "amount", label: "Amount", align: "right" },
          { key: "balanceAfter", label: "Balance", align: "right" },
          { key: "date", label: "Date" },
        ],
        rows: transactions.map((t) => ({
          member: `${t.savingsAccount.member.firstName} ${t.savingsAccount.member.lastName} (${t.savingsAccount.member.memberNumber})`,
          type: t.type,
          status: t.status,
          amount: formatUGX(t.amount),
          balanceAfter: formatUGX(t.balanceAfter),
          date: t.createdAt.toLocaleDateString("en-UG"),
        })),
      };
    }

    case "members": {
      const members = await db.member.findMany({
        where: { dateJoined: { gte: from, lte: to } },
        include: { branch: { select: { name: true } } },
        orderBy: { dateJoined: "desc" },
      });
      return {
        title: "Member Report",
        columns: [
          { key: "name", label: "Name" },
          { key: "memberNumber", label: "Member #" },
          { key: "branch", label: "Branch" },
          { key: "status", label: "Status" },
          { key: "dateJoined", label: "Joined" },
        ],
        rows: members.map((m) => ({
          name: `${m.firstName} ${m.lastName}`,
          memberNumber: m.memberNumber,
          branch: m.branch.name,
          status: m.status,
          dateJoined: m.dateJoined.toLocaleDateString("en-UG"),
        })),
        summary: { Count: members.length },
      };
    }

    case "member-statement": {
      if (!memberId) return { title: "Member Statement", columns: [], rows: [], requiresMember: true };
      const member = await db.member.findUnique({ where: { id: memberId } });
      if (!member) return { title: "Member Statement", columns: [], rows: [], requiresMember: true };

      const [loans, savingsTxns] = await Promise.all([
        db.loan.findMany({ where: { memberId } }),
        db.savingsTransaction.findMany({ where: { savingsAccount: { memberId } }, orderBy: { createdAt: "desc" } }),
      ]);
      const rows = [
        ...loans.map((l) => ({
          date: l.disbursedAt.toLocaleDateString("en-UG"),
          type: "Loan disbursed",
          amount: formatUGX(l.principal),
          status: l.status,
        })),
        ...savingsTxns.map((t) => ({
          date: t.createdAt.toLocaleDateString("en-UG"),
          type: `Savings ${t.type}`,
          amount: formatUGX(t.amount),
          status: t.status,
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return {
        title: `Member Statement — ${member.firstName} ${member.lastName}`,
        columns: [
          { key: "date", label: "Date" },
          { key: "type", label: "Type" },
          { key: "amount", label: "Amount", align: "right" },
          { key: "status", label: "Status" },
        ],
        rows,
      };
    }

    case "profit":
    case "interest":
    case "penalty": {
      const accountCode =
        type === "interest" ? ACCOUNTS.INTEREST_INCOME : type === "penalty" ? ACCOUNTS.PENALTY_INCOME : undefined;

      const months: { label: string; start: Date; end: Date }[] = [];
      const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
      while (cursor <= to) {
        const start = new Date(cursor);
        const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
        months.push({ label: start.toLocaleDateString("en-UG", { month: "short", year: "numeric" }), start, end });
        cursor.setMonth(cursor.getMonth() + 1);
      }

      const rows = await Promise.all(
        months.map(async (m) => {
          if (accountCode) {
            const agg = await db.ledgerEntry.aggregate({
              where: { accountCode, createdAt: { gte: m.start, lt: m.end } },
              _sum: { credit: true },
            });
            return { month: m.label, amount: formatUGX(agg._sum.credit ?? 0) };
          }
          const [revenue, expense] = await Promise.all([
            db.ledgerEntry.aggregate({
              where: { account: { type: "Revenue" }, createdAt: { gte: m.start, lt: m.end } },
              _sum: { credit: true, debit: true },
            }),
            db.ledgerEntry.aggregate({
              where: { account: { type: "Expense" }, createdAt: { gte: m.start, lt: m.end } },
              _sum: { debit: true, credit: true },
            }),
          ]);
          const rev = (revenue._sum.credit ?? 0) - (revenue._sum.debit ?? 0);
          const exp = (expense._sum.debit ?? 0) - (expense._sum.credit ?? 0);
          return { month: m.label, amount: formatUGX(rev - exp) };
        })
      );

      return {
        title: type === "interest" ? "Interest Report" : type === "penalty" ? "Penalty Report" : "Profit Report",
        columns: [
          { key: "month", label: "Month" },
          { key: "amount", label: type === "profit" ? "Net Profit" : "Amount", align: "right" },
        ],
        rows,
      };
    }

    case "cash-flow": {
      const [inflow, outflow] = await Promise.all([
        db.ledgerEntry.aggregate({
          where: { accountCode: { in: [ACCOUNTS.CASH, ACCOUNTS.BANK] }, createdAt: { gte: from, lte: to } },
          _sum: { debit: true },
        }),
        db.ledgerEntry.aggregate({
          where: { accountCode: { in: [ACCOUNTS.CASH, ACCOUNTS.BANK] }, createdAt: { gte: from, lte: to } },
          _sum: { credit: true },
        }),
      ]);
      const inflowTotal = inflow._sum.debit ?? 0;
      const outflowTotal = outflow._sum.credit ?? 0;
      return {
        title: "Cash Flow Report",
        columns: [
          { key: "label", label: "" },
          { key: "amount", label: "Amount", align: "right" },
        ],
        rows: [
          { label: "Cash inflow", amount: formatUGX(inflowTotal) },
          { label: "Cash outflow", amount: formatUGX(outflowTotal) },
          { label: "Net cash flow", amount: formatUGX(inflowTotal - outflowTotal) },
        ],
      };
    }

    case "income-statement": {
      const [revenueAccounts, expenseAccounts] = await Promise.all([
        db.chartOfAccount.findMany({ where: { type: "Revenue" } }),
        db.chartOfAccount.findMany({ where: { type: "Expense" } }),
      ]);
      const totals = await db.ledgerEntry.groupBy({ by: ["accountCode"], _sum: { debit: true, credit: true } });
      const totalsByCode = new Map(totals.map((t) => [t.accountCode, t._sum]));
      const rows = [...revenueAccounts, ...expenseAccounts].map((a) => {
        const sums = totalsByCode.get(a.code);
        const amount = a.type === "Revenue" ? (sums?.credit ?? 0) - (sums?.debit ?? 0) : (sums?.debit ?? 0) - (sums?.credit ?? 0);
        return { account: a.name, type: a.type, amount: formatUGX(amount) };
      });
      return {
        title: "Income Statement",
        columns: [
          { key: "account", label: "Account" },
          { key: "type", label: "Type" },
          { key: "amount", label: "Amount", align: "right" },
        ],
        rows,
      };
    }

    case "balance-sheet": {
      const accounts = await db.chartOfAccount.findMany({ where: { type: { in: ["Asset", "Liability", "Equity"] } } });
      const totals = await db.ledgerEntry.groupBy({ by: ["accountCode"], _sum: { debit: true, credit: true } });
      const totalsByCode = new Map(totals.map((t) => [t.accountCode, t._sum]));
      const rows = accounts.map((a) => {
        const sums = totalsByCode.get(a.code);
        const normalSide = a.type === "Asset" ? "debit" : "credit";
        const amount =
          normalSide === "debit" ? (sums?.debit ?? 0) - (sums?.credit ?? 0) : (sums?.credit ?? 0) - (sums?.debit ?? 0);
        return { account: a.name, type: a.type, amount: formatUGX(amount) };
      });
      return {
        title: "Balance Sheet",
        columns: [
          { key: "account", label: "Account" },
          { key: "type", label: "Type" },
          { key: "amount", label: "Amount", align: "right" },
        ],
        rows,
      };
    }

    case "branch-performance": {
      const branches = await db.branch.findMany({
        include: { _count: { select: { members: true, loans: true } } },
      });
      const rows = await Promise.all(
        branches.map(async (b) => {
          const collections = await db.repayment.aggregate({
            where: { branchId: b.id, status: "Confirmed", paidAt: { gte: from, lte: to } },
            _sum: { amountPaid: true },
          });
          const savings = await db.savingsAccount.aggregate({
            where: { member: { branchId: b.id } },
            _sum: { balance: true },
          });
          return {
            branch: b.name,
            members: b._count.members,
            loans: b._count.loans,
            savings: formatUGX(savings._sum.balance ?? 0),
            collections: formatUGX(collections._sum.amountPaid ?? 0),
          };
        })
      );
      return {
        title: "Branch Performance",
        columns: [
          { key: "branch", label: "Branch" },
          { key: "members", label: "Members", align: "right" },
          { key: "loans", label: "Loans", align: "right" },
          { key: "savings", label: "Total Savings", align: "right" },
          { key: "collections", label: "Collections (period)", align: "right" },
        ],
        rows,
      };
    }

    case "audit": {
      const logs = await db.auditLog.findMany({
        where: { createdAt: { gte: from, lte: to } },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      return {
        title: "Audit Report",
        columns: [
          { key: "date", label: "Date" },
          { key: "user", label: "User" },
          { key: "action", label: "Action" },
          { key: "entity", label: "Entity" },
        ],
        rows: logs.map((l) => ({
          date: l.createdAt.toLocaleString("en-UG"),
          user: l.user?.name ?? "System",
          action: l.action,
          entity: `${l.entityType}:${l.entityId}`,
        })),
      };
    }

    default:
      return null;
  }
}
