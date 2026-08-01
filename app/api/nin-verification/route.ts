import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth-guard";
import { verifyNin } from "@/lib/nin-verification";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  memberId: z.string().min(1),
  nin: z.string().min(1, "NIN is required"),
});

export async function POST(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const member = await db.member.findUnique({ where: { id: parsed.data.memberId } });
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const result = await verifyNin({
    nin: parsed.data.nin,
    firstName: member.firstName,
    lastName: member.lastName,
    dob: member.dob,
    phone: member.phone,
  });

  return NextResponse.json(result);
}
