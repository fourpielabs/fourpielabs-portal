import { Skeleton } from "@/components/ui/skeleton";

/** Neutral dashboard skeleton — fits the admin KPI row, the client KPIs, and the
 *  team client-picker grid (no role-specific 4-stat shape that mis-predicts team). */
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
