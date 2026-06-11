import Link from "next/link";
import { verifyEmailOtpAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { AuthFrame } from "@/components/auth/auth-frame";

/**
 * Interstitial for email links (invite / recovery / email-change). The token is
 * verified ONLY on a human click (POST to verifyEmailOtpAction) — not on the
 * bare GET — so email-scanner prefetch can't burn the one-time token. Uses the
 * dark auth shell as a single centered card (K1).
 */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>;
}) {
  const { token_hash, type, next } = await searchParams;
  const valid = Boolean(token_hash && type);

  return (
    <AuthFrame brand={false}>
      {valid ? (
        <form action={verifyEmailOtpAction} className="flex flex-col gap-5">
          <input type="hidden" name="token_hash" value={token_hash} />
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="next" value={next ?? "/dashboard"} />
          <div className="flex flex-col gap-2">
            <h2 className="font-display text-3xl font-semibold tracking-[-0.015em] text-dark-ink">
              You&apos;re almost there
            </h2>
            <p className="text-sm leading-relaxed text-dark-ink-2">
              Click below to continue to your 4Pie Labs portal.
            </p>
          </div>
          <Button type="submit" variant="amber" size="lg" className="w-full">
            Continue
          </Button>
        </form>
      ) : (
        <div className="flex flex-col gap-5">
          <h2 className="font-display text-3xl font-semibold tracking-[-0.015em] text-dark-ink">
            Link is invalid or expired
          </h2>
          <p className="text-sm leading-relaxed text-dark-ink-2">
            Please ask for a fresh invitation, or reset your password.
          </p>
          <div className="flex flex-col gap-2.5">
            <Button asChild variant="amber" size="lg" className="w-full">
              <Link href="/forgot-password">Reset password</Link>
            </Button>
            <Link
              href="/login"
              className="text-center text-xs font-semibold text-amber-400 hover:text-amber-200"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      )}
    </AuthFrame>
  );
}
