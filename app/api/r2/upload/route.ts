import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client } from "@/lib/r2Client";
import { auth } from "@/lib/auth";
import { memberAuth } from "@/lib/member-auth";
import { headers } from "next/headers";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

const uploadRequestSchema = z.object({
  filename: z.string(),
  contentType: z.string(),
  size: z.number(),
});

function constructCloudflareR2Url(
  key: string,
  publicDevUrl: string,
  customDomain?: string
): string {
  if (customDomain) {
    return `${customDomain}/${encodeURIComponent(key)}`;
  }
  // R2 public URL format (requires public access setup)
  return `${publicDevUrl}/${encodeURIComponent(key)}`;
}

// R2 is only usable once all three of these are actually filled in —
// .env.example ships with them blank, so a fresh checkout would otherwise
// generate presigned URLs against an empty host (ERR_NAME_NOT_RESOLVED).
const r2Configured =
  !!process.env.CLOUDFLARE_R2_ENDPOINT &&
  !!process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
  !!process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
  !!process.env.CLOUDFLARE_R2_PUBLIC_DEV_URL;

export async function POST(request: Request) {
  // Shared by staff-side uploads (loan wizard, member registration, staff
  // KYC) AND member-portal self-service uploads (loan application ID/selfie/
  // supporting docs) — object storage doesn't need to distinguish who's
  // uploading, so accept either session type. Each feature's own domain
  // logic is what restricts what an uploaded URL can actually be used for.
  const reqHeaders = await headers();
  const [staffSession, memberSession] = await Promise.all([
    auth.api.getSession({ headers: reqHeaders }),
    memberAuth.api.getSession({ headers: reqHeaders }),
  ]);
  if (!staffSession && !memberSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validation = uploadRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { filename, contentType, size } = validation.data;
    const uniqueKey = `${uuidv4()}-${filename}`.replace(/[^a-zA-Z0-9._-]/g, "_");

    if (!r2Configured) {
      // Dev fallback: PUT goes to our own local-upload route instead of R2,
      // and the file is served straight back out of /public/uploads.
      const presignedUrl = new URL(`/api/local-upload?key=${encodeURIComponent(uniqueKey)}`, request.url).toString();
      return NextResponse.json({
        presignedUrl,
        key: uniqueKey,
        publicUrl: `/uploads/${uniqueKey}`,
      });
    }

    const command = new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
      Key: uniqueKey,
      ContentType: contentType,
      ContentLength: size,
    });

    const presignedUrl = await getSignedUrl(r2Client, command, {
      expiresIn: 3600, // URL expires in 1 hour
    });

    const key = uniqueKey;
    const publicDevUrl = process.env.CLOUDFLARE_R2_PUBLIC_DEV_URL!;
    const publicUrl = constructCloudflareR2Url(key, publicDevUrl);

    return NextResponse.json({
      presignedUrl,
      key: uniqueKey,
      publicUrl,
    });
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
