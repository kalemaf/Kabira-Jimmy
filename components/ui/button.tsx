import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

// Button anatomy — design-style-guide.md §7.1. Pill radius, 40/36/44px heights,
// opacity-based hover (not color-shift) to match the reference's monochrome language.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-150 ease-out outline-none select-none active:scale-[0.98] active:duration-100 disabled:pointer-events-none focus-visible:shadow-[var(--shadow-focus)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:opacity-90 disabled:bg-(--bg-card-hover) disabled:text-(--text-muted)",
        outline:
          "border border-(--border-strong) bg-transparent text-(--text-primary) hover:bg-(--bg-card-hover) disabled:border-(--border-subtle) disabled:text-(--text-muted)",
        ghost:
          "bg-transparent text-(--text-secondary) hover:bg-(--bg-card-hover) disabled:text-(--text-muted)",
        destructive:
          "bg-(--error-600) text-white hover:brightness-90 disabled:bg-(--bg-card-hover) disabled:text-(--text-muted)",
        link:
          "rounded-md text-(--accent-500) underline-offset-4 decoration-(--border-strong) hover:text-(--accent-600) hover:underline disabled:text-(--text-muted)",
      },
      size: {
        default: "h-10 px-5",
        sm: "h-9 px-4 text-[13px]",
        lg: "h-11 px-6",
        icon: "size-9",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & { loading?: boolean }) {
  return (
    <ButtonPrimitive
      data-slot="button"
      aria-disabled={disabled || loading}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" /> : null}
      {children}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
