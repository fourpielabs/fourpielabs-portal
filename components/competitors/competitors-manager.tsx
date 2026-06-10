"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";

import { competitorSchema, type CompetitorValues } from "@/lib/schemas";
import {
  createCompetitorAction,
  updateCompetitorAction,
  setCompetitorVisibilityAction,
  deleteCompetitorAction,
} from "@/lib/actions/competitors";
import { COMPETITOR_PRIORITIES, labelOf } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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

export type Competitor = {
  id: string;
  name_or_handle: string;
  niche: string | null;
  follower_count: number | null;
  avg_views: number | null;
  top_content_format: string | null;
  hook_style: string | null;
  whats_working: string | null;
  gap_notes: string | null;
  adapted_idea: string | null;
  priority: "low" | "medium" | "high";
  visible_to_client: boolean;
};

function priorityVariant(p: string): "default" | "secondary" | "outline" {
  if (p === "high") return "default";
  if (p === "low") return "outline";
  return "secondary";
}

function CompetitorDialog({
  clientId,
  competitor,
  trigger,
}: {
  clientId: string;
  competitor?: Competitor;
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
  } = useForm<CompetitorValues>({
    resolver: zodResolver(competitorSchema),
    defaultValues: {
      name_or_handle: competitor?.name_or_handle ?? "",
      niche: competitor?.niche ?? "",
      follower_count:
        competitor?.follower_count != null ? String(competitor.follower_count) : "",
      avg_views: competitor?.avg_views != null ? String(competitor.avg_views) : "",
      top_content_format: competitor?.top_content_format ?? "",
      hook_style: competitor?.hook_style ?? "",
      whats_working: competitor?.whats_working ?? "",
      gap_notes: competitor?.gap_notes ?? "",
      adapted_idea: competitor?.adapted_idea ?? "",
      priority: competitor?.priority ?? "medium",
      visible_to_client: competitor?.visible_to_client ?? true,
    },
  });

  async function onSubmit(values: CompetitorValues) {
    setSubmitting(true);
    const res = competitor
      ? await updateCompetitorAction(clientId, competitor.id, values)
      : await createCompetitorAction(clientId, values);
    setSubmitting(false);
    if (!res.ok) return toast.error("Couldn't save", { description: res.error });
    toast.success(competitor ? "Competitor updated." : "Competitor added.");
    setOpen(false);
    if (!competitor) reset();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{competitor ? "Edit competitor" : "Add competitor"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="c-name">Name / handle</Label>
              <Input id="c-name" {...register("name_or_handle")} />
              {errors.name_or_handle && (
                <p className="text-sm text-destructive">
                  {errors.name_or_handle.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Controller
                control={control}
                name="priority"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COMPETITOR_PRIORITIES.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-niche">Niche</Label>
              <Input id="c-niche" {...register("niche")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-format">Top content format</Label>
              <Input id="c-format" {...register("top_content_format")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-followers">Follower count</Label>
              <Input id="c-followers" type="number" {...register("follower_count")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-views">Avg views</Label>
              <Input id="c-views" type="number" {...register("avg_views")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-hook">Hook style</Label>
            <Input id="c-hook" {...register("hook_style")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-working">What&apos;s working</Label>
            <Textarea id="c-working" rows={2} {...register("whats_working")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-gap">Gap notes (what they&apos;re NOT doing)</Label>
            <Textarea id="c-gap" rows={2} {...register("gap_notes")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-idea">Adapted idea</Label>
            <Textarea id="c-idea" rows={2} {...register("adapted_idea")} />
          </div>
          <div className="flex items-center gap-2">
            <Controller
              control={control}
              name="visible_to_client"
              render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
            <Label>Visible to client</Label>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : competitor ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CompetitorsManager({
  clientId,
  competitors,
}: {
  clientId: string;
  competitors: Competitor[];
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {competitors.length === 0
            ? "No competitors tracked yet."
            : `${competitors.length} tracked`}
        </p>
        <CompetitorDialog
          clientId={clientId}
          trigger={
            <Button size="sm">
              <Plus className="size-4" /> Add competitor
            </Button>
          }
        />
      </div>

      {competitors.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          Track competitors — what&apos;s working, the gaps, and ideas to adapt.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {competitors.map((c) => (
            <div key={c.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c.name_or_handle}</span>
                    <Badge variant={priorityVariant(c.priority)} className="text-[10px]">
                      {labelOf(COMPETITOR_PRIORITIES, c.priority)}
                    </Badge>
                    {!c.visible_to_client && (
                      <Badge variant="outline" className="text-[10px]">
                        hidden
                      </Badge>
                    )}
                  </div>
                  {c.niche && (
                    <div className="text-xs text-muted-foreground">{c.niche}</div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    onClick={() =>
                      run(
                        setCompetitorVisibilityAction(
                          clientId,
                          c.id,
                          !c.visible_to_client,
                        ),
                      )
                    }
                    aria-label="Toggle visibility"
                  >
                    {c.visible_to_client ? (
                      <Eye className="size-4" />
                    ) : (
                      <EyeOff className="size-4" />
                    )}
                  </Button>
                  <CompetitorDialog
                    clientId={clientId}
                    competitor={c}
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
                        <AlertDialogTitle>Delete competitor?</AlertDialogTitle>
                        <AlertDialogDescription>
                          &ldquo;{c.name_or_handle}&rdquo; will be removed.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => run(deleteCompetitorAction(clientId, c.id))}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                {c.follower_count != null && (
                  <div>
                    <dt className="text-muted-foreground">Followers</dt>
                    <dd>{c.follower_count.toLocaleString()}</dd>
                  </div>
                )}
                {c.avg_views != null && (
                  <div>
                    <dt className="text-muted-foreground">Avg views</dt>
                    <dd>{c.avg_views.toLocaleString()}</dd>
                  </div>
                )}
              </dl>
              {c.whats_working && (
                <p className="mt-2 text-sm">
                  <span className="text-muted-foreground">Working: </span>
                  {c.whats_working}
                </p>
              )}
              {c.gap_notes && (
                <p className="mt-1 text-sm">
                  <span className="text-muted-foreground">Gap: </span>
                  {c.gap_notes}
                </p>
              )}
              {c.adapted_idea && (
                <p className="mt-1 text-sm">
                  <span className="text-muted-foreground">Idea: </span>
                  {c.adapted_idea}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
