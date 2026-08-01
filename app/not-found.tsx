import Link from "next/link"
import { FileQuestion } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/logo"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-(--bg-canvas) px-4 text-center">
      <Logo />
      <div className="flex size-18 items-center justify-center rounded-full bg-(--bg-card-hover)">
        <FileQuestion className="size-12 text-(--text-muted)" strokeWidth={1.75} />
      </div>
      <div>
        <h1 className="text-[18px] font-semibold text-(--text-primary)">Page not found</h1>
        <p className="mx-auto mt-1 max-w-[400px] text-sm text-(--text-secondary)">
          The page you&apos;re looking for doesn&apos;t exist or hasn&apos;t been built yet.
        </p>
      </div>
      <Button render={<Link href="/dashboard" />} nativeButton={false}>
        Back to dashboard
      </Button>
    </div>
  )
}
