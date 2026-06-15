"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { clientCreateSchema, type ClientCreateValues } from "@/lib/schemas";
import { createClientAction } from "@/lib/actions/clients";
import { INDUSTRIES, PROGRAMS, CLIENT_STATUSES, CLIENT_TYPES } from "@/lib/constants";
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

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function ClientCreateForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors, dirtyFields },
  } = useForm<ClientCreateValues>({
    resolver: zodResolver(clientCreateSchema),
    defaultValues: {
      name: "",
      slug: "",
      industry: "painting_contractor",
      program: "pipeline",
      client_type: "program",
      status: "onboarding",
      website_url: "",
      start_date: "",
      client_email: "",
      client_full_name: "",
    },
  });

  const clientType = watch("client_type");

  async function onSubmit(values: ClientCreateValues) {
    setSubmitting(true);
    const res = await createClientAction(values);
    if (!res.ok) {
      setSubmitting(false);
      toast.error("Couldn't create client", { description: res.error });
      return;
    }
    if (res.data?.inviteError) {
      // Client row was created, but the welcome email failed — surface it so the
      // admin can retry from the Users page rather than silently losing the user.
      toast.warning("Client created, but the account email didn't send", {
        description: res.data.inviteError,
      });
    } else if (values.client_email) {
      toast.success("Client created — welcome email sent to the account.");
    } else {
      toast.success(
        values.client_type === "project"
          ? "Project client created."
          : "Client created — onboarding, roadmap & metrics seeded.",
      );
    }
    router.push(`/clients/${res.data!.id}/settings`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-xl space-y-5">
      {/* Client type is the FIRST decision — the rest of the form reacts to it. */}
      <div className="space-y-2 rounded-xl border border-border bg-bg p-4">
        <Label>Client type</Label>
        <Controller
          control={control}
          name="client_type"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLIENT_TYPES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <p className="text-xs text-ink-3">
          {clientType === "project"
            ? "Projects board — no program tier, 90-day roadmap, or metrics. The client manages their own scoped projects."
            : "Program engagement — seeds the onboarding checklist, 90-day roadmap & program metrics."}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Business name</Label>
        <Input
          id="name"
          {...register("name", {
            onChange: (e) => {
              if (!dirtyFields.slug) setValue("slug", slugify(e.target.value));
            },
          })}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">Slug</Label>
        <Input id="slug" {...register("slug")} placeholder="premier-painting" />
        {errors.slug && (
          <p className="text-sm text-destructive">{errors.slug.message}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Industry</Label>
          <Controller
            control={control}
            name="industry"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {clientType === "program" && (
          <div className="space-y-2">
            <Label>Program</Label>
            <Controller
              control={control}
              name="program"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROGRAMS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label>Status</Label>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLIENT_STATUSES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="start_date">Start date</Label>
          <Input id="start_date" type="date" {...register("start_date")} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="website_url">Website</Label>
        <Input
          id="website_url"
          {...register("website_url")}
          placeholder="https://example.com"
        />
        {errors.website_url && (
          <p className="text-sm text-destructive">
            {errors.website_url.message}
          </p>
        )}
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-bg p-4">
        <div>
          <h3 className="text-sm font-semibold">Client account</h3>
          <p className="text-xs text-ink-3">
            Optional. Enter the client&apos;s email to create their portal login
            now — we&apos;ll email a welcome message with a secure set-password
            link. No password is generated. Leave blank to add them later.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="client_full_name">
              Contact name{" "}
              <span className="font-normal text-ink-3">· optional</span>
            </Label>
            <Input
              id="client_full_name"
              {...register("client_full_name")}
              placeholder="Casey Jones"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client_email">
              Contact email{" "}
              <span className="font-normal text-ink-3">· optional</span>
            </Label>
            <Input
              id="client_email"
              type="email"
              {...register("client_email")}
              placeholder="casey@premierpainting.com"
            />
            {errors.client_email && (
              <p className="text-sm text-destructive">
                {errors.client_email.message}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="submit" loading={submitting}>
          {submitting ? "Creating…" : "Create client"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          loading={submitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
