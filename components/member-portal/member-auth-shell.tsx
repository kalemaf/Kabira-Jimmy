import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"
import { ChevronLeft, ShieldCheck } from "lucide-react"

export function MemberAuthShell({
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
    <div className="flex min-h-screen">
      {/* Marketing panel — hidden on small screens, full-height on desktop */}
      <div className="relative hidden w-[44%] shrink-0 overflow-hidden lg:block">
        <Image
          src="/display.png"
          alt=""
          fill
          priority
          sizes="44vw"
          className="object-cover object-right"
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(10,10,10,0.15) 0%, rgba(10,10,10,0.55) 65%, rgba(10,10,10,0.85) 100%)" }}
        />
        <div className="relative flex h-full flex-col justify-between p-10">
          <span className="text-[26px] font-bold tracking-[-0.01em] text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]">
            nexcgen
          </span>
          <div className="max-w-md">
            <h2 className="text-[30px] leading-[1.15] font-bold text-white">
              Your savings and loans, always within reach.
            </h2>
            <p className="mt-3 text-[15px] leading-[1.6] text-white/85">
              Check balances, track repayments, and top up your savings yourself — securely,
              from anywhere.
            </p>
            <div className="mt-6 flex items-center gap-2 text-sm font-medium text-white/90">
              <ShieldCheck className="size-4" strokeWidth={1.75} />
              Bank-grade security, member self-service
            </div>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <section className="flex flex-1 flex-col items-center justify-center gap-4 bg-(--bg-canvas) px-4 py-16">
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
            <Link href="/" aria-label="Nexcgen home" className="mb-6 inline-block">
              <span className="relative block size-14 overflow-hidden rounded-2xl shadow-[var(--shadow-sm)]">
                <Image src="/nexcgen.png" alt="Nexcgen" fill sizes="56px" priority className="object-cover object-top" />
              </span>
            </Link>
            <h1 className="mb-1 text-[20px] leading-[1.3] font-semibold text-(--text-primary)">
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
    </div>
  )
}
