"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";

import { meetingNoteSchema, type MeetingNoteValues } from "@/lib/schemas";
import {
  createMeetingNoteAction,
  updateMeetingNoteAction,
  deleteMeetingNoteAction,
  setMeetingNoteVisibilityAction,
} from "@/lib/actions/notes";
import { formatDate } from "@/lib/format";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { DatePicker } from "@/components/ui/date-picker";
import { Badge } from "@/components/ui/badge";
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

export type MeetingNote = {
  id: string;
  title: string;
  meeting_date: string | null;
  body: string | null;
  visible_to_client: boolean;
};

function NoteDialog({
  clientId,
  note,
  trigger,
}: {
  clientId: string;
  note?: MeetingNote;
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
  } = useForm<MeetingNoteValues>({
    resolver: zodResolver(meetingNoteSchema),
    defaultValues: {
      title: note?.title ?? "",
      meeting_date: note?.meeting_date ?? "",
      body: note?.body ?? "",
      visible_to_client: note?.visible_to_client ?? true,
    },
  });

  async function onSubmit(values: MeetingNoteValues) {
    setSubmitting(true);
    const res = note
      ? await updateMeetingNoteAction(clientId, note.id, values)
      : await createMeetingNoteAction(clientId, values);
    setSubmitting(false);
    if (!res.ok) return toast.error("Couldn't save", { description: res.error });
    toast.success(note ? "Note updated." : "Note added.");
    setOpen(false);
    if (!note) reset();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{note ? "Edit note" : "New meeting note"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-[1fr_auto] gap-4">
            <div className="space-y-2">
              <Label htmlFor="n-title">Title</Label>
              <Input id="n-title" placeholder="Strategy Call" {...register("title")} />
              {errors.title && (
                <p className="text-sm text-destructive">{errors.title.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Controller
                control={control}
                name="meeting_date"
                render={({ field }) => (
                  <DatePicker value={field.value} onChange={field.onChange} />
                )}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="n-body">Notes (markdown)</Label>
            <Textarea
              id="n-body"
              rows={6}
              placeholder="Decisions, actions, next steps…"
              {...register("body")}
            />
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
            <Button type="submit" loading={submitting}>
              {submitting ? "Saving…" : note ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NotesManager({
  clientId,
  notes,
}: {
  clientId: string;
  notes: MeetingNote[];
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
          {notes.length === 0
            ? "No notes yet."
            : `${notes.length} note${notes.length === 1 ? "" : "s"}`}
        </p>
        <NoteDialog
          clientId={clientId}
          trigger={
            <Button size="sm">
              <Plus className="size-4" /> New note
            </Button>
          }
        />
      </div>

      {notes.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          Capture decisions, actions, and next steps from each session.
        </div>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li
              key={n.id}
              className="rounded-2xl border border-border bg-surface p-4 shadow-e1 transition-shadow hover:shadow-e2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{n.title}</span>
                  {n.meeting_date && (
                    <span className="text-xs text-ink-3">
                      {formatDate(n.meeting_date)}
                    </span>
                  )}
                  {!n.visible_to_client && (
                    <Badge variant="outline" className="text-[10px]">
                      hidden
                    </Badge>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    onClick={() =>
                      run(
                        setMeetingNoteVisibilityAction(
                          clientId,
                          n.id,
                          !n.visible_to_client,
                        ),
                      )
                    }
                    aria-label="Toggle visibility"
                  >
                    {n.visible_to_client ? (
                      <Eye className="size-4" />
                    ) : (
                      <EyeOff className="size-4" />
                    )}
                  </Button>
                  <NoteDialog
                    clientId={clientId}
                    note={n}
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
                        <AlertDialogTitle>Delete note?</AlertDialogTitle>
                        <AlertDialogDescription>
                          &ldquo;{n.title}&rdquo; will be permanently removed.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => run(deleteMeetingNoteAction(clientId, n.id))}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              {n.body && (
                <div className="pt-2 text-sm text-ink-2">
                  <Markdown>{n.body}</Markdown>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
