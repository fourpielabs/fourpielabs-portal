"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { AuthLabel } from "@/components/auth/auth-frame";
import { PasswordInput } from "@/components/auth/password-input";

/** Map Supabase password errors to human copy (never leak raw SDK strings). */
function friendlyPwError(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes("different")) return "Choose a password you haven't used before.";
  if (m.includes("least") || m.includes("weak") || m.includes("short") || m.includes("characters"))
    return "Use a longer, stronger password — at least 12 characters.";
  return "Please try again, or request a fresh link.";
}

const schema = z
  .object({
    password: z.string().min(12, "Use at least 12 characters"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  });
type FormValues = z.infer<typeof schema>;

export default function AcceptInvitePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
      setChecking(false);
    });
  }, []);

  async function onSubmit({ password }: FormValues) {
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setSubmitting(false);
      toast.error("Couldn't set your password", {
        description: friendlyPwError(error.message),
      });
      return;
    }
    toast.success("Password set — you're all set!");
    router.replace("/dashboard");
    router.refresh();
  }

  if (checking) {
    return (
      <div className="flex min-h-[140px] items-center justify-center text-dark-ink-2">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (!hasSession) {
    return (
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
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-3xl font-semibold tracking-[-0.015em] text-dark-ink">
          Set your password
        </h2>
        <p className="text-sm text-dark-ink-2">
          Choose a password to finish setting up your account.
        </p>
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <AuthLabel htmlFor="password">New password</AuthLabel>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            {...register("password")}
          />
          {errors.password ? (
            <p className="text-xs text-[#FCA5A5]">{errors.password.message}</p>
          ) : (
            <p className="text-xs text-ink-3">
              At least 12 characters. A longer passphrase is strongest.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <AuthLabel htmlFor="confirm">Confirm password</AuthLabel>
          <PasswordInput
            id="confirm"
            autoComplete="new-password"
            aria-invalid={!!errors.confirm}
            {...register("confirm")}
          />
          {errors.confirm && (
            <p className="text-xs text-[#FCA5A5]">{errors.confirm.message}</p>
          )}
        </div>
        <Button type="submit" variant="amber" size="lg" className="w-full" loading={submitting}>
          {submitting ? "Saving…" : "Set password & continue"}
        </Button>
      </div>
    </form>
  );
}
