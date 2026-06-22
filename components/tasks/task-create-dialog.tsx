"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lock } from "lucide-react";

import { createTaskAction } from "@/lib/actions/tasks-client";
import { staffCreateTaskAction } from "@/lib/actions/tasks";
import type { TaskMember } from "@/lib/tasks";
import { BaseModal, Input, Textarea, Select, Switch, EmberButton, DateField, tokens } from "@/components/redesign/ui";
import { FieldGrid, Field } from "@/components/redesign/staff/ui";
import { useRedesignMode } from "@/components/redesign/themed-fluent";

const NONE = "__none__";
const roleLabel = (r: TaskMember["role"]) => (r === "client" ? "Client" : r === "admin" ? "Admin" : "Team");

/**
 * Create-task dialog (Warm Obsidian / Fluent) — the single create-task entry point from
 * the chat composer. A client creates on their own client (create_task RPC); staff via
 * staffCreateTaskAction. INVARIANT preserved: on the INTERNAL thread the task is forced
 * staff-only (visible defaults to false; the staff action re-checks the message's real
 * thread_type server-side, so it can't be spoofed) — the internal-thread boundary extends
 * to tasks. Controlled `open` (the composer owns the trigger). Logic/RPC unchanged.
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
  const { mode } = useRedesignMode();
  const onDark = mode === "dark";
  const isInternal = audience === "internal";
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState(NONE);
  const [due, setDue] = useState("");
  const [visible, setVisible] = useState(!isInternal);

  // Seed the form when it opens — initialTitle (the current draft) is frozen at open time.
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

  const fg1 = tokens.colorNeutralForeground1, fg3 = tokens.colorNeutralForeground3;
  const border = onDark ? "#34302a" : "#e7e5e0";
  return (
    <BaseModal
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title="Create task"
      size="md"
      footer={<EmberButton onClick={submit} loading={submitting}>Create task</EmberButton>}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ margin: 0, fontSize: 13, color: fg3 }}>
          {isInternal
            ? "This task will be internal — staff-only. The client never sees it."
            : "Add a task for this client."}
        </p>
        <Field label="Title">
          <Input value={title} onChange={(_, d) => setTitle(d.value)} autoFocus />
        </Field>
        <Field label="Description">
          <Textarea value={description} onChange={(_, d) => setDescription(d.value)} rows={3} resize="vertical" placeholder="Optional — add any detail or context." />
        </Field>
        <FieldGrid>
          <Field label="Assignee">
            <Select value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Assignee">
              <option value={NONE}>Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name} · {roleLabel(m.role)}</option>
              ))}
            </Select>
          </Field>
          <Field label="Due date">
            <DateField value={due} onChange={setDue} />
          </Field>
        </FieldGrid>
        {role === "staff" && isInternal && (
          <p style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start", borderRadius: 10, border: `1px solid ${onDark ? "rgba(245,158,11,0.4)" : "#fcd34d"}`, background: onDark ? "rgba(245,158,11,0.12)" : "#fffbeb", padding: "6px 10px", fontSize: 12, fontWeight: 700, color: onDark ? "#fcd34d" : "#92400e" }}>
            <Lock size={14} /> Internal — staff-only task
          </p>
        )}
        {role === "staff" && !isInternal && (
          <label style={{ display: "flex", cursor: "pointer", alignItems: "center", justifyContent: "space-between", gap: 16, borderRadius: 12, border: `1px solid ${border}`, padding: "0.6rem 0.85rem" }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: fg1 }}>Visible to the client</span>
            <Switch checked={visible} onChange={(_, d) => setVisible(d.checked)} aria-label="Visible to the client" />
          </label>
        )}
      </div>
    </BaseModal>
  );
}
