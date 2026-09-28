import * as React from "react";
import { Text } from "@react-email/components";
import { EmailShell, emailTextStyles } from "./email-shell";

export function MaintenanceFeeEmail({
  memberName,
  amount,
  newBalance,
}: {
  memberName: string;
  amount: string;
  newBalance: string;
}) {
  return (
    <EmailShell title="Account maintenance fee charged">
      <Text style={emailTextStyles.h1}>Account maintenance fee charged</Text>
      <Text style={emailTextStyles.amount}>{amount}</Text>
      <Text style={emailTextStyles.text}>Hi {memberName},</Text>
      <Text style={emailTextStyles.text}>
        Your monthly account maintenance fee of <strong>{amount}</strong> has been deducted from
        your savings account. Your new balance is <strong>{newBalance}</strong>.
      </Text>
    </EmailShell>
  );
}
