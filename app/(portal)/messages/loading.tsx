import { Skeleton } from "@/components/ui/skeleton";

// Chat-shaped skeleton (the generic dashboard grid mis-predicts a conversation).
export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Skeleton className="h-[70vh] min-h-[440px] rounded-2xl" />
    </div>
  );
}
