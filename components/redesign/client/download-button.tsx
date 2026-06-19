"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { getSignedUrlAction } from "@/lib/actions/storage";
import { Button } from "@/components/redesign/ui";

/**
 * R2 signed-URL download (re-skinned). Write path preserved: getSignedUrlAction mints
 * a short-lived signed URL server-side (clients have no storage policy) → open in a tab.
 */
export function DownloadButton({
  clientId,
  path,
  label = "Download",
  appearance = "outline",
}: {
  clientId: string;
  path: string;
  label?: string;
  appearance?: "outline" | "subtle" | "secondary";
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
    <Button appearance={appearance} size="small" loading={pending} icon={<Download size={15} />} onClick={go}>
      {label}
    </Button>
  );
}
