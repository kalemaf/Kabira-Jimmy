import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-[42px] w-full min-w-0 rounded-sm border border-(--border-subtle) bg-(--bg-input) px-3.5 text-sm text-(--text-primary) transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-(--text-muted) focus-visible:border-(--accent-500) focus-visible:shadow-[var(--shadow-focus)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-(--bg-card) disabled:text-(--text-muted) aria-invalid:border-(--error-600) md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
