"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { setUserActiveAction } from "@/lib/actions/users";
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

type Props = {
  userId: string;
  isActive: boolean;
  isSelf: boolean;
  label: string;
};

export function UserActiveToggle({ userId, isActive, isSelf, label }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function apply(next: boolean) {
    setPending(true);
    const res = await setUserActiveAction(userId, next);
    setPending(false);
    if (!res.ok) return toast.error("Couldn't update", { description: res.error });
    toast.success(next ? "User reactivated." : "User deactivated.");
    router.refresh();
  }

  if (isSelf) {
    return <span className="text-xs text-muted-foreground">You</span>;
  }

  if (isActive) {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="sm" disabled={pending}>
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
            <AlertDialogAction onClick={() => apply(false)}>
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => apply(true)}
    >
      Reactivate
    </Button>
  );
}
