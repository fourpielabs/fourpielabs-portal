"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Pencil, Plus } from "lucide-react";

import { metricDefinitionSchema, type MetricDefinitionValues } from "@/lib/schemas";
import {
  createMetricDefinitionAction,
  updateMetricDefinitionAction,
  setMetricDefinitionActiveAction,
  moveMetricDefinitionAction,
} from "@/lib/actions/metrics";
import { METRIC_UNITS, labelOf } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type MetricDef = {
  id: string;
  key: string;
  label: string;
  unit: "number" | "currency" | "percent" | "text";
  is_active: boolean;
  sort_order: number;
};

function slugifyKey(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function DefDialog({
  clientId,
  def,
  trigger,
}: {
  clientId: string;
  def?: MetricDef;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors, dirtyFields },
  } = useForm<MetricDefinitionValues>({
    resolver: zodResolver(metricDefinitionSchema),
    defaultValues: {
      label: def?.label ?? "",
      key: def?.key ?? "",
      unit: def?.unit ?? "number",
      is_active: def?.is_active ?? true,
    },
  });

  async function onSubmit(values: MetricDefinitionValues) {
    setSubmitting(true);
    const res = def
      ? await updateMetricDefinitionAction(clientId, def.id, values)
      : await createMetricDefinitionAction(clientId, values);
    setSubmitting(false);
    if (!res.ok) return toast.error("Couldn't save", { description: res.error });
    toast.success(def ? "Definition updated." : "Definition added.");
    setOpen(false);
    if (!def) reset();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{def ? "Edit metric" : "Add metric"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="md-label">Label</Label>
            <Input
              id="md-label"
              {...register("label", {
                onChange: (e) => {
                  if (!def && !dirtyFields.key)
                    setValue("key", slugifyKey(e.target.value));
                },
              })}
            />
            {errors.label && (
              <p className="text-sm text-destructive">{errors.label.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="md-key">Key</Label>
              <Input id="md-key" {...register("key")} placeholder="leads" />
              {errors.key && (
                <p className="text-sm text-destructive">{errors.key.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Controller
                control={control}
                name="unit"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {METRIC_UNITS.map((u) => (
                        <SelectItem key={u.value} value={u.value}>
                          {u.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Controller
              control={control}
              name="is_active"
              render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
            <Label>Active</Label>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : def ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DefinitionsManager({
  clientId,
  definitions,
}: {
  clientId: string;
  definitions: MetricDef[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function run(p: Promise<{ ok: boolean; error?: string }>) {
    setPending(true);
    const res = await p;
    setPending(false);
    if (!res.ok) return toast.error("Action failed", { description: res.error });
    router.refresh();
  }

  const ordered = [...definitions].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {ordered.length} metric{ordered.length === 1 ? "" : "s"} defined
        </p>
        <DefDialog
          clientId={clientId}
          trigger={
            <Button size="sm">
              <Plus className="size-4" /> Add metric
            </Button>
          }
        />
      </div>
      <ul className="divide-y rounded-lg border">
        {ordered.map((d) => (
          <li
            key={d.id}
            className={`flex items-center gap-2 p-3 ${d.is_active ? "" : "opacity-60"}`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{d.label}</span>
                <Badge variant="secondary" className="text-[10px]">
                  {labelOf(METRIC_UNITS, d.unit)}
                </Badge>
                {!d.is_active && (
                  <Badge variant="outline" className="text-[10px]">
                    inactive
                  </Badge>
                )}
              </div>
              <code className="text-xs text-muted-foreground">{d.key}</code>
            </div>
            <Button
              variant="ghost"
              size="icon"
              disabled={pending}
              onClick={() => run(moveMetricDefinitionAction(clientId, d.id, "up"))}
              aria-label="Move up"
            >
              <ChevronUp className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={pending}
              onClick={() => run(moveMetricDefinitionAction(clientId, d.id, "down"))}
              aria-label="Move down"
            >
              <ChevronDown className="size-4" />
            </Button>
            <DefDialog
              clientId={clientId}
              def={d}
              trigger={
                <Button variant="ghost" size="icon" aria-label="Edit">
                  <Pencil className="size-4" />
                </Button>
              }
            />
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                run(setMetricDefinitionActiveAction(clientId, d.id, !d.is_active))
              }
            >
              {d.is_active ? "Deactivate" : "Reactivate"}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
