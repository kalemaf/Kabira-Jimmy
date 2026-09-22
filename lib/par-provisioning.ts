/**
 * Illustrative loan-loss provisioning rates by PAR (Portfolio At Risk)
 * aging bucket, loosely modeled on common Bank of Uganda / UMRA SACCO
 * prudential-guideline tiers. These are a reasonable starting point, not a
 * substitute for confirming the SACCO's actual regulatory obligation with
 * its auditor/supervisor — kept as one small, clearly-labeled constant so
 * that confirming/adjusting the real rate is a one-line change here, not a
 * code archaeology exercise across the reporting code.
 */
export const PAR_BUCKETS = [
  { key: "current", label: "Current", minDays: 0, maxDays: 0, provisioningRate: 0 },
  { key: "par1_30", label: "PAR 1–30 days", minDays: 1, maxDays: 30, provisioningRate: 0.01 },
  { key: "par31_60", label: "PAR 31–60 days", minDays: 31, maxDays: 60, provisioningRate: 0.03 },
  { key: "par61_90", label: "PAR 61–90 days", minDays: 61, maxDays: 90, provisioningRate: 0.25 },
  { key: "par90_plus", label: "PAR 90+ days", minDays: 91, maxDays: Infinity, provisioningRate: 1 },
] as const;

export type ParBucketKey = (typeof PAR_BUCKETS)[number]["key"];

export function bucketForDaysPastDue(daysPastDue: number) {
  return (
    PAR_BUCKETS.find((b) => daysPastDue >= b.minDays && daysPastDue <= b.maxDays) ??
    PAR_BUCKETS[PAR_BUCKETS.length - 1]
  );
}
