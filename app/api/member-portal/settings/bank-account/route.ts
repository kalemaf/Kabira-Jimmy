import { memberAuth } from "@/lib/member-auth";
import { getBankAccountDetails } from "@/lib/bank-account-policy";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

/** The SACCO's own bank account — shown on the deposit page once a member picks Bank Transfer. */
export async function GET() {
  const session = await memberAuth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json(await getBankAccountDetails());
}
