import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Public landing. Real auth-based routing (redirect to /login or the role's
 * home) is wired in P1 step 4. For now this is a simple branded entry point.
 */
export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-6 font-display text-2xl font-bold tracking-tight">
          4Pie Labs<span className="text-amber-600">.</span>
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.015em] text-balance">
          Your client portal
        </h1>
        <p className="mt-3 text-sm text-ink-2">
          Onboarding, deliverables, performance, and reports — all in one place.
        </p>
        <div className="mt-8">
          <Button asChild variant="amber" size="lg">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
