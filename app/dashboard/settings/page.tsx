import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { isDGatewayConfigured, getWalletBalance } from "@/lib/dgateway";
import { isSmsConfigured } from "@/lib/notifications";
import { isNinVerificationConfigured } from "@/lib/nin-verification";
import { WithdrawalPolicyForm } from "@/components/dashboard/settings/withdrawal-policy-form";
import { EligibilityPolicyForm } from "@/components/dashboard/settings/eligibility-policy-form";
import { RepaymentFeePolicyForm } from "@/components/dashboard/settings/repayment-fee-policy-form";
import { BankAccountForm } from "@/components/dashboard/settings/bank-account-form";
import { formatUGX } from "@/lib/utils";
import type { StaffRole } from "@/components/dashboard/nav-config";

type IntegrationStatus = {
  name: string;
  description: string;
  configured: boolean;
  envVars: string[];
};

function getIntegrations(): IntegrationStatus[] {
  return [
    {
      name: "Email (Resend)",
      description: "Loan approval, disbursement, due-date, and penalty notification emails.",
      configured: !!process.env.RESEND_API_KEY,
      envVars: ["RESEND_API_KEY", "RESEND_FROM_EMAIL"],
    },
    {
      name: "SMS (Africa's Talking)",
      description: "SMS alerts that accompany every member notification email.",
      configured: isSmsConfigured(),
      envVars: ["SMS_PROVIDER_API_KEY", "SMS_PROVIDER_SENDER_ID"],
    },
    {
      name: "Mobile Money (RohoPay)",
      description: "Member self-service savings deposits, loan repayments, and Mobile Money disbursement.",
      configured: isDGatewayConfigured(),
      envVars: ["ROHO_API_URL", "ROHO_API_KEY", "ROHO_WEBHOOK_SECRET"],
    },
    {
      name: "National ID verification (Youverify)",
      description: "\"Verify with NIRA\" in the loan application wizard.",
      configured: isNinVerificationConfigured(),
      envVars: ["YOUVERIFY_API_URL", "YOUVERIFY_API_KEY"],
    },
    {
      name: "Document storage (Cloudflare R2)",
      description: "Member photos, signatures, and KYC document uploads. Falls back to local disk storage in dev when unset.",
      configured: !!process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
      envVars: ["CLOUDFLARE_R2_ACCESS_KEY_ID", "CLOUDFLARE_R2_SECRET_ACCESS_KEY", "CLOUDFLARE_R2_ENDPOINT"],
    },
    {
      name: "Cache (Upstash Redis)",
      description: "Session caching and API response caching across the app.",
      configured: !!process.env.UPSTASH_REDIS_URL,
      envVars: ["UPSTASH_REDIS_URL", "UPSTASH_REDIS_TOKEN"],
    },
    {
      name: "Cron authentication",
      description: "Protects the nightly penalty-engine and backup cron routes from unauthenticated calls.",
      configured: !!process.env.CRON_SECRET,
      envVars: ["CRON_SECRET"],
    },
  ];
}

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = (session!.user as { role?: StaffRole }).role;

  if (role !== "SuperAdmin") {
    redirect("/dashboard");
  }

  const integrations = getIntegrations();
  const configuredCount = integrations.filter((i) => i.configured).length;
  const wallet = isDGatewayConfigured() ? await getWalletBalance() : null;

  return (
    <>
      <PageHeader
        title="Settings"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Settings" }]}
        user={{
          name: session!.user.name,
          email: session!.user.email,
          image: session!.user.image,
          role: role!,
        }}
      />
      <main className="flex-1 space-y-6 px-4 py-6 md:px-8">
        {isDGatewayConfigured() ? (
          <Card>
            <CardHeader>
              <CardTitle>RohoPay wallet float</CardTitle>
              <CardDescription>
                The SACCO&apos;s own RohoPay merchant balance — what Mobile Money disbursements pay out of. RohoPay
                only allows topping this up by logging into their dashboard directly; this app can only read it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {wallet ? (
                <p className="font-mono text-2xl font-semibold tabular-nums text-(--text-primary)">
                  {formatUGX(wallet.balance)}
                </p>
              ) : (
                <p className="text-sm text-(--text-secondary)">
                  Couldn&apos;t reach RohoPay to read the current balance — check the RohoPay dashboard directly.
                </p>
              )}
            </CardContent>
          </Card>
        ) : null}
        <WithdrawalPolicyForm />
        <EligibilityPolicyForm />
        <RepaymentFeePolicyForm />
        <BankAccountForm />
        <Card>
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
            <CardDescription>
              {configuredCount} of {integrations.length} external services configured. Each is read from
              server environment variables — set them in your hosting provider's environment settings
              (e.g. Vercel Project → Settings → Environment Variables) to enable a service.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col divide-y divide-(--border)">
            {integrations.map((integration) => (
              <div
                key={integration.name}
                className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-(--text-primary)">{integration.name}</p>
                  <p className="mt-0.5 text-sm text-(--text-secondary)">{integration.description}</p>
                  <p className="mt-1 font-mono text-xs text-(--text-secondary)/70">{integration.envVars.join(", ")}</p>
                </div>
                <StatusBadge
                  status={integration.configured ? "Configured" : "Not configured"}
                  tone={integration.configured ? "success" : "warning"}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
