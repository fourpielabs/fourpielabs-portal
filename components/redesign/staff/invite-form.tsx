"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Send } from "lucide-react";

import { inviteSchema, type InviteValues } from "@/lib/schemas";
import { sendInviteAction } from "@/lib/actions/users";
import { STAFF_ROLES } from "@/lib/constants";
import { Input, Select, EmberButton } from "@/components/redesign/ui";
import { Field } from "./ui";

/**
 * R3 staff invite form (re-skinned). RHF + Zod + sendInviteAction wiring preserved
 * verbatim — only the presentation swaps to the ember-glass kit (SOLID inputs,
 * Fluent controlled signatures). Lives inside a TitledPanel at the call site.
 */
export function InviteForm() {
  const [submitting, setSubmitting] = useState(false);
  const {
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
      style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 16 }}
    >
      <div style={{ width: "11rem", flexGrow: 1, minWidth: "9rem" }}>
        <Controller
          control={control}
          name="full_name"
          render={({ field }) => (
            <Field label="Name · optional">
              <Input value={field.value ?? ""} placeholder="Casey Jones" onChange={(_, d) => field.onChange(d.value)} />
            </Field>
          )}
        />
      </div>

      <div style={{ flex: 2, minWidth: "13.75rem" }}>
        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <Field label="Email address" error={errors.email?.message}>
              <Input
                type="email"
                value={field.value}
                placeholder="casey@premierpainting.com"
                onChange={(_, d) => field.onChange(d.value)}
              />
            </Field>
          )}
        />
      </div>

      <div style={{ width: "10rem", flexGrow: 1, minWidth: "8rem" }}>
        <Controller
          control={control}
          name="role"
          render={({ field }) => (
            <Field label="Role">
              <Select value={field.value} onChange={(e) => field.onChange(e.target.value)}>
                {STAFF_ROLES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        />
      </div>

      <EmberButton type="submit" loading={submitting} icon={<Send size={16} />}>
        {submitting ? "Sending…" : "Send invite"}
      </EmberButton>
    </form>
  );
}
