import Link from "next/link";

import { BrandLogo } from "@/components/ui/brand-logo";
import { AuthHero } from "@/components/auth/hero/auth-hero";
import { AuthCardReveal } from "@/components/auth/auth-card-reveal";

/**
 * Split-screen auth shell over the living hero (charcoal forms drifting through
 * cream light). The card is frosted smoked glass — its dark scrim keeps form text
 * at WCAG AA while the backdrop breathes through the edges and margins. Form panel
 * holds `children`; the brand panel (amber glow + statement) shows on desktop.
 * `brand={false}` renders a single centered card (confirm / expired / interstitials).
 * The hero degrades to a crafted static composition on mobile / reduced-motion /
 * no-WebGL, and the 3D ships as a lazy chunk (zero three.js in the app bundle).
 */
export function AuthFrame({
  children,
  brand = true,
}: {
  children: React.ReactNode;
  brand?: boolean;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f4efe4] p-4 sm:p-8">
      {/* living hero backdrop — decorative; crafted static fallback + lazy 3D island */}
      <AuthHero />

      <AuthCardReveal
        className={`relative z-10 grid w-full overflow-hidden rounded-3xl border border-white/10 shadow-[0_30px_80px_-16px_rgba(28,20,10,0.55)] ${
          brand ? "max-w-[1160px] lg:grid-cols-[480px_1fr]" : "max-w-md"
        }`}
      >
        {/* form column (mobile brand header + form panel) — frosted smoked glass over the hero */}
        <div className="relative flex flex-col bg-[rgba(17,17,20,0.92)] backdrop-blur-2xl backdrop-saturate-150">
          {brand && (
            <div
              className="relative overflow-hidden border-b border-dark-border px-6 pt-7 pb-6 lg:hidden"
              style={{
                background:
                  "radial-gradient(140% 100% at 85% 0%, rgba(217,119,6,0.26), rgba(217,119,6,0.05) 55%, transparent 80%), #101012",
              }}
            >
              <div className="relative text-[17px] text-dark-ink">
                <BrandLogo dark />
              </div>
              <div className="relative mt-3.5 max-w-[300px] font-display text-2xl leading-[1.15] font-semibold tracking-[-0.015em] text-dark-ink">
                Every number, deliverable, and win — in one place.
              </div>
            </div>
          )}

          <div className="flex flex-1 flex-col gap-10 p-8 sm:p-12 lg:min-h-[660px]">
            <Link
              href="/login"
              className={`text-[19px] text-dark-ink ${brand ? "hidden lg:block" : ""}`}
            >
              <BrandLogo dark />
            </Link>
            <div className="flex flex-1 flex-col justify-center">{children}</div>
            <p className="text-[12.5px] text-ink-3">
              Need help?{" "}
              <a
                href="mailto:team@fourpielabs.com"
                className="font-semibold text-dark-ink-2 underline underline-offset-2 hover:text-dark-ink"
              >
                team@fourpielabs.com
              </a>
            </p>
          </div>
        </div>

        {/* brand panel (desktop) */}
        {brand && (
          <div
            className="relative hidden flex-col justify-end overflow-hidden p-14 backdrop-blur-2xl backdrop-saturate-150 lg:flex"
            style={{
              background:
                "radial-gradient(110% 90% at 78% 8%, rgba(217,119,6,0.30), rgba(217,119,6,0.06) 48%, transparent 72%), rgba(16,16,18,0.86)",
            }}
          >
            <div
              className="pointer-events-none absolute top-[14%] right-[-120px] size-[380px] rounded-full border border-white/5"
              style={{ background: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.05), transparent 60%)" }}
            />
            <div
              className="pointer-events-none absolute right-[22%] bottom-[-80px] size-[220px] rounded-full border border-white/[0.04]"
              style={{ background: "radial-gradient(circle at 30% 30%, rgba(217,119,6,0.10), transparent 65%)" }}
            />
            <div className="relative flex max-w-[480px] flex-col gap-[18px]">
              <span className="text-[11px] font-bold tracking-[0.12em] text-amber-400 uppercase">
                Client portal
              </span>
              <div className="font-display text-[42px] leading-[1.1] font-semibold tracking-[-0.015em] text-balance text-dark-ink">
                Every number, deliverable, and win — in one place.
              </div>
              <p className="text-[15px] leading-[1.6] text-balance text-dark-ink-2">
                Your roadmap, your deliverables, your numbers — live. Proof, not
                promises.
              </p>
              <span className="mt-1.5 inline-flex w-fit items-center gap-2 rounded-full border border-[rgba(217,119,6,0.35)] bg-[rgba(217,119,6,0.12)] px-3.5 py-[7px] text-[12.5px] font-semibold text-amber-400">
                <span className="size-1.5 rounded-full bg-amber-400" />
                Live · updated monthly
              </span>
            </div>
          </div>
        )}
      </AuthCardReveal>
    </main>
  );
}

/** Shared dark-field styling (reused by AuthInput + PasswordInput). */
export const authInputClass =
  "h-12 w-full rounded-xl border border-dark-border bg-[rgba(255,255,255,0.045)] px-4 text-sm text-dark-ink outline-none transition-all placeholder:text-ink-3 focus:border-amber-600 focus:shadow-[0_0_0_3px_rgba(217,119,6,0.22)] aria-[invalid=true]:border-[rgba(248,113,113,0.55)]";

/** Dark field for the auth shell. */
export const AuthInput = function AuthInput({
  className = "",
  ...props
}: React.ComponentProps<"input">) {
  return <input {...props} className={`${authInputClass} ${className}`} />;
};

export function AuthLabel({ children, ...props }: React.ComponentProps<"label">) {
  return (
    <label className="text-[13px] font-semibold text-dark-ink" {...props}>
      {children}
    </label>
  );
}

export function AuthError({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-[rgba(248,113,113,0.35)] bg-[rgba(220,38,38,0.14)] px-3.5 py-3 text-[13px] leading-snug text-[#FCA5A5]">
      {children}
    </div>
  );
}
