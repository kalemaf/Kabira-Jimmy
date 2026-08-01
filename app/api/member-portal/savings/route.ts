import { db } from "@/lib/db";
import { memberAuth } from "@/lib/member-auth";
import { getLinkedMemberId } from "@/lib/member-link-status";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

/** A member's own savings accounts + transaction history — nothing else. */
export async function GET() {
  const session = await memberAuth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberId = await getLinkedMemberId(session.user.id);
  if (!memberId) {
    return NextResponse.json({ error: "Account not linked to a member" }, { status: 400 });
  }

  const member = await db.member.findUnique({
    where: { id: memberId },
    select: {
      firstName: true,
      lastName: true,
      memberNumber: true,
      branch: { select: { name: true } },
      savingsAccounts: {
        orderBy: { openedAt: "desc" },
        include: {
          transactions: {
            orderBy: { createdAt: "desc" },
            take: 20,
            include: {
              staff: { select: { name: true } },
              memberUser: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const data = member.savingsAccounts.map((account) => {
    const confirmed = account.transactions.filter((t) => t.status === "Confirmed");
    const lastDeposit = confirmed.find((t) => t.type === "Deposit");
    const lastWithdrawal = confirmed.find((t) => t.type === "Withdrawal");
    return {
      id: account.id,
      accountNumber: account.accountNumber,
      type: account.type,
      balance: account.balance,
      openedAt: account.openedAt,
      lastDepositAt: lastDeposit?.createdAt ?? null,
      lastWithdrawalAt: lastWithdrawal?.createdAt ?? null,
      transactions: account.transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        balanceAfter: t.balanceAfter,
        channel: t.channel,
        status: t.status,
        method: t.method,
        createdAt: t.createdAt,
        staffName: t.staff?.name ?? (t.memberUser ? `${t.memberUser.name} (self-service)` : "—"),
      })),
    };
  });

  return NextResponse.json({
    memberName: `${member.firstName} ${member.lastName}`,
    memberNumber: member.memberNumber,
    branchName: member.branch.name,
    data,
  });
}
