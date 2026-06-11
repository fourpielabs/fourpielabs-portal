"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { MailCheck } from "lucide-react";

import { sendPasswordResetAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { AuthInput, AuthLabel } from "@/components/auth/auth-frame";

const schema = z.object({ email: z.string().email("Enter a valid email") });
type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const { register, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  async function onSubmit({ email }: FormValues) {
    setSubmitting(true);
    const res = await sendPasswordResetAction(email);
    setSubmitting(false);
    if (!res.ok) {
      toast.error("Couldn't send reset email", { description: res.error });
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-5">
        <span className="inline-flex size-11 items-center justify-center rounded-full bg-[rgba(217,119,6,0.12)] text-amber-400">
          <MailCheck className="size-5" />
        </span>
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-3xl font-semibold tracking-[-0.015em] text-dark-ink">
            Check your inbox
          </h2>
          <p className="text-sm leading-relaxed text-dark-ink-2">
            If an account exists for that email, a reset link is on its way.
          </p>
        </div>
        <Button asChild variant="outline" size="lg" className="w-full border-dark-border bg-transparent text-dark-ink hover:bg-white/5 hover:border-dark-ink-2">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-3xl font-semibold tracking-[-0.015em] text-dark-ink">
          Reset your password
        </h2>
        <p className="text-sm text-dark-ink-2">
          We&apos;ll email you a link to set a new one.
        </p>
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <AuthLabel htmlFor="email">Email address</AuthLabel>
          <AuthInput
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@premierpainting.com"
            {...register("email")}
          />
        </div>
        <Button type="submit" variant="amber" size="lg" className="w-full" disabled={submitting}>
          {submitting ? "Sending…" : "Send reset link"}
        </Button>
        <Link
          href="/login"
          className="text-center text-xs font-semibold text-amber-400 hover:text-amber-200"
        >
          Back to sign in
        </Link>
      </div>
    </form>
  );
}
