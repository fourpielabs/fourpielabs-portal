"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { uploadAvatarAction, removeAvatarAction } from "@/lib/actions/profile";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { Button } from "@/components/ui/button";

export function AvatarUpload({
  name,
  email,
  avatarUrl,
}: {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.set("file", file);
    const res = await uploadAvatarAction(fd);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    if (!res.ok) return toast.error("Upload failed", { description: res.error });
    toast.success("Photo updated.");
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    const res = await removeAvatarAction();
    setBusy(false);
    if (!res.ok) return toast.error("Couldn't remove photo", { description: res.error });
    toast.success("Photo removed.");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-5">
      <PersonAvatar name={name} email={email} src={avatarUrl} size="lg" />
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? "Uploading…" : avatarUrl ? "Change photo" : "Upload photo"}
          </Button>
          {avatarUrl && (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={remove}>
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-ink-3">PNG, JPG, GIF, or WebP — max 2 MB.</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="hidden"
          onChange={onFile}
        />
      </div>
    </div>
  );
}
