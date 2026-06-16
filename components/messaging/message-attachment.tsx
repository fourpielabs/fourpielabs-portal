"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, Paperclip } from "lucide-react";

import { getMessageAttachmentUrlAction } from "@/lib/actions/message-attachments";

/**
 * Download chip for a message attachment. The URL is minted on demand by a server
 * action that re-checks message access via RLS (a client can't fetch an internal
 * attachment) — we never embed a long-lived URL in the rendered message.
 */
export function MessageAttachment({ messageId, name }: { messageId: string; name: string }) {
  const [pending, setPending] = useState(false);
  async function open() {
    setPending(true);
    const res = await getMessageAttachmentUrlAction(messageId);
    setPending(false);
    if (!res.ok) return toast.error("Couldn't open file", { description: res.error });
    window.open(res.url, "_blank", "noopener,noreferrer");
  }
  return (
    <button
      type="button"
      onClick={open}
      disabled={pending}
      className="motion-micro mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-bg disabled:opacity-50"
    >
      <Paperclip className="size-3.5 shrink-0" />
      <span className="truncate">{name}</span>
      <Download className="size-3.5 shrink-0 text-ink-3" />
    </button>
  );
}
