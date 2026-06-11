"use client";

import { useEffect, useState } from "react";

/**
 * Time-of-day greeting from the browser clock. SSR renders the neutral
 * "Welcome" to avoid a hydration mismatch; the client swaps in
 * Morning/Afternoon/Evening on mount.
 */
export function Greeting({
  name,
  monthLabel,
}: {
  name: string;
  monthLabel: string;
}) {
  const [tod, setTod] = useState<string | null>(null);

  useEffect(() => {
    const h = new Date().getHours();
    setTod(h < 12 ? "Morning" : h < 18 ? "Afternoon" : "Evening");
  }, []);

  return (
    <h1 className="font-display text-4xl leading-[1.05] font-medium tracking-[-0.02em] text-balance sm:text-5xl">
      {tod ? `${tod}, ${name}` : `Welcome, ${name}`} —{" "}
      {monthLabel ? (
        <>
          here&apos;s <span className="font-bold">{monthLabel}</span> at a glance
        </>
      ) : (
        <>your portal at a glance</>
      )}
    </h1>
  );
}
