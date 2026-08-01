import * as React from "react";
import { Text } from "@react-email/components";
import { EmailShell, emailTextStyles } from "./email-shell";

export function MembershipExpiryEmail({
  memberName,
  expiryDate,
}: {
  memberName: string;
  expiryDate: string;
}) {
  return (
    <EmailShell title="Membership renewal">
      <Text style={emailTextStyles.h1}>Membership renewal due</Text>
      <Text style={emailTextStyles.text}>Hi {memberName},</Text>
      <Text style={emailTextStyles.text}>
        Your Nexcgen membership is due for renewal on <strong>{expiryDate}</strong>. Please
        visit your branch to renew and keep your account in good standing.
      </Text>
    </EmailShell>
  );
}
