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
        <div className="mb-6 inline-flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <span className="inline-block size-3 rounded-full bg-primary" />
          4Pie Labs
        </div>
        <h1 className="text-balance text-3xl font-semibold tracking-tight">
          Your client portal
        </h1>
        <p className="mt-3 text-muted-foreground">
          Onboarding, deliverables, performance, and reports — all in one place.
        </p>
        <div className="mt-8">
          <Button asChild size="lg">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
