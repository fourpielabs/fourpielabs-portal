"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { programSchema, type ProgramValues } from "@/lib/schemas";
import { updateProgramAction } from "@/lib/actions/program";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ProgramForm({ defaults }: { defaults: ProgramValues }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit } = useForm<ProgramValues>({
    resolver: zodResolver(programSchema),
    defaultValues: defaults,
  });

  async function onSubmit(values: ProgramValues) {
    setSubmitting(true);
    const res = await updateProgramAction(values);
    setSubmitting(false);
    if (!res.ok) return toast.error("Couldn't save", { description: res.error });
    toast.success("Program details saved.");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <input type="hidden" {...register("id")} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="service_type">Service type</Label>
          <Input id="service_type" {...register("service_type")} placeholder="Done For You" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="investment">Investment</Label>
          <Input id="investment" {...register("investment")} placeholder="$3,500/mo" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="start_date">Start date</Label>
          <Input id="start_date" type="date" {...register("start_date")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end_date">End date</Label>
          <Input id="end_date" type="date" {...register("end_date")} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="whats_included">What&apos;s included (markdown)</Label>
          <Textarea id="whats_included" rows={4} {...register("whats_included")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="whats_not_included">
            What&apos;s not included (markdown)
          </Label>
          <Textarea
            id="whats_not_included"
            rows={4}
            {...register("whats_not_included")}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="comms_channel">Comms channel</Label>
          <Input id="comms_channel" {...register("comms_channel")} placeholder="WhatsApp group" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="best_way_to_reach">Best way to reach</Label>
          <Input id="best_way_to_reach" {...register("best_way_to_reach")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="response_time">Response time</Label>
          <Input
            id="response_time"
            {...register("response_time")}
            placeholder="Within 24 hours, weekdays"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="revision_policy">Revision policy</Label>
          <Input
            id="revision_policy"
            {...register("revision_policy")}
            placeholder="2 rounds per deliverable"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="call_scheduling_note">Call scheduling note</Label>
          <Input id="call_scheduling_note" {...register("call_scheduling_note")} />
        </div>
      </div>

      <Button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : "Save program details"}
      </Button>
    </form>
  );
}
