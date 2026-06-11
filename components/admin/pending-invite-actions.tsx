"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { resendInviteAction, revokeInviteAction } from "@/lib/actions/users";
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

export function PendingInviteActions({
  userId,
  label,
}: {
  userId: string;
  label: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function resend() {
    setPending(true);
    const res = await resendInviteAction(userId);
    setPending(false);
    if (!res.ok) return toast.error("Resend failed", { description: res.error });
    toast.success("Invitation re-sent.");
    router.refresh();
  }

  async function revoke() {
    setPending(true);
    const res = await revokeInviteAction(userId);
    setPending(false);
    if (!res.ok) return toast.error("Revoke failed", { description: res.error });
    toast.success("Invite revoked.");
    router.refresh();
  }

  return (
    <div className="flex justify-end gap-1">
      <Button variant="outline" size="sm" disabled={pending} onClick={resend}>
        Resend
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="sm" disabled={pending}>
            Revoke
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this invite?</AlertDialogTitle>
            <AlertDialogDescription>
              {label} hasn&apos;t accepted yet. Revoking deletes the pending
              account; you can invite them again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={revoke}>Revoke</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
