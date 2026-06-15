import { Skeleton } from "@/components/ui/skeleton";

/**
 * Content-area skeleton for every per-client tab. This is the nearest Suspense
 * boundary for all tabs that lack their own loading.tsx (it renders below the
 * persistent client header + tabs). The Metrics tab keeps its own, more specific
 * loading.tsx (the 3-column grid).
 */
export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-9 w-36 rounded-full" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-20 rounded-2xl" />
      ))}
    </div>
  );
}
