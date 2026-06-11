import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg p-6 text-center">
      <span className="font-display text-6xl font-bold text-amber-600">404</span>
      <h1 className="font-display text-2xl font-semibold tracking-[-0.01em]">
        Page not found
      </h1>
      <p className="max-w-sm text-sm text-ink-2">
        The page you&apos;re looking for doesn&apos;t exist, or you don&apos;t have
        access to it.
      </p>
      <Button asChild variant="amber">
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </main>
  );
}
