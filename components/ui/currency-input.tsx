"use client";
import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type CurrencyInputProps = {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  prefix?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, prefix = "UGX", placeholder, className, disabled }, ref) => {
    const display =
      typeof value === "number" && !Number.isNaN(value)
        ? value.toLocaleString("en-US")
        : "";

    return (
      <div className={cn("relative flex items-center", className)}>
        <span className="pointer-events-none absolute left-3.5 font-mono text-sm text-(--text-muted)">
          {prefix}
        </span>
        <Input
          ref={ref}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={display}
          placeholder={placeholder ?? "0"}
          disabled={disabled}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9]/g, "");
            if (raw === "") return onChange(undefined);
            const n = parseInt(raw, 10);
            onChange(Number.isFinite(n) ? n : undefined);
          }}
          className="pl-14 text-right font-mono tabular-nums"
        />
      </div>
    );
  }
);
CurrencyInput.displayName = "CurrencyInput";
