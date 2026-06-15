"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { inviteSchema, type InviteValues } from "@/lib/schemas";
import { sendInviteAction } from "@/lib/actions/users";
import { STAFF_ROLES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function InviteForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", full_name: "", role: "team" },
  });

  async function onSubmit(values: InviteValues) {
    setSubmitting(true);
    const res = await sendInviteAction(values);
    setSubmitting(false);
    if (!res.ok) {
      toast.error("Invite not sent", { description: res.error });
      return;
    }
    toast.success(`Invitation sent to ${values.email}.`);
    reset();
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <div className="space-y-1.5 sm:w-44">
        <Label htmlFor="full_name">
          Name <span className="font-normal text-ink-3">· optional</span>
        </Label>
        <Input id="full_name" placeholder="Casey Jones" {...register("full_name")} />
      </div>

      <div className="flex-1 space-y-1.5 sm:min-w-[220px]">
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          type="email"
          placeholder="casey@premierpainting.com"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-1.5 sm:w-40">
        <Label>Role</Label>
        <Controller
          control={control}
          name="role"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAFF_ROLES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <Button type="submit" variant="amber" loading={submitting}>
        {submitting ? "Sending…" : "Send invite"}
      </Button>
    </form>
  );
}
