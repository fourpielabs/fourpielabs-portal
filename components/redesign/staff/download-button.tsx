"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { getSignedUrlAction } from "@/lib/actions/storage";
import { Button } from "@/components/redesign/ui";

/**
 * R3 staff signed-URL download (re-skinned). Same getSignedUrlAction wiring as the old
 * files/download-button (staff are storage-policy-functional); presentation only.
 */
export function StaffDownloadButton({
  clientId, path, label = "Download", size = "small",
}: {
  clientId: string; path: string; label?: string; size?: "small" | "medium";
}) {
  const [pending, setPending] = useState(false);
  async function go() {
    setPending(true);
    const res = await getSignedUrlAction(clientId, path);
    setPending(false);
    if (!res.ok) return toast.error("Couldn't get link", { description: res.error });
    window.open(res.url, "_blank", "noopener,noreferrer");
  }
  return (
    <Button appearance="outline" size={size} loading={pending} icon={<Download size={14} />} onClick={go}>
      {label}
    </Button>
  );
}
