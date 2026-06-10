"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { getSignedUrlAction } from "@/lib/actions/storage";
import { Button } from "@/components/ui/button";

type Props = {
  clientId: string;
  path: string;
  label?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
};

export function DownloadButton({
  clientId,
  path,
  label = "Download",
  variant = "outline",
  size = "sm",
}: Props) {
  const [pending, setPending] = useState(false);

  async function go() {
    setPending(true);
    const res = await getSignedUrlAction(clientId, path);
    setPending(false);
    if (!res.ok) return toast.error("Couldn't get link", { description: res.error });
    window.open(res.url, "_blank", "noopener,noreferrer");
  }

  return (
    <Button variant={variant} size={size} disabled={pending} onClick={go}>
      <Download className="size-4" />
      {size !== "icon" && <span>{label}</span>}
    </Button>
  );
}
