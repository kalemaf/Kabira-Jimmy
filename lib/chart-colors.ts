/**
 * Categorical chart palette — validated via the dataviz skill's
 * validate_palette.js against our actual light (#FFFFFF) and dark
 * (#171717) card surfaces. Passed every check in both modes.
 *
 * This is a DIFFERENT palette from design-style-guide.md's single amber
 * accent + reserved status tokens — those stay reserved for their own
 * jobs (brand accent; Paid/Active/NearDue/DueSoon/Overdue/Defaulted status).
 * Generic categorical series (branches, officers, products — identity, not
 * state) use this fixed-order 8-hue theme instead, never status colors.
 */
export const CHART_CATEGORICAL = {
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"],
  dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
} as const;

/** Returns the first `n` categorical colors for the given theme (fixed order — never cycle/reorder by rank). */
export function categoricalColors(n: number, mode: "light" | "dark" = "dark"): string[] {
  return CHART_CATEGORICAL[mode].slice(0, n);
}

// Sequential (single hue, light→dark) — blue ramp, for magnitude encodings.
export const CHART_SEQUENTIAL_BLUE = {
  light: ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"],
  dark: ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"],
} as const;

// Loan status colors — design-style-guide.md §3, reserved status palette.
// Never reused as generic categorical series; always paired with a label.
export const LOAN_STATUS_COLORS: Record<string, string> = {
  Paid: "var(--success-600)",
  Active: "var(--info-600)",
  "Near Due": "var(--warning-600)",
  "Due Soon": "var(--accent-500)",
  Overdue: "var(--error-600)",
  Defaulted: "#C4453F",
};

export const CHART_CHROME = {
  grid: "var(--border-subtle)",
  axis: "var(--border-strong)",
  tickText: "var(--text-secondary)",
  tooltipBg: "var(--bg-card)",
  tooltipBorder: "var(--border-subtle)",
} as const;
