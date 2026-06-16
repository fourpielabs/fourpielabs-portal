"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, Paperclip } from "lucide-react";

import { getMessageAttachmentUrlAction } from "@/lib/actions/message-attachments";

const IMAGE_RE = /\.(png|jpe?g|gif|webp|avif)$/i;

/**
 * Message attachment. The URL is minted on demand by a server action that re-checks
 * message access via RLS (a client can't fetch an internal-thread attachment) — the
 * SAME boundary gate for both the inline image preview and the download. Image-MIME
 * attachments render an inline thumbnail; everything else is a download chip.
 */
export function MessageAttachment({ messageId, name }: { messageId: string; name: string }) {
  const isImage = IMAGE_RE.test(name);
  const [url, setUrl] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // images: fetch a signed URL on mount to render inline (same boundary-gated action)
  useEffect(() => {
    if (!isImage) return;
    let active = true;
    getMessageAttachmentUrlAction(messageId).then((res) => {
      if (active && res.ok) setUrl(res.url);
    });
    return () => {
      active = false;
    };
  }, [isImage, messageId]);

  async function open() {
    setPending(true);
    const res = await getMessageAttachmentUrlAction(messageId); // fresh URL on click
    setPending(false);
    if (!res.ok) return toast.error("Couldn't open file", { description: res.error });
    window.open(res.url, "_blank", "noopener,noreferrer");
  }

  if (isImage) {
    return (
      <button
        type="button"
        onClick={open}
        aria-label={`Open image ${name}`}
        className="motion-micro mt-1.5 block overflow-hidden rounded-lg border border-border hover:opacity-90"
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={name} className="max-h-60 max-w-[260px] object-cover" />
        ) : (
          <div className="h-32 w-44 animate-pulse bg-surface-2" />
        )}
      </button>
    );
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
