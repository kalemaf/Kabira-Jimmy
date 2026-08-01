import { auth } from "@/lib/auth";
import { memberAuth } from "@/lib/member-auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// Dev-only fallback used by /api/r2/upload when Cloudflare R2 credentials
// aren't configured — writes straight to public/uploads/ instead of R2, so
// the rest of the app (member photos, KYC documents, applicant photos) keeps
// working end-to-end without needing a real bucket during local development.
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

// Only characters produced by our own key generation (uuid-filename) are
// ever accepted — blocks path traversal via a crafted key query param.
const SAFE_KEY = /^[a-zA-Z0-9._-]+$/;

export async function PUT(request: Request) {
  // Accept either session type — see app/api/r2/upload's comment for why.
  const reqHeaders = await headers();
  const [staffSession, memberSession] = await Promise.all([
    auth.api.getSession({ headers: reqHeaders }),
    memberAuth.api.getSession({ headers: reqHeaders }),
  ]);
  if (!staffSession && !memberSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = new URL(request.url).searchParams.get("key");
  if (!key || !SAFE_KEY.test(key)) {
    return NextResponse.json({ error: "Invalid upload key" }, { status: 400 });
  }

  const buffer = Buffer.from(await request.arrayBuffer());
  if (buffer.length === 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, key), buffer);

  return NextResponse.json({ ok: true });
}
