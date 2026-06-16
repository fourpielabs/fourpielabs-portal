"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { setUserActiveAction, deleteUserAction } from "@/lib/actions/users";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
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

type Props = {
  userId: string;
  isActive: boolean;
  isSelf: boolean;
  label: string;
};

export function UserActiveToggle({ userId, isActive, isSelf, label }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  // optimistic: the button flips Deactivate↔Reactivate instantly; router.refresh
  // then reconciles the row styling. Revert on error.
  const [active, setActive] = useState(isActive);
  useEffect(() => setActive(isActive), [isActive]);

  async function apply(next: boolean) {
    setPending(true);
    setActive(next);
    const res = await setUserActiveAction(userId, next);
    setPending(false);
    if (!res.ok) {
      setActive(!next);
      return toast.error("Couldn't update", { description: res.error });
    }
    toast.success(next ? "User reactivated." : "User deactivated.");
    router.refresh();
  }

  // self: no controls (can't deactivate or delete yourself — the action re-checks too)
  if (isSelf) {
    return <span className="text-xs text-muted-foreground">You</span>;
  }

  const deleteBtn = (
    <ConfirmDeleteDialog
      trigger={
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          className="border-danger-border text-danger-text hover:border-danger-border hover:bg-danger-bg"
        >
          Delete
        </Button>
      }
      title={`Delete ${label}?`}
      confirmPhrase={label}
      confirmLabel="Delete permanently"
      successMessage="User deleted."
      onConfirm={() => deleteUserAction(userId)}
      description={
        <>
          <p>
            This <span className="font-semibold text-ink">permanently deletes</span> their
            account. It can&apos;t be undone — use Deactivate if you just want to block access.
          </p>
          <p>
            Their notifications, preferences, and client assignments are erased. Anything they
            created (deliverables, messages, reports, files…) is kept but shown as
            &ldquo;Removed user&rdquo;. The audit log is preserved.
          </p>
        </>
      }
    />
  );

  return (
    <div className="flex items-center justify-end gap-1">
      {active ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={pending}>
              Deactivate
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Deactivate {label}?</AlertDialogTitle>
              <AlertDialogDescription>
                They&apos;ll be signed out and blocked at the login gate on their
                next request. You can reactivate them anytime.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={() => apply(false)}>
                Deactivate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <Button variant="outline" size="sm" disabled={pending} onClick={() => apply(true)}>
          Reactivate
        </Button>
      )}
      {deleteBtn}
    </div>
  );
}
