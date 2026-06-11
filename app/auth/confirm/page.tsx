import Link from "next/link";
import { verifyEmailOtpAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

/**
 * Interstitial for email links (invite / recovery / email-change). The token is
 * verified ONLY when the human clicks "Continue" (a POST to verifyEmailOtpAction)
 * — not on the bare GET that loads this page. This prevents email-prefetch
 * scanners (e.g. Gmail) from consuming the one-time token before the user clicks
 * (which previously showed up as "expired link").
 */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>;
}) {
  const { token_hash, type, next } = await searchParams;
  const valid = Boolean(token_hash && type);

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <div className="mb-6 flex items-center justify-center gap-2 text-xl font-semibold tracking-tight">
          <span className="inline-block size-3 rounded-full bg-primary" />
          4Pie Labs
        </div>

        {valid ? (
          <form action={verifyEmailOtpAction} className="space-y-4">
            <input type="hidden" name="token_hash" value={token_hash} />
            <input type="hidden" name="type" value={type} />
            <input type="hidden" name="next" value={next ?? "/dashboard"} />
            <h1 className="text-lg font-semibold">You&apos;re almost there</h1>
            <p className="text-sm text-muted-foreground">
              Click below to continue to your 4Pie Labs portal.
            </p>
            <Button type="submit" className="w-full">
              Continue
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            <h1 className="text-lg font-semibold">Link is invalid or expired</h1>
            <p className="text-sm text-muted-foreground">
              Please ask for a fresh invitation, or reset your password.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">Back to sign in</Link>
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
