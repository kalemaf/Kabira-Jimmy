import * as React from "react";
import { Text } from "@react-email/components";
import { EmailShell, StatusChip, emailTextStyles } from "./email-shell";

export function PenaltyAlertEmail({
  memberName,
  daysOverdue,
  penaltyDue,
}: {
  memberName: string;
  daysOverdue: number;
  penaltyDue: string;
}) {
  return (
    <EmailShell title="Overdue loan notice">
      <Text style={emailTextStyles.h1}>Your loan is overdue</Text>
      <StatusChip tone="error">Overdue · {daysOverdue} days</StatusChip>
      <Text style={emailTextStyles.text}>Hi {memberName},</Text>
      <Text style={emailTextStyles.text}>
        Your loan repayment is <strong>{daysOverdue} days overdue</strong>, with a penalty of{" "}
        <strong>{penaltyDue}</strong> now accrued. Please settle this as soon as possible to
        avoid further escalation.
      </Text>
    </EmailShell>
  );
}
