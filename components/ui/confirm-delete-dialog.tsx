"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { BaseModal, EmberButton, Input, tokens } from "@/components/redesign/ui";

/**
 * Type-to-confirm destructive dialog (Warm Obsidian / Fluent). The action button stays
 * DISABLED until the admin types `confirmPhrase` exactly — stronger than a one-click
 * confirm, for irreversible deletes. `description` should spell out the blast radius in
 * plain words (use plain text / <strong>, NOT Tailwind color classes, so it stays AA in
 * light + dark). `onConfirm` returns the action Result. The type-to-confirm guard is
 * preserved verbatim; only the chrome/fields were converted off shadcn to Fluent.
 */
export function ConfirmDeleteDialog({
  trigger,
  title,
  description,
  confirmPhrase,
  confirmLabel = "Delete",
  successMessage = "Deleted.",
  onConfirm,
}: {
  trigger: React.ReactNode;
  title: string;
  description: React.ReactNode;
  confirmPhrase: string;
  confirmLabel?: string;
  successMessage?: string;
  onConfirm: () => Promise<{ ok: boolean; error?: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const matches = value.trim() === confirmPhrase;

  async function run() {
    if (!matches || pending) return;
    setPending(true);
    const res = await onConfirm();
    setPending(false);
    if (!res.ok) return toast.error("Couldn't delete", { description: res.error });
    toast.success(successMessage);
    setOpen(false);
    setValue("");
    router.refresh();
  }

  const fg1 = tokens.colorNeutralForeground1, fg2 = tokens.colorNeutralForeground2;
  return (
    <>
      <span style={{ display: "contents" }} onClick={() => setOpen(true)}>{trigger}</span>
      <BaseModal
        isOpen={open}
        onClose={() => { setOpen(false); setValue(""); }}
        title={title}
        size="sm"
        footer={
          <EmberButton
            disabled={!matches || pending}
            loading={pending}
            onClick={run}
            style={{ background: "linear-gradient(180deg,#dc2626,#b91c1c)" }}
          >
            {confirmLabel}
          </EmberButton>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14, color: fg2 }}>{description}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label htmlFor="confirm-phrase" style={{ fontSize: 13, color: fg2 }}>
              Type <strong style={{ color: fg1 }}>{confirmPhrase}</strong> to confirm
            </label>
            <Input
              id="confirm-phrase"
              value={value}
              onChange={(_, d) => setValue(d.value)}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder={confirmPhrase}
            />
          </div>
        </div>
      </BaseModal>
    </>
  );
}
