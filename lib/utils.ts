import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

const ugxFormatter = new Intl.NumberFormat("en-US");

/** Every currency value in this app is UGX — never hardcode `$`. */
export function formatUGX(value: number): string {
  return `UGX ${ugxFormatter.format(value)}`;
}

/**
 * Normalizes a Uganda phone number to +256XXXXXXXXX for display. New records
 * are already stored this way (PhoneInput always writes the +256 prefix),
 * but this guards against older/legacy numbers stored as "07XXXXXXXX" or
 * bare "7XXXXXXXX" so transaction history never shows an ambiguous local
 * number with no country code.
 */
export function formatPhoneUG(phone: string | null | undefined): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  const national = digits.startsWith("256") ? digits.slice(3) : digits.replace(/^0/, "");
  return `+256${national}`;
}

const MTN_PREFIXES = ["76", "77", "78", "39"];
const AIRTEL_PREFIXES = ["70", "74", "75", "20"];

/**
 * Best-effort guess of MTN vs Airtel from a Uganda number's prefix — used
 * only to pre-select a sensible default on the network toggle as someone
 * types. NOT trusted as the final answer: Uganda's number portability means
 * a number can have moved off its original network, so every caller that
 * uses this still leaves the toggle open for the person to correct by hand
 * rather than silently locking in this guess.
 */
export function detectMobileMoneyNetwork(phone: string | null | undefined): "MTN" | "Airtel" | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("256") ? digits.slice(3) : digits.replace(/^0/, "");
  const prefix = local.slice(0, 2);
  if (MTN_PREFIXES.includes(prefix)) return "MTN";
  if (AIRTEL_PREFIXES.includes(prefix)) return "Airtel";
  return undefined;
}
