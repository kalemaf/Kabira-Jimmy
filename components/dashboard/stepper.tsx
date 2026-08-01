import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export type Step = { label: string }

// design-style-guide.md §7.11 — numbered step indicator, current step filled
// with accent-500, completed steps show a checkmark, future steps text-muted.
export function Stepper({ steps, currentStep }: { steps: Step[]; currentStep: number }) {
  return (
    <ol className="flex items-center gap-2 overflow-x-auto pb-2">
      {steps.map((step, i) => {
        const stepNumber = i + 1
        const isCompleted = stepNumber < currentStep
        const isCurrent = stepNumber === currentStep

        return (
          <li key={step.label} className="flex shrink-0 items-center gap-2">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-xs font-semibold",
                  isCurrent && "bg-(--accent-500) text-white",
                  isCompleted && "bg-(--success-600) text-white",
                  !isCurrent && !isCompleted && "bg-(--bg-card-hover) text-(--text-muted)"
                )}
              >
                {isCompleted ? <Check className="size-3.5" /> : stepNumber}
              </span>
              <span
                className={cn(
                  "text-sm font-medium whitespace-nowrap",
                  isCurrent ? "text-(--text-primary)" : "text-(--text-muted)"
                )}
              >
                {step.label}
              </span>
            </div>
            {stepNumber < steps.length ? (
              <div
                className={cn(
                  "h-px w-8 shrink-0",
                  isCompleted ? "bg-(--success-600)" : "bg-(--border-subtle)"
                )}
              />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
