"use client";

import { useEffect, useState } from "react";
import { formatDate } from "@/lib/format";

/**
 * Renders a booking's start time in the VISITOR's local timezone. The server runs in
 * UTC, so SSR + the first client render show a TZ-stable date (formatDate, from the
 * YYYY-MM-DD part) — they match, so no hydration mismatch — and after mount we upgrade
 * to the full localized date + time (the requirement: the client's own timezone).
 */
export function BookingTime({ iso, className }: { iso: string; className?: string }) {
  const [local, setLocal] = useState<string | null>(null);
  useEffect(() => {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) {
      setLocal(
        d.toLocaleString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
      );
    }
  }, [iso]);

  return (
    <span className={className} suppressHydrationWarning>
      {local ?? formatDate(iso.slice(0, 10))}
    </span>
  );
}
