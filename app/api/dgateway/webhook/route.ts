import { webhookSchema, dispatchDGatewayWebhookEvent } from "@/lib/dgateway-webhook-handler";
import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

// CONFIRMED via docs.rohopay.com/core-concepts/webhooks: header
// "X-RohoPay-Signature", value format "sha256=<hex digest of the raw
// request body>", secret from RohoPay Dashboard → Webhooks (must match
// ROHO_WEBHOOK_SECRET exactly — it is NOT the same value as ROHO_API_KEY).
function verifySignature(rawBody: string, headers: Headers): boolean {
  const secret = process.env.ROHO_WEBHOOK_SECRET;
  if (!secret) return false;

  const provided = headers.get("x-rohopay-signature");
  if (!provided || !provided.startsWith("sha256=")) return false;

  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.from(provided, "utf8");
  return providedBuf.length === expectedBuf.length && timingSafeEqual(providedBuf, expectedBuf);
}

/**
 * Async confirmation path for Mobile Money transactions — the primary path
 * for real (non-sandbox) traffic. Live testing showed RohoPay's sandbox
 * key returns the final status synchronously in the collect/disburse
 * response, but a real transaction against production stays "pending"
 * synchronously (the USSD/PIN prompt takes time) and only this webhook
 * carries the final outcome. Both this webhook AND the synchronous-status
 * path in the initiating routes call the same lib/payment-confirmation.ts
 * functions, which only ever act on a still-Pending record — whichever
 * arrives first "wins", the other is a harmless no-op.
 */
export async function POST(req: Request) {
  // Fail CLOSED: this endpoint moves real money state (creates loans,
  // confirms repayments) — an unset secret must reject every request, not
  // silently trust whatever is posted to it.
  if (!process.env.ROHO_WEBHOOK_SECRET) {
    console.error("[dgateway/webhook] ROHO_WEBHOOK_SECRET is not set — refusing all requests");
    return NextResponse.json({ error: "Server misconfigured: ROHO_WEBHOOK_SECRET not set" }, { status: 503 });
  }

  const rawBody = await req.text();
  if (!verifySignature(rawBody, req.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = webhookSchema.safeParse(JSON.parse(rawBody || "{}"));
  if (!parsed.success) return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });

  return dispatchDGatewayWebhookEvent(parsed.data, req);
}
