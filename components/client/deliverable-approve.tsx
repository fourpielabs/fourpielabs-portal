"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { m } from "motion/react";

import { setDeliverableApprovalAction } from "@/lib/actions/deliverables";
import { Button } from "@/components/ui/button";
import { spring } from "@/lib/motion";

/** Client's approve/acknowledge control for a deliverable (the only client write
 *  besides the checklist toggle). Drives set_deliverable_approval via the action. */
export function DeliverableApprove({ id, approved }: { id: string; approved: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [isApproved, setIsApproved] = useState(approved);
  // bumps only on a user-driven approve → the check pops then. This is the lone
  // `bouncy` use: a special-success moment, never on passive mount/reload.
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
    <Button variant="outline" size="sm" loading={busy} onClick={toggle}>
      <m.span
        key={pop}
        initial={pop ? { scale: 0.4 } : false}
        animate={{ scale: 1 }}
        transition={spring.bouncy}
        className="inline-flex"
      >
        <Check className="size-4 text-success-dot" />
      </m.span>{" "}
      Approved
    </Button>
  ) : (
    <Button variant="amber" size="sm" loading={busy} onClick={toggle}>
      Approve
    </Button>
  );
}
