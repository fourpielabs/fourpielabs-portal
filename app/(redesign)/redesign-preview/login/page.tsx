"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import {
  FluentProvider,
  Button,
  Input,
  Field,
  Spinner,
  tokens,
} from "@fluentui/react-components";

import { createClient } from "@/lib/supabase/client";
import { redesignDarkTheme } from "@/lib/redesign/brand-theme";
import { BrandLogo } from "@/components/ui/brand-logo";
import { AuthHero } from "@/components/auth/hero/auth-hero";
import { Shell, GlassSurface, Eyebrow } from "@/components/redesign/ui";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

/**
 * Keystone 1 — AUTH. The ember-glass card is the single-mode "night" moment: a
 * dark glass pane floating over the reused, capability-gated 3D hero. The hero +
 * sign-in LOGIC are untouched (same Supabase signInWithPassword, same Zod rules);
 * only the presentation is new. Glass is allowed here (the auth hero), but the
 * form CONTROLS render SOLID — Fluent inputs on the dark theme's opaque surface —
 * which is the "glass forbidden on forms" rule holding inside an allowed pane.
 */
export default function RedesignLoginPreview() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPw, setShowPw] = React.useState(false);
  const [errors, setErrors] = React.useState<{ email?: string; password?: string }>({});
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      const fieldErrors: { email?: string; password?: string } = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as "email" | "password";
        fieldErrors[key] ??= issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) {
      setAuthError("That email and password don't match. Try again, or reset your password.");
      setLoading(false);
      return;
    }
    // Preview: flow into the redesign dashboard keystone (same auth mechanism).
    router.replace("/redesign-preview/dashboard");
    router.refresh();
  }

  const card = (
    <FluentProvider theme={redesignDarkTheme} className="rd-root" style={{ background: "transparent" }}>
      <GlassSurface
        dark
        strong
        ember
        style={{
          width: "100%",
          maxWidth: 440,
          borderRadius: 28,
          padding: "clamp(1.75rem, 4vw, 2.5rem)",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ fontSize: "1.25rem" }}>
            <BrandLogo dark />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <Eyebrow tone="onDark">Client portal</Eyebrow>
            <h1
              className="rd-display"
              style={{ margin: 0, fontSize: "1.9rem", fontWeight: 600, color: tokens.colorNeutralForeground1 }}
            >
              Welcome back
            </h1>
            <p style={{ margin: 0, fontSize: "0.92rem", color: tokens.colorNeutralForeground2 }}>
              Sign in to see your numbers, deliverables and program.
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }} noValidate>
          <Field
            label="Email"
            validationState={errors.email ? "error" : "none"}
            validationMessage={errors.email}
          >
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(_, d) => setEmail(d.value)}
              placeholder="you@business.com"
              size="large"
            />
          </Field>

          <Field
            label="Password"
            validationState={errors.password ? "error" : "none"}
            validationMessage={errors.password}
          >
            <Input
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(_, d) => setPassword(d.value)}
              size="large"
              contentAfter={
                <Button
                  appearance="transparent"
                  size="small"
                  type="button"
                  icon={showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  onClick={() => setShowPw((s) => !s)}
                />
              }
            />
          </Field>

          {authError && (
            <div
              role="alert"
              style={{
                fontSize: "0.85rem",
                color: "#fca5a5",
                background: "rgba(220,38,38,0.12)",
                border: "1px solid rgba(220,38,38,0.3)",
                borderRadius: 10,
                padding: "0.6rem 0.75rem",
              }}
            >
              {authError}
            </div>
          )}

          <Button
            type="submit"
            appearance="primary"
            size="large"
            disabled={loading}
            style={{ width: "100%" }}
          >
            {loading ? <Spinner size="tiny" label="Signing in…" /> : "Sign in"}
          </Button>

          <Link
            href="/forgot-password"
            style={{ fontSize: "0.85rem", color: tokens.colorBrandForeground1, textAlign: "center", textDecoration: "none" }}
          >
            Forgot your password?
          </Link>
        </form>
      </GlassSurface>
    </FluentProvider>
  );

  return (
    <Shell>
      {/* reused, capability + reduced-motion gated 3D hero (logic untouched) */}
      <AuthHero />
      {/* obsidian scrim so the warm hero reads as "night" behind the dark glass */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          background:
            "radial-gradient(80% 70% at 50% 45%, rgba(16,13,10,0.62), rgba(16,13,10,0.86) 100%)",
        }}
      />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: "clamp(1.5rem, 5vw, 3rem)",
        }}
      >
        <div className="rd-pop" style={{ width: "100%", maxWidth: 440 }}>
          {card}
        </div>
      </div>
    </Shell>
  );
}
