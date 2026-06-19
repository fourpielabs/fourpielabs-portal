import "@/app/(redesign)/redesign.css";
import { BrandLogo } from "@/components/ui/brand-logo";
import { AuthHero } from "@/components/auth/hero/auth-hero";
import { AuthCardReveal } from "@/components/auth/auth-card-reveal";
import { GlassSurface } from "@/components/redesign/ui";

/**
 * R4 — the finalized R0 keystone auth shell. A single frosted ember-glass card
 * (Warm Obsidian `rd-glass--dark--strong--ember`) floating over the reused,
 * capability-gated 3D hero, with an obsidian scrim reading the warm hero as "night".
 * The card enters on the phase-3 Motion spring (`AuthCardReveal`). Form CONTROLS
 * render SOLID inside the glass pane (the "glass forbidden on forms" rule holding
 * inside an allowed pane). The hero degrades to the crafted static composition on
 * mobile / reduced-motion / no-WebGL, and the 3D ships as a lazy chunk (zero three.js
 * in the app bundle). Auth LOGIC / routing / copy live in the page children — untouched.
 *
 * `brand` is retained for call-site compatibility (e.g. the confirm interstitial passes
 * `brand={false}`); the design is a single centered card either way.
 */
export function AuthFrame({
  children,
  brand = true,
}: {
  children: React.ReactNode;
  brand?: boolean;
}) {
  void brand;
  return (
    <main
      className="rd-root"
      style={{
        position: "relative",
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
        background: "#0f0d0a",
        padding: "clamp(1.25rem, 5vw, 3rem)",
      }}
    >
      {/* living hero backdrop — decorative; crafted static fallback + lazy 3D island */}
      <AuthHero />
      {/* obsidian scrim so the warm hero reads as "night" behind the dark glass */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(80% 70% at 50% 42%, rgba(16,13,10,0.58), rgba(16,13,10,0.86) 100%)",
        }}
      />

      <AuthCardReveal className="relative z-10 w-full max-w-[440px]">
        <GlassSurface
          dark
          strong
          ember
          style={{
            width: "100%",
            borderRadius: 28,
            padding: "clamp(1.75rem, 4vw, 2.5rem)",
            display: "flex",
            flexDirection: "column",
            gap: "1.75rem",
          }}
        >
          <div style={{ fontSize: "1.25rem" }}>
            <BrandLogo dark />
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>{children}</div>

          <p className="text-[12.5px] text-[#b3aca0]">
            Need help?{" "}
            <a
              href="mailto:team@fourpielabs.com"
              className="font-semibold text-dark-ink-2 underline underline-offset-2 hover:text-dark-ink"
            >
              team@fourpielabs.com
            </a>
          </p>
        </GlassSurface>
      </AuthCardReveal>
    </main>
  );
}

/**
 * Shared SOLID dark field for the auth card (reused by AuthInput + PasswordInput) — a
 * flat semi-opaque fill (NO backdrop blur → solid, not glass) on the Warm Obsidian
 * palette, with the amber focus ring.
 */
export const authInputClass =
  "h-12 w-full rounded-xl border border-[#38322a] bg-[rgba(255,255,255,0.055)] px-4 text-[15px] text-dark-ink outline-none transition-all placeholder:text-[#8a8278] focus:border-[#d97706] focus:bg-[rgba(255,255,255,0.08)] focus:shadow-[0_0_0_3px_rgba(217,119,6,0.25)] aria-[invalid=true]:border-[rgba(248,113,113,0.6)] aria-[invalid=true]:shadow-[0_0_0_3px_rgba(248,113,113,0.18)]";

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
      className="flex items-start gap-2.5 rounded-xl border border-[rgba(248,113,113,0.35)] bg-[rgba(220,38,38,0.14)] px-3.5 py-3 text-[13px] leading-snug text-[#FCA5A5]"
    >
      {children}
    </div>
  );
}
