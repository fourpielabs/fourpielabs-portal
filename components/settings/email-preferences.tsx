"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateEmailPreferencesAction } from "@/lib/actions/notification-preferences";
import { emailPrefTypesForRole } from "@/lib/notification-prefs";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function EmailPreferences({
  role,
  current,
}: {
  role: string;
  current: Record<string, boolean | null>;
}) {
  const router = useRouter();
  const types = emailPrefTypesForRole(role);
  const [values, setValues] = useState<Record<string, boolean>>(() => {
    const v: Record<string, boolean> = {};
    for (const t of types) v[t.column] = current[t.column] ?? true; // absence-of-row → ON
    return v;
  });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  function toggle(col: string, on: boolean) {
    setValues((s) => ({ ...s, [col]: on }));
    setDirty(true);
  }
  async function save() {
    setSaving(true);
    const res = await updateEmailPreferencesAction(values);
    setSaving(false);
    if (!res.ok) return toast.error("Couldn't save", { description: res.error });
    setDirty(false);
    toast.success("Email preferences saved.");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email notifications</CardTitle>
        <CardDescription>
          Choose which emails we send you — you&apos;ll always see updates in the app.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col">
        {types.map((t) => (
          <label
            key={t.column}
            className="flex cursor-pointer items-center justify-between gap-4 border-b border-row-divider py-3 last:border-0"
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium">{t.label}</span>
              <span className="block text-xs text-ink-3">{t.description}</span>
            </span>
            <Switch
              checked={values[t.column]}
              onCheckedChange={(on) => toggle(t.column, on)}
              aria-label={t.label}
            />
          </label>
        ))}
        <div className="pt-4">
          <Button onClick={save} loading={saving} disabled={saving || !dirty}>
            {saving ? "Saving…" : "Save preferences"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
