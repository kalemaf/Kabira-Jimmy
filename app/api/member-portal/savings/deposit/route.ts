import { db } from "@/lib/db";
import { memberAuth } from "@/lib/member-auth";
import { getLinkedMemberId } from "@/lib/member-link-status";
import { memberDepositSchema } from "@/lib/schemas/member-savings";
import { collectPayment, isDGatewayConfigured } from "@/lib/dgateway";
import { confirmSavingsDeposit } from "@/lib/payment-confirmation";
import { writeAuditLog } from "@/lib/audit";
import { invalidateTag, tags } from "@/lib/cache";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

/**
 * Member self-service deposit — Mobile Money or Bank Transfer, both landing
 * as Pending until independently verified, never crediting the balance on
 * the member's own say-so:
 *  - Mobile Money: a real DGateway collection charge; the balance only moves
 *    once app/api/dgateway/webhook confirms the charge actually succeeded.
 *  - Bank Transfer: the member records the reference from a transfer they
 *    already made; a staff member checks the bank statement and confirms it
 *    via app/api/savings-transactions/[id]/confirm.
 * Uses the same tables, balance-update logic, and ledger posting as the
 * staff-recorded deposit path — not a parallel system.
 */
export async function POST(req: Request) {
  const session = await memberAuth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberId = await getLinkedMemberId(session.user.id);
  if (!memberId) {
    return NextResponse.json({ error: "Account not linked to a member" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = memberDepositSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { savingsAccountId, amount, method } = parsed.data;

  const account = await db.savingsAccount.findUnique({
    where: { id: savingsAccountId },
    include: { member: { select: { branchId: true, memberNumber: true } } },
  });
  if (!account) return NextResponse.json({ error: "Savings account not found" }, { status: 404 });

  // The real authorization boundary: a member can only ever deposit into
  // their OWN account, never one they merely know the ID of.
  if (account.memberId !== memberId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const branchId = account.member.branchId;
  const projectedBalance = account.balance + amount;

  if (method === "MobileMoney") {
    if (!isDGatewayConfigured()) {
      return NextResponse.json(
        { error: "Mobile Money deposits aren't available right now — please deposit at your branch or use Bank Transfer." },
        { status: 503 }
      );
    }

    const reference = `NGS-SDEP-${account.id}-${Date.now()}`;
    try {
      const result = await collectPayment({
        phone: parsed.data.phone,
        amountUgx: amount,
        reference,
        narration: `Nexcgen savings deposit — ${account.member.memberNumber}`,
      });

      const transaction = await db.savingsTransaction.create({
        data: {
          savingsAccountId,
          type: "Deposit",
          amount,
          balanceAfter: projectedBalance,
          branchId,
          status: "Pending",
          method: "MobileMoney",
          transactionId: result.transactionRef,
          channel: "MemberPortal",
          memberUserId: session.user.id,
        },
      });

      await writeAuditLog({
        userId: null,
        action: "savings_transaction.member_deposit_initiated",
        entityType: "SavingsTransaction",
        entityId: transaction.id,
        newValue: { savingsAccountId, amount, method, memberUserId: session.user.id, transactionRef: result.transactionRef },
        request: req,
      });

      // RohoPay's collect call can already report the final outcome
      // synchronously (see lib/dgateway.ts) rather than only via a later
      // webhook — confirm right away when it does, instead of leaving the
      // member staring at "Pending" for a webhook that may be delayed or
      // never arrive.
      if (result.status === "successful") {
        await confirmSavingsDeposit(result.transactionRef, req);
        await invalidateTag(tags.savings);
        return NextResponse.json({
          status: "confirmed",
          message: "Deposit successful — your balance has been updated.",
          transaction,
        });
      }

      await invalidateTag(tags.savings);
      return NextResponse.json({
        status: "pending",
        message: "Mobile Money collection initiated — your balance will update once confirmed.",
        transaction,
      });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Mobile Money collection failed" },
        { status: 502 }
      );
    }
  }

  // Bank Transfer — Pending until a staff member confirms it against the bank statement.
  const transaction = await db.savingsTransaction.create({
    data: {
      savingsAccountId,
      type: "Deposit",
      amount,
      balanceAfter: projectedBalance,
      branchId,
      status: "Pending",
      method: "BankTransfer",
      transactionId: parsed.data.bankReference,
      channel: "MemberPortal",
      memberUserId: session.user.id,
    },
  });

  await writeAuditLog({
    userId: null,
    action: "savings_transaction.member_deposit_initiated",
    entityType: "SavingsTransaction",
    entityId: transaction.id,
    newValue: { savingsAccountId, amount, method, memberUserId: session.user.id, bankReference: parsed.data.bankReference },
    request: req,
  });

  await invalidateTag(tags.savings);
  return NextResponse.json({
    status: "pending",
    message: "Recorded — a staff member will confirm this against your branch's bank statement.",
    transaction,
  });
}
