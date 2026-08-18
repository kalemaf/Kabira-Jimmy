import { NextResponse } from "next/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { r2Client } from "@/lib/r2Client";
import { requireSession } from "@/lib/auth-guard";
import { writeAuditLog } from "@/lib/audit";

export async function DELETE(request: Request) {
  const { session, error } = await requireSession();
  if (error) return error;

  try {
    const body = await request.json();
    const { key } = body;

    if (!key || typeof key !== "string") {
      return NextResponse.json(
        { error: "File key is required" },
        { status: 400 }
      );
    }

    const command = new DeleteObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
      Key: key,
    });

    await r2Client.send(command);

    // This permanently destroys a KYC/loan document with no way to recover
    // it — an audit trail is the only accountability this action gets, so
    // it must never be skipped even though the object itself carries no
    // link back to a member/loan/staff record at the storage layer.
    await writeAuditLog({
      userId: session.user.id,
      action: "r2_object.delete",
      entityType: "R2Object",
      entityId: key,
      request,
    });

    return NextResponse.json(
      { message: "File deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting file:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}
