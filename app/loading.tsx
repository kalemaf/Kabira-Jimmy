import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-(--bg-canvas) px-4">
      <Skeleton className="h-10 w-40 rounded-full" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-4 w-48" />
    </div>
  )
}
