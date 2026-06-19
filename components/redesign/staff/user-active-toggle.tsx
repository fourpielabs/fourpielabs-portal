"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { setUserActiveAction, deleteUserAction } from "@/lib/actions/users";
import {
  Button,
  EmberButton,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogActions,
} from "@/components/redesign/ui";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { usePanel } from "./ui";

type Props = {
  userId: string;
  isActive: boolean;
  isSelf: boolean;
  label: string;
};

/**
 * R3 staff active/delete control (re-skinned). The GUARDED hard-delete still goes
 * through the shared ConfirmDeleteDialog (type-phrase guard) → deleteUserAction, and
 * the isSelf gating + setUserActiveAction wiring are byte-identical to the original —
 * only the buttons/confirm surface adopt the ember-glass kit. The last-admin/self
 * blocks live server-side in the actions; nothing here weakens them.
 */
export function UserActiveToggle({ userId, isActive, isSelf, label }: Props) {
  const router = useRouter();
  const { fg3, onDark } = usePanel();
  const [pending, setPending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // optimistic: the button flips Deactivate↔Reactivate instantly; router.refresh
  // then reconciles the row styling. Revert on error.
  const [active, setActive] = useState(isActive);
  // Re-sync with the server prop after refresh — "adjust state during render".
  const [prevActive, setPrevActive] = useState(isActive);
  if (isActive !== prevActive) {
    setPrevActive(isActive);
    setActive(isActive);
  }

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
    return <span style={{ fontSize: 12, color: fg3 }}>You</span>;
  }

  const deleteBtn = (
    <ConfirmDeleteDialog
      trigger={
        <Button appearance="outline" size="small" disabled={pending} style={{ color: onDark ? "#fca5a5" : "#dc2626", borderColor: onDark ? "rgba(239,68,68,0.4)" : "#f3b4b4" }}>
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
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
      {active ? (
        <Dialog open={confirmOpen} onOpenChange={(_, d) => setConfirmOpen(d.open)}>
          <DialogTrigger disableButtonEnhancement>
            <Button appearance="outline" size="small" disabled={pending}>
              Deactivate
            </Button>
          </DialogTrigger>
          <DialogSurface style={{ maxWidth: 460 }}>
            <DialogBody>
              <DialogTitle>Deactivate {label}?</DialogTitle>
              <p style={{ margin: "8px 0 0", fontSize: 14, color: fg3 }}>
                They&apos;ll be signed out and blocked at the login gate on their next
                request. You can reactivate them anytime.
              </p>
              <DialogActions>
                <Button appearance="subtle" onClick={() => setConfirmOpen(false)}>
                  Cancel
                </Button>
                <EmberButton
                  onClick={() => {
                    setConfirmOpen(false);
                    apply(false);
                  }}
                  style={{ background: "linear-gradient(180deg,#dc2626,#b91c1c)" }}
                >
                  Deactivate
                </EmberButton>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>
      ) : (
        <Button appearance="outline" size="small" disabled={pending} onClick={() => apply(true)}>
          Reactivate
        </Button>
      )}
      {deleteBtn}
    </div>
  );
}
