"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { resendInviteAction, revokeInviteAction } from "@/lib/actions/users";
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
import { usePanel } from "./ui";

/**
 * R3 pending-invite controls (re-skinned). Resend / Revoke wiring
 * (resendInviteAction / revokeInviteAction) preserved verbatim; only the buttons +
 * the revoke confirm surface adopt the ember-glass kit.
 */
export function PendingInviteActions({
  userId,
  label,
}: {
  userId: string;
  label: string;
}) {
  const router = useRouter();
  const { fg3 } = usePanel();
  const [pending, setPending] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);

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
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
      <Button appearance="outline" size="small" disabled={pending} onClick={resend}>
        Resend
      </Button>
      <Dialog open={revokeOpen} onOpenChange={(_, d) => setRevokeOpen(d.open)}>
        <DialogTrigger disableButtonEnhancement>
          <Button appearance="outline" size="small" disabled={pending} style={{ color: "#dc2626", borderColor: "#f3b4b4" }}>
            Revoke
          </Button>
        </DialogTrigger>
        <DialogSurface style={{ maxWidth: 460 }}>
          <DialogBody>
            <DialogTitle>Revoke this invite?</DialogTitle>
            <p style={{ margin: "8px 0 0", fontSize: 14, color: fg3 }}>
              {label} hasn&apos;t accepted yet. Revoking deletes the pending account; you
              can invite them again later.
            </p>
            <DialogActions>
              <Button appearance="subtle" onClick={() => setRevokeOpen(false)}>
                Cancel
              </Button>
              <EmberButton
                onClick={() => {
                  setRevokeOpen(false);
                  revoke();
                }}
                style={{ background: "linear-gradient(180deg,#dc2626,#b91c1c)" }}
              >
                Revoke
              </EmberButton>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
