"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { assignUserAction, unassignUserAction } from "@/lib/actions/users";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type TeamMember = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type Props = {
  clientId: string;
  team: TeamMember[];
  assignedIds: string[];
};

export function AssignmentManager({ clientId, team, assignedIds }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [toAdd, setToAdd] = useState<string>("");

  const assigned = team.filter((t) => assignedIds.includes(t.id));
  const available = team.filter((t) => !assignedIds.includes(t.id));

  async function add() {
    if (!toAdd) return;
    setPending(true);
    const res = await assignUserAction(clientId, toAdd);
    setPending(false);
    if (!res.ok) return toast.error("Couldn't assign", { description: res.error });
    toast.success("Assigned.");
    setToAdd("");
    router.refresh();
  }

  async function remove(userId: string) {
    setPending(true);
    const res = await unassignUserAction(clientId, userId);
    setPending(false);
    if (!res.ok) return toast.error("Couldn't unassign", { description: res.error });
    toast.success("Unassigned.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {assigned.length === 0 ? (
        <p className="text-sm text-ink-3">
          No team members assigned yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {assigned.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-surface px-4 py-3 shadow-e1 transition-shadow hover:shadow-e2"
            >
              <span className="text-sm">
                {m.full_name ?? m.email}
                {m.full_name && (
                  <span className="ml-2 text-xs text-ink-3">
                    {m.email}
                  </span>
                )}
              </span>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" disabled={pending}>
                    Remove
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Remove {m.full_name ?? m.email}?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      They&apos;ll immediately lose access to this client&apos;s
                      workspace. You can reassign them anytime.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={() => remove(m.id)}
                    >
                      Remove
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Select value={toAdd} onValueChange={setToAdd}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Add a team member…" />
            </SelectTrigger>
            <SelectContent>
              {available.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.full_name ?? m.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={add} disabled={pending || !toAdd}>
            Assign
          </Button>
        </div>
      ) : (
        <p className="text-sm text-ink-3">
          All team members are assigned.
        </p>
      )}
    </div>
  );
}
