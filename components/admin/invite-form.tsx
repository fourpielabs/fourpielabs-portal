"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { inviteSchema, type InviteValues } from "@/lib/schemas";
import { sendInviteAction } from "@/lib/actions/users";
import { ROLES } from "@/lib/constants";
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

type ClientOption = { id: string; name: string };

export function InviteForm({ clients }: { clients: ClientOption[] }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", full_name: "", role: "team", client_id: "" },
  });

  const role = watch("role");

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
      className="grid gap-4 sm:grid-cols-2"
    >
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" {...register("email")} />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="full_name">Full name (optional)</Label>
        <Input id="full_name" {...register("full_name")} />
      </div>

      <div className="space-y-2">
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
                {ROLES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {role === "client" && (
        <div className="space-y-2">
          <Label>Client</Label>
          <Controller
            control={control}
            name="client_id"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a client…" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.client_id && (
            <p className="text-sm text-destructive">
              {errors.client_id.message}
            </p>
          )}
        </div>
      )}

      <div className="sm:col-span-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Sending…" : "Send invitation"}
        </Button>
      </div>
    </form>
  );
}
