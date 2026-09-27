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
