"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Type-to-confirm destructive dialog. The action button stays DISABLED until the
 * admin types `confirmPhrase` exactly — stronger than a one-click confirm, for
 * irreversible deletes. `description` should spell out the blast radius in plain
 * words. `onConfirm` returns the action Result.
 */
export function ConfirmDeleteDialog({
  trigger,
  title,
  description,
  confirmPhrase,
  confirmLabel = "Delete",
  successMessage = "Deleted.",
  onConfirm,
}: {
  trigger: React.ReactNode;
  title: string;
  description: React.ReactNode;
  confirmPhrase: string;
  confirmLabel?: string;
  successMessage?: string;
  onConfirm: () => Promise<{ ok: boolean; error?: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const matches = value.trim() === confirmPhrase;

  async function run() {
    if (!matches || pending) return;
    setPending(true);
    const res = await onConfirm();
    setPending(false);
    if (!res.ok) return toast.error("Couldn't delete", { description: res.error });
    toast.success(successMessage);
    setOpen(false);
    setValue("");
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setValue("");
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm text-ink-2">{description}</div>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-phrase">
            Type <span className="font-semibold text-ink">{confirmPhrase}</span> to confirm
          </Label>
          <Input
            id="confirm-phrase"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder={confirmPhrase}
          />
        </div>
        <DialogFooter>
          <Button
            variant="destructive"
            disabled={!matches || pending}
            loading={pending}
            onClick={run}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
