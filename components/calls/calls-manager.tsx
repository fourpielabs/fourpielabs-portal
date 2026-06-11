"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Eye, EyeOff, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";

import {
  callTypeSchema,
  callRecordingSchema,
  type CallTypeValues,
  type CallRecordingValues,
} from "@/lib/schemas";
import {
  createCallTypeAction,
  updateCallTypeAction,
  deleteCallTypeAction,
  createCallRecordingAction,
  updateCallRecordingAction,
  deleteCallRecordingAction,
  setCallRecordingVisibilityAction,
} from "@/lib/actions/calls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

export type CallType = {
  id: string;
  name: string;
  duration_label: string | null;
  frequency_label: string | null;
  booking_url: string | null;
};
export type CallRecording = {
  id: string;
  call_date: string | null;
  call_type: string | null;
  recording_url: string | null;
  key_topic: string | null;
  visible_to_client: boolean;
};

function useRun() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function run(p: Promise<{ ok: boolean; error?: string }>) {
    setPending(true);
    const res = await p;
    setPending(false);
    if (!res.ok) return toast.error("Action failed", { description: res.error });
    router.refresh();
  }
  return { pending, run };
}

function ConfirmDelete({ onConfirm, label }: { onConfirm: () => void; label: string }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Delete">
          <Trash2 className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {label}?</AlertDialogTitle>
          <AlertDialogDescription>This can&apos;t be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CallTypeDialog({
  clientId,
  callType,
  trigger,
}: {
  clientId: string;
  callType?: CallType;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CallTypeValues>({
    resolver: zodResolver(callTypeSchema),
    defaultValues: {
      name: callType?.name ?? "",
      duration_label: callType?.duration_label ?? "",
      frequency_label: callType?.frequency_label ?? "",
      booking_url: callType?.booking_url ?? "",
    },
  });

  async function onSubmit(values: CallTypeValues) {
    setSubmitting(true);
    const res = callType
      ? await updateCallTypeAction(clientId, callType.id, values)
      : await createCallTypeAction(clientId, values);
    setSubmitting(false);
    if (!res.ok) return toast.error("Couldn't save", { description: res.error });
    toast.success(callType ? "Updated." : "Added.");
    setOpen(false);
    if (!callType) reset();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{callType ? "Edit call type" : "Add call type"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ct-name">Name</Label>
            <Input id="ct-name" placeholder="Monthly Review Call" {...register("name")} />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ct-dur">Duration</Label>
              <Input id="ct-dur" placeholder="45 min" {...register("duration_label")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ct-freq">Frequency</Label>
              <Input id="ct-freq" placeholder="Monthly" {...register("frequency_label")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ct-url">Booking URL</Label>
            <Input id="ct-url" placeholder="https://calendly.com/…" {...register("booking_url")} />
            {errors.booking_url && (
              <p className="text-sm text-destructive">{errors.booking_url.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : callType ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RecordingDialog({
  clientId,
  recording,
  callTypeNames,
  trigger,
}: {
  clientId: string;
  recording?: CallRecording;
  callTypeNames: string[];
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
  } = useForm<CallRecordingValues>({
    resolver: zodResolver(callRecordingSchema),
    defaultValues: {
      call_date: recording?.call_date ?? "",
      call_type: recording?.call_type ?? (callTypeNames[0] ?? ""),
      recording_url: recording?.recording_url ?? "",
      key_topic: recording?.key_topic ?? "",
      visible_to_client: recording?.visible_to_client ?? true,
    },
  });

  async function onSubmit(values: CallRecordingValues) {
    setSubmitting(true);
    const res = recording
      ? await updateCallRecordingAction(clientId, recording.id, values)
      : await createCallRecordingAction(clientId, values);
    setSubmitting(false);
    if (!res.ok) return toast.error("Couldn't save", { description: res.error });
    toast.success(recording ? "Updated." : "Logged.");
    setOpen(false);
    if (!recording) reset();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{recording ? "Edit recording" : "Log a recording"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="r-date">Date</Label>
              <Input id="r-date" type="date" {...register("call_date")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-type">Call type</Label>
              <Input id="r-type" list="call-type-names" {...register("call_type")} />
              <datalist id="call-type-names">
                {callTypeNames.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="r-url">Recording URL</Label>
            <Input id="r-url" {...register("recording_url")} />
            {errors.recording_url && (
              <p className="text-sm text-destructive">{errors.recording_url.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="r-topic">Key topic</Label>
            <Input id="r-topic" {...register("key_topic")} />
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
              {submitting ? "Saving…" : recording ? "Save" : "Log"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CallsManager({
  clientId,
  callTypes,
  recordings,
}: {
  clientId: string;
  callTypes: CallType[];
  recordings: CallRecording[];
}) {
  const { pending, run } = useRun();
  const callTypeNames = callTypes.map((c) => c.name);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Bookable calls</CardTitle>
            <CardDescription>Call types with booking links.</CardDescription>
          </div>
          <CallTypeDialog
            clientId={clientId}
            trigger={
              <Button size="sm">
                <Plus className="size-4" /> Add
              </Button>
            }
          />
        </CardHeader>
        <CardContent>
          {callTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No call types yet.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {callTypes.map((c) => (
                <li key={c.id} className="flex items-center gap-2 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{c.name}</div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {c.duration_label && <span>{c.duration_label}</span>}
                      {c.frequency_label && <span>· {c.frequency_label}</span>}
                      {c.booking_url && (
                        <Button asChild variant="ghost" size="sm">
                          <a href={c.booking_url} target="_blank" rel="noreferrer">
                            <ExternalLink className="size-3" /> Book
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                  <CallTypeDialog
                    clientId={clientId}
                    callType={c}
                    trigger={
                      <Button variant="ghost" size="icon" aria-label="Edit">
                        <Pencil className="size-4" />
                      </Button>
                    }
                  />
                  <ConfirmDelete
                    label="call type"
                    onConfirm={() => run(deleteCallTypeAction(clientId, c.id))}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recordings</CardTitle>
            <CardDescription>Past sessions.</CardDescription>
          </div>
          <RecordingDialog
            clientId={clientId}
            callTypeNames={callTypeNames}
            trigger={
              <Button size="sm">
                <Plus className="size-4" /> Log
              </Button>
            }
          />
        </CardHeader>
        <CardContent>
          {recordings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recordings logged yet.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {recordings.map((r) => (
                <li key={r.id} className="flex items-center gap-2 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{r.call_type ?? "Call"}</span>
                      {r.call_date && (
                        <span className="text-xs text-muted-foreground">
                          {r.call_date}
                        </span>
                      )}
                      {!r.visible_to_client && (
                        <Badge variant="outline" className="text-[10px]">
                          hidden
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {r.key_topic && <span>{r.key_topic}</span>}
                      {r.recording_url && (
                        <Button asChild variant="ghost" size="sm">
                          <a href={r.recording_url} target="_blank" rel="noreferrer">
                            <ExternalLink className="size-3" /> Watch
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    onClick={() =>
                      run(
                        setCallRecordingVisibilityAction(
                          clientId,
                          r.id,
                          !r.visible_to_client,
                        ),
                      )
                    }
                    aria-label="Toggle visibility"
                  >
                    {r.visible_to_client ? (
                      <Eye className="size-4" />
                    ) : (
                      <EyeOff className="size-4" />
                    )}
                  </Button>
                  <RecordingDialog
                    clientId={clientId}
                    recording={r}
                    callTypeNames={callTypeNames}
                    trigger={
                      <Button variant="ghost" size="icon" aria-label="Edit">
                        <Pencil className="size-4" />
                      </Button>
                    }
                  />
                  <ConfirmDelete
                    label="recording"
                    onConfirm={() => run(deleteCallRecordingAction(clientId, r.id))}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
