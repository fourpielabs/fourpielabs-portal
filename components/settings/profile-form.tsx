"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { updateOwnProfileAction } from "@/lib/actions/profile";
import { sendPasswordResetAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const schema = z.object({
  full_name: z.string().trim().min(1, "Enter your name").max(100, "Too long"),
});
type Values = z.infer<typeof schema>;

export function ProfileForm({
  fullName,
  email,
  role,
}: {
  fullName: string | null;
  email: string | null;
  role: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: fullName ?? "" },
  });

  async function onSubmit(v: Values) {
    setSaving(true);
    const res = await updateOwnProfileAction(v);
    setSaving(false);
    if (!res.ok) return toast.error("Couldn't save", { description: res.error });
    toast.success("Profile updated.");
    router.refresh();
  }

  async function sendReset() {
    if (!email) return;
    setResetting(true);
    const res = await sendPasswordResetAction(email);
    setResetting(false);
    if (!res.ok) return toast.error("Couldn't send reset", { description: res.error });
    toast.success("Password reset email sent — check your inbox.");
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your name and account email.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="full_name">Full name</Label>
              <Input
                id="full_name"
                aria-invalid={!!errors.full_name}
                {...register("full_name")}
              />
              {errors.full_name && (
                <p className="text-xs text-danger-text">{errors.full_name.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={email ?? ""} readOnly disabled />
              <p className="text-xs text-ink-3">
                Email is managed by your 4Pie Labs admin and can&apos;t be changed here.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-3">Role</span>
              <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-2 capitalize">
                {role}
              </span>
            </div>
            <div>
              <Button type="submit" loading={saving} disabled={saving || !isDirty}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            We&apos;ll email you a secure link to set a new password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={sendReset} disabled={resetting || !email}>
            {resetting ? "Sending…" : "Send password reset email"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
