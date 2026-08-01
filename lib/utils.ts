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
