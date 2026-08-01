import * as React from "react";
import { Text } from "@react-email/components";
import { EmailShell, StatusChip, emailTextStyles } from "./email-shell";

export function ApprovalStatusEmail({
  memberName,
  amount,
  status,
  comments,
}: {
  memberName: string;
  amount: string;
  status: "Approved" | "Rejected" | "Returned";
  comments?: string;
}) {
  const tone = status === "Approved" ? "success" : status === "Rejected" ? "error" : "warning";
  return (
    <EmailShell title="Loan application update">
      <Text style={emailTextStyles.h1}>Loan application update</Text>
      <StatusChip tone={tone}>{status}</StatusChip>
      <Text style={emailTextStyles.text}>Hi {memberName},</Text>
      <Text style={emailTextStyles.text}>
        Your loan application for <strong>{amount}</strong> has been <strong>{status.toLowerCase()}</strong>.
      </Text>
      {comments ? <Text style={emailTextStyles.text}>Comments: {comments}</Text> : null}
    </EmailShell>
  );
}
