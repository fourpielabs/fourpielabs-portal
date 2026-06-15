"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check } from "lucide-react";

import { setDeliverableApprovalAction } from "@/lib/actions/deliverables";
import { Button } from "@/components/ui/button";

/** Client's approve/acknowledge control for a deliverable (the only client write
 *  besides the checklist toggle). Drives set_deliverable_approval via the action. */
export function DeliverableApprove({ id, approved }: { id: string; approved: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [isApproved, setIsApproved] = useState(approved);

  async function toggle() {
    setBusy(true);
    const next = !isApproved;
    const res = await setDeliverableApprovalAction(id, next);
    setBusy(false);
    if (!res.ok) return toast.error("Couldn't update", { description: res.error });
    setIsApproved(next);
    toast.success(next ? "Marked as approved." : "Approval removed.");
    router.refresh();
  }

  return isApproved ? (
    <Button variant="outline" size="sm" loading={busy} onClick={toggle}>
      <Check className="size-4 text-success-dot" /> Approved
    </Button>
  ) : (
    <Button variant="amber" size="sm" loading={busy} onClick={toggle}>
      Approve
    </Button>
  );
}
