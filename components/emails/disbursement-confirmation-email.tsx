import * as React from "react";
import { Text } from "@react-email/components";
import { EmailShell, emailTextStyles } from "./email-shell";

export function DisbursementConfirmationEmail({
  memberName,
  amount,
  method,
}: {
  memberName: string;
  amount: string;
  method: string;
}) {
  return (
    <EmailShell title="Loan disbursed">
      <Text style={emailTextStyles.h1}>Loan disbursed</Text>
      <Text style={emailTextStyles.amount}>{amount}</Text>
      <Text style={emailTextStyles.text}>Hi {memberName},</Text>
      <Text style={emailTextStyles.text}>
        Your loan has been disbursed via <strong>{method}</strong>. Thank you for banking with
        Nexcgen.
      </Text>
    </EmailShell>
  );
}
