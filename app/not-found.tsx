import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-5 overflow-hidden bg-[#f8f5ef] p-6 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(58% 44% at 50% 4%, rgba(245,158,11,0.14), transparent 62%)" }}
      />
      <span className="relative inline-flex size-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
        <Compass className="size-7" />
      </span>
      <span className="relative font-display text-[64px] leading-none font-bold tracking-[-0.02em] text-amber-600">
        404
      </span>
      <h1 className="relative font-display text-2xl font-semibold tracking-[-0.01em] text-ink">
        Page not found
      </h1>
      <p className="relative max-w-sm text-sm text-ink-2">
        The page you&apos;re looking for doesn&apos;t exist, or you don&apos;t have access to it.
      </p>
      <Button asChild variant="amber" className="relative">
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </main>
  );
}
