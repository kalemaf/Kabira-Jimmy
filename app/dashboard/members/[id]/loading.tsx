import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="flex-1 space-y-4 px-4 py-6 md:px-8">
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </main>
  );
}
