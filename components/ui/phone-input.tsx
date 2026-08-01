"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

// vibekit.desishub.com's Advanced Form Elements registry is unreachable, so
// this is a hand-built fallback (master_prompt.md's documented pattern for
// broken registries). Scoped to Uganda only (+256) — a single-country SACCO
// app has no need for a full multi-country picker.

function formatLocal(digits: string) {
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9)]
    .filter(Boolean)
    .join(" ")
}

export const PhoneInput = React.forwardRef<
  HTMLInputElement,
  {
    value?: string
    onChange: (value: string) => void
    placeholder?: string
    disabled?: boolean
    className?: string
  }
>(({ value, onChange, placeholder = "7XX XXX XXX", disabled, className }, ref) => {
  const digits = (value ?? "").replace("+256", "")

  return (
    <div
      className={cn(
        "flex h-[42px] items-center rounded-sm border border-(--border-subtle) bg-(--bg-input) transition-colors has-[input:focus]:border-(--accent-500) has-[input:focus]:shadow-[var(--shadow-focus)]",
        disabled && "bg-(--bg-card)",
        className
      )}
    >
      <span className="flex h-full items-center border-r border-(--border-subtle) px-3 text-sm font-medium text-(--text-secondary)">
        +256
      </span>
      <input
        ref={ref}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        disabled={disabled}
        value={formatLocal(digits)}
        onChange={(e) => {
          const raw = e.target.value.replace(/\D/g, "").slice(0, 9)
          onChange(raw ? `+256${raw}` : "")
        }}
        placeholder={placeholder}
        className="h-full flex-1 bg-transparent px-3.5 text-sm text-(--text-primary) outline-none placeholder:text-(--text-muted) disabled:cursor-not-allowed disabled:text-(--text-muted)"
      />
    </div>
  )
})
PhoneInput.displayName = "PhoneInput"
