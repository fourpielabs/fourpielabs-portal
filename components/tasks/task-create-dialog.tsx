"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lock } from "lucide-react";

import { createTaskAction } from "@/lib/actions/tasks-client";
import { staffCreateTaskAction } from "@/lib/actions/tasks";
import type { TaskMember } from "@/lib/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
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
 * Create-task dialog — the single create-task entry point, opened from the chat
 * composer toolbar. A client creates on their own client (create_task RPC); staff via
 * staffCreateTaskAction. SOURCE-LESS (no source_message_id) — a general task, not message-
 * linked. On the INTERNAL thread the task is forced staff-only (`audience` → default
 * visible=false; the action re-checks server-side, so it can't be spoofed) — the internal-
 * thread boundary extends to tasks. Controlled `open` so the toolbar owns the trigger.
 */
export function TaskCreateDialog({
  open,
  onOpenChange,
  role,
  clientId,
  members,
  audience,
  initialTitle,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  role: "client" | "staff";
  clientId: string;
  members: TaskMember[];
  audience: "shared" | "internal";
  initialTitle: string;
}) {
  const router = useRouter();
  const isInternal = audience === "internal";
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState(NONE);
  const [due, setDue] = useState("");
  const [visible, setVisible] = useState(!isInternal);

  // Seed the form when it opens — the composer is modal-blocked while open, so
  // initialTitle (the current draft) is frozen at open time. Derived on the open
  // transition ("adjust state when a prop changes") instead of an effect.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setTitle(initialTitle);
      setDescription("");
      setAssignee(NONE);
      setDue("");
      setVisible(!isInternal);
    }
  }

  async function submit() {
    if (!title.trim()) return toast.error("Add a title for the task.");
    setSubmitting(true);
    const assignee_id = assignee === NONE ? "" : assignee;
    const res =
      role === "client"
        ? await createTaskAction({ title, description, assignee_id, due_date: due })
        : await staffCreateTaskAction(clientId, {
            title,
            description,
            status: "todo",
            assignee_id,
            due_date: due,
            visible_to_client: visible,
          });
    setSubmitting(false);
    if (!res.ok) return toast.error("Couldn't create task", { description: res.error });
    toast.success("Task created.");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create task</DialogTitle>
          <DialogDescription>
            {isInternal
              ? "This task will be internal — staff-only. The client never sees it."
              : "Add a task for this client."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tc-title">Title</Label>
            <Input id="tc-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tc-desc">Description</Label>
            <Textarea
              id="tc-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional — add any detail or context."
              className="resize-none"
            />
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
              <Label>Due date</Label>
              <DatePicker value={due} onChange={setDue} />
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
  );
}
