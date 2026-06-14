"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CircleAlert } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { AuthError, AuthInput, AuthLabel } from "@/components/auth/auth-frame";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState(false);
  const { register, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword(values);
    if (error) {
      setSubmitting(false);
      setAuthError(true); // generic — the system can't say which credential failed
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  const clear = () => authError && setAuthError(false);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-3xl font-semibold tracking-[-0.015em] text-dark-ink">
          Sign in to your portal
        </h2>
        <p className="text-sm text-dark-ink-2">Your email and password — that&apos;s it.</p>
      </div>

      {authError && (
        <AuthError>
          <CircleAlert className="mt-px size-4 shrink-0" />
          <span>That email and password don&apos;t match. Try again, or reset your password.</span>
        </AuthError>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <AuthLabel htmlFor="email">Email address</AuthLabel>
          <AuthInput
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@premierpainting.com"
            aria-invalid={authError}
            {...register("email", { onChange: clear })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <AuthLabel htmlFor="password">Password</AuthLabel>
            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-amber-400 hover:text-amber-200"
            >
              Forgot password?
            </Link>
          </div>
          <AuthInput
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            aria-invalid={authError}
            {...register("password", { onChange: clear })}
          />
        </div>
        <Button type="submit" variant="amber" size="lg" className="mt-1.5 w-full" loading={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </div>
    </form>
  );
}
