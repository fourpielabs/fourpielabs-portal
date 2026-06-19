"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { m } from "motion/react";
import { setDeliverableApprovalAction } from "@/lib/actions/deliverables";
import { spring } from "@/lib/motion";
import { Button, EmberButton } from "@/components/redesign/ui";

/**
 * R2 client approve/acknowledge control (re-skinned). The write path is preserved
 * verbatim: setDeliverableApprovalAction → set_deliverable_approval RPC. This is one
 * of the two client write paths on this surface; status itself stays read-only.
 */
export function DeliverableApprove({ id, approved }: { id: string; approved: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [isApproved, setIsApproved] = useState(approved);
  const [pop, setPop] = useState(0);

  async function toggle() {
    setBusy(true);
    const next = !isApproved;
    const res = await setDeliverableApprovalAction(id, next);
    setBusy(false);
    if (!res.ok) return toast.error("Couldn't update", { description: res.error });
    setIsApproved(next);
    if (next) setPop((p) => p + 1);
    toast.success(next ? "Marked as approved." : "Approval removed.");
    router.refresh();
  }

  return isApproved ? (
    <Button appearance="outline" size="small" loading={busy} onClick={toggle}>
      <m.span key={pop} initial={pop ? { scale: 0.4 } : false} animate={{ scale: 1 }} transition={spring.bouncy} className="inline-flex">
        <Check size={15} color="#15803d" />
      </m.span>{" "}
      Approved
    </Button>
  ) : (
    <EmberButton size="small" loading={busy} onClick={toggle}>
      Approve
    </EmberButton>
  );
}
