"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ListPlus, Lock } from "lucide-react";

import { createTaskAction } from "@/lib/actions/tasks-client";
import { staffCreateTaskAction } from "@/lib/actions/tasks";
import type { TaskMember } from "@/lib/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const NONE = "__none__";
const roleLabel = (r: TaskMember["role"]) => (r === "client" ? "Client" : r === "admin" ? "Admin" : "Team");

/**
 * "Create task from this message" — the chat→tasks bridge (5c). A client creates
 * on their shared thread (create_task RPC, source_message_id = this message); staff
 * on either thread. On the INTERNAL thread the task is forced staff-only (the action
 * re-checks the message's real thread_type, so this can't be spoofed) — the
 * internal-thread boundary extends to tasks.
 */
export function MessageTaskButton({
  messageId,
  messageBody,
  role,
  clientId,
  members,
  audience,
}: {
  messageId: string;
  messageBody: string;
  role: "client" | "staff";
  clientId: string;
  members: TaskMember[];
  audience: "shared" | "internal";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isInternal = audience === "internal";
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState(NONE);
  const [due, setDue] = useState("");
  const [visible, setVisible] = useState(!isInternal);

  function openDialog() {
    setTitle(messageBody.trim().replace(/\s+/g, " ").slice(0, 120));
    setAssignee(NONE);
    setDue("");
    setVisible(!isInternal);
    setOpen(true);
  }

  async function submit() {
    if (!title.trim()) return toast.error("Add a title for the task.");
    setSubmitting(true);
    const assignee_id = assignee === NONE ? "" : assignee;
    const res =
      role === "client"
        ? await createTaskAction({ title, description: "", assignee_id, due_date: due, source_message_id: messageId })
        : await staffCreateTaskAction(clientId, {
            title,
            description: "",
            status: "todo",
            assignee_id,
            due_date: due,
            visible_to_client: visible,
            source_message_id: messageId,
          });
    setSubmitting(false);
    if (!res.ok) return toast.error("Couldn't create task", { description: res.error });
    toast.success("Task created from this message.");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        aria-label="Create task from message"
        title="Create task from this message"
        className="motion-micro inline-flex size-5 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink"
      >
        <ListPlus className="size-3.5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create task from this message</DialogTitle>
            <DialogDescription>
              {isInternal
                ? "This task will be internal — staff-only. The client never sees it."
                : "Links the new task back to this message."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mt-title">Title</Label>
              <Input id="mt-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Assignee</Label>
                <Select value={assignee} onValueChange={setAssignee}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Unassigned</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} · {roleLabel(m.role)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mt-due">Due date</Label>
                <Input id="mt-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
              </div>
            </div>
            {role === "staff" && isInternal && (
              <p className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[12px] font-semibold text-amber-800">
                <Lock className="size-3.5" /> Internal — staff-only task
              </p>
            )}
            {role === "staff" && !isInternal && (
              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border px-3 py-2.5">
                <span className="text-sm font-medium">Visible to the client</span>
                <Switch checked={visible} onCheckedChange={setVisible} aria-label="Visible to the client" />
              </label>
            )}
          </div>
          <DialogFooter>
            <Button onClick={submit} loading={submitting}>
              {submitting ? "Creating…" : "Create task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
