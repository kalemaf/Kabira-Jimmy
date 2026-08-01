"use client"

import { useEffect } from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/logo"

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-(--bg-canvas) px-4 text-center">
      <Logo />
      <div className="flex size-18 items-center justify-center rounded-full bg-(--error-soft)">
        <AlertTriangle className="size-12 text-(--error-600)" strokeWidth={1.75} />
      </div>
      <div>
        <h1 className="text-[18px] font-semibold text-(--text-primary)">Something went wrong</h1>
        <p className="mx-auto mt-1 max-w-[400px] text-sm text-(--text-secondary)">
          An unexpected error occurred. Try again, or contact support if the problem persists.
        </p>
      </div>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  )
}
