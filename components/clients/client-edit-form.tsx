"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { clientUpdateSchema, type ClientUpdateValues } from "@/lib/schemas";
import { updateClientAction } from "@/lib/actions/clients";
import { INDUSTRIES, PROGRAMS, CLIENT_STATUSES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";

type Props = { defaults: ClientUpdateValues };

export function ClientEditForm({ defaults }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ClientUpdateValues>({
    resolver: zodResolver(clientUpdateSchema),
    defaultValues: defaults,
  });

  async function onSubmit(values: ClientUpdateValues) {
    setSubmitting(true);
    const res = await updateClientAction(values);
    setSubmitting(false);
    if (!res.ok) {
      toast.error("Couldn't save", { description: res.error });
      return;
    }
    toast.success("Client saved.");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <input type="hidden" {...register("id")} />

      <div className="space-y-2">
        <Label htmlFor="name">Business name</Label>
        <Input id="name" {...register("name")} />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
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
          <Label>Start date</Label>
          <Controller
            control={control}
            name="start_date"
            render={({ field }) => (
              <DatePicker value={field.value} onChange={field.onChange} />
            )}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="website_url">Website</Label>
          <Input id="website_url" {...register("website_url")} />
          {errors.website_url && (
            <p className="text-sm text-destructive">
              {errors.website_url.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="service_type">Service type</Label>
          <Input
            id="service_type"
            {...register("service_type")}
            placeholder="Done For You"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="investment">Investment</Label>
          <Input
            id="investment"
            {...register("investment")}
            placeholder="$3,500/mo"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="comms_channel">Comms channel</Label>
          <Input
            id="comms_channel"
            {...register("comms_channel")}
            placeholder="WhatsApp group"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="internal_notes">
          Internal notes{" "}
          <span className="text-muted-foreground">
            (never visible to the client)
          </span>
        </Label>
        <Textarea id="internal_notes" rows={3} {...register("internal_notes")} />
      </div>

      <Button type="submit" loading={submitting}>
        {submitting ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
