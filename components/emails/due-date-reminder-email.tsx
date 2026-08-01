import * as React from "react";
import { Text } from "@react-email/components";
import { EmailShell, emailTextStyles } from "./email-shell";

export function DueDateReminderEmail({
  memberName,
  amountDue,
  dueDate,
}: {
  memberName: string;
  amountDue: string;
  dueDate: string;
}) {
  return (
    <EmailShell title="Loan repayment reminder">
      <Text style={emailTextStyles.h1}>Upcoming repayment</Text>
      <Text style={emailTextStyles.text}>Hi {memberName},</Text>
      <Text style={emailTextStyles.text}>
        Your next loan instalment of <strong>{amountDue}</strong> is due on{" "}
        <strong>{dueDate}</strong>. Please visit your branch or pay via Mobile Money to stay on
        track.
      </Text>
    </EmailShell>
  );
}
