"use client"

import { useEffect } from "react"
import { AlertOctagon } from "lucide-react"

export default function GlobalError({
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
    <html lang="en" className="dark">
      <body style={{ background: "#0A0A0A", color: "#FAFAFA" }}>
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
          <div className="flex size-18 items-center justify-center rounded-full bg-[#241213]">
            <AlertOctagon className="size-12 text-[#F0605A]" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-[18px] font-semibold">Nexcgen hit a critical error</h1>
            <p className="mx-auto mt-1 max-w-[400px] text-sm text-[#A1A1A1]">
              The application failed to render. Please reload the page.
            </p>
          </div>
          <button
            type="button"
            onClick={() => reset()}
            className="h-10 rounded-full bg-[#FAFAFA] px-5 text-sm font-medium text-[#0A0A0A]"
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  )
}
