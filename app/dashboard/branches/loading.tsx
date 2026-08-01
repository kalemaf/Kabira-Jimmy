import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="flex-1 space-y-4 px-4 py-6 md:px-8">
      <Skeleton className="h-10 w-full max-w-xs rounded-full" />
      <Skeleton className="h-96 w-full rounded-lg" />
    </main>
  );
}
