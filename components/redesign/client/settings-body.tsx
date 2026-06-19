"use client";

import * as React from "react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { updateOwnProfileAction } from "@/lib/actions/profile";
import { sendPasswordResetAction } from "@/lib/actions/auth";
import { uploadAvatarAction, removeAvatarAction } from "@/lib/actions/profile";
import { updateEmailPreferencesAction } from "@/lib/actions/notification-preferences";
import { emailPrefTypesForRole } from "@/lib/notification-prefs";
import { Avatar, Button, EmberButton, Input, Field, Switch, Eyebrow, tokens } from "@/components/redesign/ui";
import { useRedesignMode } from "@/components/redesign/themed-fluent";
import { ClientPageFrame } from "@/components/redesign/client/page-frame";

const schema = z.object({ full_name: z.string().trim().min(1, "Enter your name").max(100, "Too long") });
type Values = z.infer<typeof schema>;

export function SettingsBody({
  fullName,
  email,
  role,
  avatarUrl,
  prefs,
}: {
  fullName: string | null;
  email: string | null;
  role: string;
  avatarUrl: string | null;
  prefs: Record<string, boolean | null>;
}) {
  const { mode } = useRedesignMode();
  const onDark = mode === "dark";
  const fg1 = tokens.colorNeutralForeground1;
  const fg2 = tokens.colorNeutralForeground2;
  const fg3 = tokens.colorNeutralForeground3;
  const panel = onDark ? "rd-solid--dark" : "rd-solid";
  const card: React.CSSProperties = { borderRadius: 20, padding: "1.3rem", display: "flex", flexDirection: "column", gap: "1rem" };
  const sectionTitle = (t: string, d: string) => (
    <div>
      <h2 className="rd-display" style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600, color: fg1 }}>{t}</h2>
      <p style={{ margin: "0.2rem 0 0", fontSize: "0.82rem", color: fg3 }}>{d}</p>
    </div>
  );

  return (
    <ClientPageFrame width="text">
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", paddingBlock: "clamp(0.5rem,2vw,1rem)" }}>
        <div className="rd-rise" style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <Eyebrow tone={onDark ? "onDark" : "amber"}>Settings</Eyebrow>
          <h1 className="rd-display" style={{ margin: 0, fontSize: "clamp(1.9rem,5vw,2.6rem)", fontWeight: 600, lineHeight: 1.02, color: fg1 }}>Your profile</h1>
        </div>

        <div className={`${panel} rd-rise`} style={card}>
          {sectionTitle("Photo", "Shown across the portal next to your name.")}
          <AvatarSection name={fullName} email={email} avatarUrl={avatarUrl} fg3={fg3} />
        </div>

        <ProfileSection fullName={fullName} email={email} role={role} card={card} panel={panel} title={sectionTitle} fg2={fg2} fg3={fg3} />

        <EmailPrefsSection role={role} current={prefs} card={card} panel={panel} title={sectionTitle} onDark={onDark} fg1={fg1} fg3={fg3} />
      </div>
    </ClientPageFrame>
  );
}

function AvatarSection({ name, email, avatarUrl, fg3 }: { name: string | null; email: string | null; avatarUrl: string | null; fg3: string }) {
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
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <Avatar name={name ?? email ?? "You"} image={avatarUrl ? { src: avatarUrl } : undefined} color="brand" size={56} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Button appearance="outline" size="small" loading={busy} onClick={() => inputRef.current?.click()}>
            {avatarUrl ? "Change photo" : "Upload photo"}
          </Button>
          {avatarUrl && <Button appearance="subtle" size="small" loading={busy} onClick={remove}>Remove</Button>}
        </div>
        <p style={{ margin: 0, fontSize: "0.75rem", color: fg3 }}>PNG, JPG, GIF, or WebP — max 2 MB.</p>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" style={{ display: "none" }} onChange={onFile} />
      </div>
    </div>
  );
}

function ProfileSection({ fullName, email, role, card, panel, title, fg2, fg3 }: any) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { full_name: fullName ?? "" } });
  async function onSubmit(v: Values) {
    setSaving(true);
    const res = await updateOwnProfileAction(v);
    setSaving(false);
    if (!res.ok) return toast.error("Couldn't save", { description: res.error });
    toast.success("Profile updated.");
    router.refresh();
  }
  async function sendReset() {
    if (!email) return;
    setResetting(true);
    const res = await sendPasswordResetAction(email);
    setResetting(false);
    if (!res.ok) return toast.error("Couldn't send reset", { description: res.error });
    toast.success("Password reset email sent — check your inbox.");
  }
  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className={`${panel} rd-rise`} style={card}>
        {title("Profile", "Your name and account email.")}
        <Field label="Full name" validationState={errors.full_name ? "error" : "none"} validationMessage={errors.full_name?.message}>
          <Input {...register("full_name")} />
        </Field>
        <Field label="Email" hint="Email is managed by your 4Pie Labs admin and can't be changed here.">
          <Input value={email ?? ""} readOnly disabled />
        </Field>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "0.75rem", color: fg3 }}>Role</span>
          <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "0.25rem 0.6rem", borderRadius: 999, textTransform: "capitalize", background: "rgba(217,119,6,0.12)", color: "#b45309" }}>{role}</span>
        </div>
        <div><EmberButton type="submit" loading={saving} disabled={saving || !isDirty}>Save changes</EmberButton></div>
      </form>

      <div className={`${panel} rd-rise`} style={card}>
        {title("Password", "We'll email you a secure link to set a new password.")}
        <div><Button appearance="outline" loading={resetting} disabled={resetting || !email} onClick={sendReset}>Send password reset email</Button></div>
      </div>
    </>
  );
}

function EmailPrefsSection({ role, current, card, panel, title, onDark, fg1, fg3 }: any) {
  const router = useRouter();
  const types = emailPrefTypesForRole(role);
  const [values, setValues] = useState<Record<string, boolean>>(() => {
    const v: Record<string, boolean> = {};
    for (const t of types) v[t.column] = current[t.column] ?? true; // absence-of-row → ON
    return v;
  });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  async function save() {
    setSaving(true);
    const res = await updateEmailPreferencesAction(values);
    setSaving(false);
    if (!res.ok) return toast.error("Couldn't save", { description: res.error });
    setDirty(false);
    toast.success("Email preferences saved.");
    router.refresh();
  }
  const divider = onDark ? "#231f19" : "#f1efe8";
  return (
    <div className={`${panel} rd-rise`} style={card}>
      {title("Email notifications", "Choose which emails we send you — you'll always see updates in the app.")}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {types.map((t: { column: string; label: string; description: string }) => (
          <label key={t.column} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "0.7rem 0", borderTop: `1px solid ${divider}`, cursor: "pointer" }}>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: "0.88rem", fontWeight: 500, color: fg1 }}>{t.label}</span>
              <span style={{ display: "block", fontSize: "0.76rem", color: fg3 }}>{t.description}</span>
            </span>
            <Switch checked={values[t.column]} onChange={(_, d) => { setValues((s) => ({ ...s, [t.column]: d.checked })); setDirty(true); }} aria-label={t.label} />
          </label>
        ))}
      </div>
      <div><EmberButton loading={saving} disabled={saving || !dirty} onClick={save}>Save preferences</EmberButton></div>
    </div>
  );
}
