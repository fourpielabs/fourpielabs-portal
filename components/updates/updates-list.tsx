"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, Megaphone, Pencil, Pin, PinOff, Plus, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

import { setUpdateFlagsAction, deleteUpdateAction } from "@/lib/actions/updates";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { UpdateDialog, type UpdateRow } from "./update-dialog";

export type UpdateItem = UpdateRow & {
  author_id: string | null;
  author_name: string;
  created_at: string;
};

export function UpdatesList({
  clientId,
  updates,
  currentUserId,
  isAdmin,
}: {
  clientId: string;
  updates: UpdateItem[];
  currentUserId: string;
  isAdmin: boolean;
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

  const ordered = [...updates].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return a.created_at < b.created_at ? 1 : -1;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {updates.length === 0 ? "" : `${updates.length} posted`}
        </p>
        <UpdateDialog
          clientId={clientId}
          trigger={
            <Button size="sm">
              <Plus className="size-4" /> Post update
            </Button>
          }
        />
      </div>

      {ordered.length === 0 ? (
        <EmptyState
          icon={<Megaphone />}
          title="No updates yet"
          description="Share progress notes with the client here."
        />
      ) : (
        <ul className="space-y-3">
          {ordered.map((u) => {
            const canEdit = isAdmin || u.author_id === currentUserId;
            return (
              <li
                key={u.id}
                className="rounded-2xl border border-border bg-surface p-4 shadow-e1 transition-shadow hover:shadow-e2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{u.title}</span>
                    {u.pinned && (
                      <Badge variant="secondary" className="text-[10px]">
                        pinned
                      </Badge>
                    )}
                    {!u.visible_to_client && (
                      <Badge variant="outline" className="text-[10px]">
                        hidden
                      </Badge>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={pending || !canEdit}
                      onClick={() =>
                        run(setUpdateFlagsAction(clientId, u.id, { pinned: !u.pinned }))
                      }
                      aria-label="Toggle pin"
                    >
                      {u.pinned ? (
                        <PinOff className="size-4" />
                      ) : (
                        <Pin className="size-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={pending || !canEdit}
                      onClick={() =>
                        run(
                          setUpdateFlagsAction(clientId, u.id, {
                            visible_to_client: !u.visible_to_client,
                          }),
                        )
                      }
                      aria-label="Toggle visibility"
                    >
                      {u.visible_to_client ? (
                        <Eye className="size-4" />
                      ) : (
                        <EyeOff className="size-4" />
                      )}
                    </Button>
                    {canEdit && (
                      <UpdateDialog
                        clientId={clientId}
                        update={u}
                        trigger={
                          <Button variant="ghost" size="icon" aria-label="Edit">
                            <Pencil className="size-4" />
                          </Button>
                        }
                      />
                    )}
                    {canEdit && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Delete">
                            <Trash2 className="size-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete update?</AlertDialogTitle>
                            <AlertDialogDescription>
                              &ldquo;{u.title}&rdquo; will be permanently removed.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => run(deleteUpdateAction(clientId, u.id))}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
                {u.body && (
                  <p className="whitespace-pre-wrap pt-2 text-sm text-muted-foreground">
                    {u.body}
                  </p>
                )}
                <p className="pt-2 text-xs text-muted-foreground">
                  {u.author_name} · {formatDate(u.created_at)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
