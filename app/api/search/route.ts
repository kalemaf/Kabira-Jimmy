import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth-guard";
import { NextResponse } from "next/server";

export type SearchResult = { type: string; label: string; description: string; href: string };

export async function GET(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ data: [] });

  const [members, loans, repayments] = await Promise.all([
    db.member.findMany({
      where: {
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
          { nin: { contains: q, mode: "insensitive" } },
          { memberNumber: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
    }),
    db.loan.findMany({
      where: {
        OR: [{ id: { contains: q } }, { member: { memberNumber: { contains: q, mode: "insensitive" } } }],
      },
      include: { member: { select: { firstName: true, lastName: true, memberNumber: true } } },
      take: 5,
    }),
    db.repayment.findMany({
      where: { receiptNumber: { contains: q, mode: "insensitive" } },
      include: { loan: { include: { member: { select: { firstName: true, lastName: true } } } } },
      take: 5,
    }),
  ]);

  const results: SearchResult[] = [
    ...members.map((m) => ({
      type: "Member",
      label: `${m.firstName} ${m.lastName}`,
      description: `${m.memberNumber} · ${m.phone}`,
      href: `/dashboard/members/${m.id}`,
    })),
    ...loans.map((l) => ({
      type: "Loan",
      label: `${l.member.firstName} ${l.member.lastName} — Loan`,
      description: `${l.member.memberNumber} · ${l.status}`,
      href: `/dashboard/loans/${l.id}`,
    })),
    ...repayments.map((r) => ({
      type: "Receipt",
      label: r.receiptNumber,
      description: `${r.loan.member.firstName} ${r.loan.member.lastName}`,
      href: `/dashboard/loans/${r.loanId}`,
    })),
  ];

  return NextResponse.json({ data: results });
}
