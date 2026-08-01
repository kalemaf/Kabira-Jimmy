import Link from "next/link"
import type { ReactNode } from "react"
import { ChevronLeft } from "lucide-react"
import { Logo } from "@/components/logo"

export function AuthShell({
  title,
  description,
  children,
  footer,
  backHref = "/",
  backLabel = "Back to home",
}: {
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  backHref?: string
  backLabel?: string
}) {
  return (
    <section className="flex min-h-screen flex-col items-center justify-center gap-4 bg-(--bg-canvas) px-4 py-16">
      <div className="w-full max-w-md">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-(--text-secondary) transition-colors hover:text-(--text-primary)"
        >
          <ChevronLeft className="size-4" strokeWidth={1.75} />
          {backLabel}
        </Link>
      </div>
      <div className="w-full max-w-md overflow-hidden rounded-[1.125rem] border border-(--border-subtle) bg-(--bg-card) shadow-[var(--shadow-xl)]">
        <div className="p-8">
          <Link href="/" aria-label="Nexcgen home" className="inline-block">
            <Logo />
          </Link>
          <h1 className="mt-6 mb-1 text-[18px] leading-[1.3] font-semibold text-(--text-primary)">
            {title}
          </h1>
          {description ? (
            <p className="text-sm text-(--text-secondary)">{description}</p>
          ) : null}
          <div className="mt-6">{children}</div>
        </div>
        {footer ? (
          <div className="border-t border-(--border-subtle) bg-(--bg-surface) p-4">
            <p className="text-center text-sm text-(--text-secondary)">{footer}</p>
          </div>
        ) : null}
      </div>
    </section>
  )
}
