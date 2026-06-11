import Link from "next/link";

/**
 * Dark split-screen auth shell (K1). Form panel holds `children`; the brand
 * panel (amber glow + statement) shows on desktop. `brand={false}` renders a
 * single centered dark card (confirm / expired / interstitials).
 */
export function AuthFrame({
  children,
  brand = true,
}: {
  children: React.ReactNode;
  brand?: boolean;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#101012] p-4 sm:p-8">
      {/* page glows */}
      <div
        className="pointer-events-none absolute -top-[200px] -right-[100px] size-[700px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(217,119,6,0.16), transparent 65%)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-[260px] left-[12%] size-[600px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.035), transparent 65%)" }}
      />

      <div
        className={`relative grid w-full overflow-hidden rounded-3xl border border-dark-border bg-dark-surface shadow-[0_24px_64px_rgba(0,0,0,0.45)] ${
          brand ? "max-w-[1160px] lg:grid-cols-[480px_1fr]" : "max-w-md"
        }`}
      >
        {/* form column (mobile brand header + form panel) */}
        <div className="flex flex-col">
          {brand && (
            <div
              className="relative overflow-hidden border-b border-dark-border px-6 pt-7 pb-6 lg:hidden"
              style={{
                background:
                  "radial-gradient(140% 100% at 85% 0%, rgba(217,119,6,0.26), rgba(217,119,6,0.05) 55%, transparent 80%), #101012",
              }}
            >
              <div className="relative font-display text-[17px] font-bold tracking-tight text-dark-ink">
                4Pie Labs<span className="text-amber-400">.</span>
              </div>
              <div className="relative mt-3.5 max-w-[300px] font-display text-2xl leading-[1.15] font-semibold tracking-[-0.015em] text-dark-ink">
                Every number, deliverable, and win — in one place.
              </div>
            </div>
          )}

          <div className="flex flex-1 flex-col gap-10 p-8 sm:p-12 lg:min-h-[660px]">
            <Link
              href="/login"
              className={`font-display text-[19px] font-bold tracking-tight text-dark-ink ${brand ? "hidden lg:block" : ""}`}
            >
              4Pie Labs<span className="text-amber-400">.</span>
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
            className="relative hidden flex-col justify-end overflow-hidden p-14 lg:flex"
            style={{
              background:
                "radial-gradient(110% 90% at 78% 8%, rgba(217,119,6,0.30), rgba(217,119,6,0.06) 48%, transparent 72%), #101012",
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
      </div>
    </main>
  );
}

/** Dark field for the auth shell. */
export const AuthInput = function AuthInput({
  className = "",
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={`h-12 w-full rounded-xl border border-dark-border bg-[rgba(255,255,255,0.045)] px-4 text-sm text-dark-ink outline-none transition-all placeholder:text-ink-3 focus:border-amber-600 focus:shadow-[0_0_0_3px_rgba(217,119,6,0.22)] aria-[invalid=true]:border-[rgba(248,113,113,0.55)] ${className}`}
    />
  );
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
    <div className="flex items-start gap-2.5 rounded-xl border border-[rgba(248,113,113,0.35)] bg-[rgba(220,38,38,0.14)] px-3.5 py-3 text-[13px] leading-snug text-[#FCA5A5]">
      {children}
    </div>
  );
}
