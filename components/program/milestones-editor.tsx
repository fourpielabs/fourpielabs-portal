"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react";

import { milestoneSchema, type MilestoneValues } from "@/lib/schemas";
import { formatDate } from "@/lib/format";
import {
  createMilestoneAction,
  updateMilestoneAction,
  deleteMilestoneAction,
  moveMilestoneAction,
  setMilestoneStatusAction,
} from "@/lib/actions/milestones";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export type Milestone = {
  id: string;
  title: string;
  description: string | null;
  phase_label: string | null;
  status: "upcoming" | "in_progress" | "done";
  due_date: string | null;
  visible_to_client: boolean;
  sort_order: number;
};

const STATUSES = [
  { value: "upcoming", label: "Upcoming" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
] as const;

function MilestoneDialog({
  clientId,
  milestone,
  trigger,
}: {
  clientId: string;
  milestone?: Milestone;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<MilestoneValues>({
    resolver: zodResolver(milestoneSchema),
    defaultValues: {
      title: milestone?.title ?? "",
      description: milestone?.description ?? "",
      phase_label: milestone?.phase_label ?? "",
      status: milestone?.status ?? "upcoming",
      due_date: milestone?.due_date ?? "",
      visible_to_client: milestone?.visible_to_client ?? true,
    },
  });

  async function onSubmit(values: MilestoneValues) {
    setSubmitting(true);
    const res = milestone
      ? await updateMilestoneAction(clientId, milestone.id, values)
      : await createMilestoneAction(clientId, values);
    setSubmitting(false);
    if (!res.ok) return toast.error("Couldn't save", { description: res.error });
    toast.success(milestone ? "Milestone updated." : "Milestone added.");
    setOpen(false);
    if (!milestone) reset();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{milestone ? "Edit milestone" : "Add milestone"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="m-title">Title</Label>
            <Input id="m-title" {...register("title")} />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-desc">Description</Label>
            <Textarea id="m-desc" rows={3} {...register("description")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="m-phase">Phase label</Label>
              <Input id="m-phase" placeholder="Weeks 1–2" {...register("phase_label")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-due">Due date</Label>
              <Input id="m-due" type="date" {...register("due_date")} />
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
                      {STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>Visible to client</Label>
              <Controller
                control={control}
                name="visible_to_client"
                render={({ field }) => (
                  <div className="flex h-9 items-center">
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </div>
                )}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" loading={submitting}>
              {submitting ? "Saving…" : milestone ? "Save" : "Add milestone"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MilestonesEditor({
  clientId,
  milestones,
}: {
  clientId: string;
  milestones: Milestone[];
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

  const ordered = [...milestones].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {ordered.length === 0 ? "No milestones yet." : `${ordered.length} phases`}
        </p>
        <MilestoneDialog
          clientId={clientId}
          trigger={
            <Button size="sm">
              <Plus className="size-4" /> Add milestone
            </Button>
          }
        />
      </div>

      <ul className="space-y-2">
        {ordered.map((m) => (
          <li
            key={m.id}
            className="flex flex-wrap items-start gap-3 rounded-2xl border border-border bg-surface p-4 shadow-e1 transition-shadow hover:shadow-e2 sm:flex-nowrap"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{m.title}</span>
                {m.phase_label && (
                  <span className="text-xs text-muted-foreground">
                    {m.phase_label}
                  </span>
                )}
                {!m.visible_to_client && (
                  <Badge variant="outline" className="text-[10px]">
                    hidden
                  </Badge>
                )}
                {m.due_date && (
                  <span className="text-xs text-muted-foreground">
                    due {formatDate(m.due_date)}
                  </span>
                )}
              </div>
              {m.description && (
                <p className="pt-1 text-sm text-muted-foreground">
                  {m.description}
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <Select
                value={m.status}
                onValueChange={(s) =>
                  run(
                    setMilestoneStatusAction(
                      clientId,
                      m.id,
                      s as Milestone["status"],
                    ),
                  )
                }
              >
                <SelectTrigger size="sm" className="w-[8.5rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                disabled={pending}
                onClick={() => run(moveMilestoneAction(clientId, m.id, "up"))}
                aria-label="Move up"
              >
                <ChevronUp className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={pending}
                onClick={() => run(moveMilestoneAction(clientId, m.id, "down"))}
                aria-label="Move down"
              >
                <ChevronDown className="size-4" />
              </Button>
              <MilestoneDialog
                clientId={clientId}
                milestone={m}
                trigger={
                  <Button variant="ghost" size="icon" aria-label="Edit">
                    <Pencil className="size-4" />
                  </Button>
                }
              />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Delete">
                    <Trash2 className="size-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete milestone?</AlertDialogTitle>
                    <AlertDialogDescription>
                      &ldquo;{m.title}&rdquo; will be permanently removed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => run(deleteMilestoneAction(clientId, m.id))}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
