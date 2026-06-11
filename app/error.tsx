"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg p-6 text-center">
      <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
        <TriangleAlert className="size-7" />
      </span>
      <h1 className="font-display text-2xl font-semibold tracking-[-0.01em]">
        Something went wrong
      </h1>
      <p className="max-w-sm text-sm text-ink-2">
        An unexpected error occurred. Try again, or head back to your dashboard.
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
