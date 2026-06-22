"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, FileUp, Lock, Plus, X } from "lucide-react";
import { Eyebrow, EmberButton, Button, Input, Textarea, Select, tokens } from "@/components/redesign/ui";
import { useRedesignMode } from "@/components/redesign/themed-fluent";
import { ClientPageFrame } from "@/components/redesign/client/page-frame";
import { FileDropzone } from "@/components/redesign/ui/file-dropzone";
import { BookButton } from "@/components/booking/book-button";
import {
  type IntakeConfig, type IntakeAnswers, type IntakeField, type IntakeAsset,
  visibleSteps, validateStep, allValid, computeEstimate, formatEstimate, buildBrief,
} from "@/lib/intake/config";
import { saveIntakeAction, submitIntakeAction, uploadIntakeAssetAction } from "@/lib/actions/intake";

type Initial = {
  clientId: string;
  service: string | null;
  answers: IntakeAnswers;
  currentStep: number;
  assets: IntakeAsset[];
  prefill: { name: string | null; email: string | null };
};

const asArr = (v: string | string[] | undefined): string[] => (Array.isArray(v) ? v : v ? [v] : []);

export function IntakeWizard({ config, initial }: { config: IntakeConfig; initial: Initial }) {
  const router = useRouter();
  const { mode } = useRedesignMode();
  const onDark = mode === "dark";
  const fg1 = tokens.colorNeutralForeground1, fg2 = tokens.colorNeutralForeground2, fg3 = tokens.colorNeutralForeground3;
  const panel = onDark ? "rd-solid--dark" : "rd-solid";
  const border = onDark ? "#34302a" : "#e7e5e0";

  const [answers, setAnswers] = React.useState<IntakeAnswers>(() => {
    // seed select/radio defaults once so required defaults aren't "empty"
    const a = { ...(initial.answers ?? {}) };
    for (const s of config.steps) for (const f of s.fields) if (f.default != null && a[f.key] == null) a[f.key] = f.default;
    return a;
  });
  const [assets, setAssets] = React.useState<IntakeAsset[]>(initial.assets ?? []);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [stepIdx, setStepIdx] = React.useState(initial.currentStep ?? 0);
  const [busy, setBusy] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [done, setDone] = React.useState<{ projectId: string } | null>(null);

  const steps = visibleSteps(config, answers);
  const idx = Math.min(stepIdx, steps.length - 1);
  const step = steps[idx];
  const estimate = computeEstimate(config, answers);
  const isLast = idx === steps.length - 1;
  const progress = Math.round(((idx + 1) / steps.length) * 100);

  const setAnswer = (key: string, value: string | string[] | undefined) => {
    setAnswers((a) => ({ ...a, [key]: value }));
    setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
  };

  async function persist(nextStep: number) {
    await saveIntakeAction({ service: (answers.service as string) ?? null, answers, estimateMin: estimate?.min ?? null, estimateMax: estimate?.max ?? null, currentStep: nextStep }).catch(() => {});
  }

  async function next() {
    const errs = validateStep(step, answers);
    if (Object.keys(errs).length) { setErrors(errs); toast.error("Please complete the required fields."); return; }
    const n = Math.min(idx + 1, steps.length - 1);
    setStepIdx(n); setErrors({});
    void persist(n);
  }
  function back() { const n = Math.max(idx - 1, 0); setStepIdx(n); void persist(n); }

  async function saveExit() { setBusy(true); await persist(idx); setBusy(false); toast.success("Saved — pick up any time."); router.push("/dashboard"); }

  async function onUpload(file: File | null) {
    if (!file) return;
    setUploading(true);
    const fd = new FormData(); fd.append("file", file);
    const res = await uploadIntakeAssetAction(fd);
    setUploading(false);
    if (!res.ok) return toast.error("Upload failed", { description: res.error });
    if (res.data) setAssets((a) => [...a, res.data!]);
    toast.success("Uploaded.");
  }

  async function submit() {
    if (!allValid(config, answers)) {
      // jump to the first invalid visible step (a required field is never hidden on its path)
      const bad = steps.findIndex((s) => Object.keys(validateStep(s, answers)).length > 0);
      if (bad >= 0) { setStepIdx(bad); setErrors(validateStep(steps[bad], answers)); }
      toast.error("Please complete the required fields.");
      return;
    }
    setBusy(true);
    const missingAssets = assets.length === 0 ? ["Brand assets or logos"] : [];
    const brief = buildBrief(config, answers, estimate);
    const res = await submitIntakeAction({
      service: (answers.service as string) ?? null, answers,
      estimateMin: estimate?.min ?? null, estimateMax: estimate?.max ?? null,
      title: String(answers.title ?? ""), description: brief,
      priority: (answers.priority as "low" | "medium" | "high" | "urgent") ?? "medium",
      targetDate: (answers.target_date as string) || null, missingAssets,
    });
    setBusy(false);
    if (!res.ok) return toast.error("Couldn't submit", { description: res.error });
    setDone({ projectId: res.data!.projectId });
  }

  // ---------- success / kickoff scheduling ----------
  if (done) {
    const kickoff = config.kickoff?.calLink ?? "";
    return (
      <ClientPageFrame width="standard">
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", maxWidth: 640, marginInline: "auto", paddingBlock: "1rem" }}>
          <div className={`${panel} rd-rise`} style={{ borderRadius: 20, padding: "2rem 1.5rem", textAlign: "center" }}>
            <span style={{ display: "inline-flex", width: 52, height: 52, alignItems: "center", justifyContent: "center", borderRadius: 999, background: onDark ? "rgba(34,197,94,0.16)" : "#dcfce7", color: "#15803d" }}><Check size={26} /></span>
            <h1 className="rd-display" style={{ margin: "1rem 0 0.4rem", fontSize: "1.5rem", fontWeight: 600, color: fg1 }}>Your project is in.</h1>
            <p style={{ margin: 0, fontSize: "0.95rem", color: fg2 }}>We&rsquo;ve created your project{assets.length === 0 ? " and added a quick to-do for the assets we still need" : ""}. {config.kickoff?.note ?? "Let's book your kickoff call."}</p>
            <div style={{ marginTop: "1.4rem", display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
              {kickoff ? (
                <div style={{ width: "100%", maxWidth: 320 }}>
                  <div className="rd-eyebrow" style={{ color: fg3, marginBottom: 6 }}>Book your kickoff call</div>
                  <BookButton bookingUrl={kickoff} name={initial.prefill.name} email={initial.prefill.email} clientId={initial.clientId} callTypeId="" extraMetadata={{ service: String(answers.service ?? ""), projectId: done.projectId }} />
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: "0.88rem", color: fg3 }}>We&rsquo;ll reach out to schedule your kickoff call.</p>
              )}
              <Button as="a" href="/dashboard" appearance="outline">View your project</Button>
            </div>
          </div>
        </div>
      </ClientPageFrame>
    );
  }

  // ---------- field renderer ----------
  function FieldView({ field }: { field: IntakeField }) {
    const err = errors[field.key];
    const val = answers[field.key];
    const label = (
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: "0.85rem", fontWeight: 600, color: fg1 }}>{field.label}{field.required && <span style={{ color: "#b45309" }}> *</span>}</span>
      </div>
    );
    const help = field.help && <p style={{ margin: 0, fontSize: "0.78rem", color: fg3 }}>{field.help}</p>;
    const errEl = err && <p style={{ margin: 0, fontSize: "0.78rem", color: "#dc2626" }}>{err}</p>;
    const wrap = (c: React.ReactNode) => <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{label}{help}{c}{errEl}</div>;

    switch (field.type) {
      case "service":
        return wrap(
          <div className="rd-intake-services">
            {config.services.map((s) => {
              const active = val === s.key;
              return (
                <button key={s.key} type="button" onClick={() => setAnswer("service", s.key)} className={`${panel} rd-focus`} style={{ textAlign: "left", cursor: "pointer", borderRadius: 16, padding: "1rem", display: "flex", flexDirection: "column", gap: 4, border: active ? `2px solid #d97706` : `1px solid ${border}` }}>
                  <span style={{ fontWeight: 600, color: fg1 }}>{s.label}</span>
                  {s.desc && <span style={{ fontSize: "0.8rem", color: fg3 }}>{s.desc}</span>}
                  <span style={{ fontSize: "0.78rem", color: "#b45309", fontWeight: 600 }}>from ${s.estimateMin.toLocaleString()}</span>
                </button>
              );
            })}
          </div>
        );
      case "text":
        return wrap(<Input value={(val as string) ?? ""} onChange={(_, d) => setAnswer(field.key, d.value)} placeholder={field.placeholder} />);
      case "textarea":
        return wrap(<Textarea value={(val as string) ?? ""} onChange={(_, d) => setAnswer(field.key, d.value)} placeholder={field.placeholder} resize="vertical" />);
      case "date":
        return wrap(<input type="date" value={(val as string) ?? ""} onChange={(e) => setAnswer(field.key, e.target.value)} style={{ height: 36, borderRadius: 8, border: `1px solid ${border}`, background: onDark ? "#1c1813" : "#fff", color: fg1, padding: "0 10px", maxWidth: 220 }} />);
      case "select":
        return wrap(
          <Select value={(val as string) ?? ""} onChange={(e) => setAnswer(field.key, e.target.value)}>
            {field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        );
      case "radio":
        return wrap(
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {field.options?.map((o) => {
              const active = val === o.value;
              return <button key={o.value} type="button" onClick={() => setAnswer(field.key, o.value)} className="rd-focus" style={{ borderRadius: 999, padding: "0.4rem 0.9rem", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? "#d97706" : border}`, background: active ? (onDark ? "rgba(245,158,11,0.16)" : "#fef3c7") : "transparent", color: active ? (onDark ? "#fcd34d" : "#92400e") : fg2 }}>{o.label}</button>;
            })}
          </div>
        );
      case "multiselect": {
        const sel = asArr(val);
        return wrap(
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {field.options?.map((o) => {
              const active = sel.includes(o.value);
              return <button key={o.value} type="button" onClick={() => setAnswer(field.key, active ? sel.filter((x) => x !== o.value) : [...sel, o.value])} className="rd-focus" style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, padding: "0.4rem 0.85rem", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? "#d97706" : border}`, background: active ? (onDark ? "rgba(245,158,11,0.16)" : "#fef3c7") : "transparent", color: active ? (onDark ? "#fcd34d" : "#92400e") : fg2 }}>{active ? <Check size={13} /> : <Plus size={13} />}{o.label}{(o.addMin || o.mult) && <span style={{ opacity: 0.7 }}>{o.mult ? ` +${Math.round((o.mult - 1) * 100)}%` : ` +$${o.addMin}`}</span>}</button>;
            })}
          </div>
        );
      }
      case "assets":
        return wrap(
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <FileDropzone onFile={onUpload} disabled={uploading} hint={uploading ? "Uploading…" : "Brand guidelines, logos, or an access doc — up to 25 MB"} />
            {assets.length > 0 && (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                {assets.map((a) => (
                  <li key={a.path} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", color: fg2 }}><FileUp size={14} color={fg3} /> {a.name}</li>
                ))}
              </ul>
            )}
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", borderRadius: 12, border: `1px solid ${onDark ? "rgba(245,158,11,0.3)" : "#fde68a"}`, background: onDark ? "rgba(245,158,11,0.08)" : "#fffaf0", padding: "0.7rem 0.85rem" }}>
              <Lock size={15} style={{ flexShrink: 0, marginTop: 2, color: "#b45309" }} />
              <span style={{ fontSize: "0.8rem", color: fg2 }}><strong style={{ color: fg1 }}>Never paste passwords here.</strong> Upload an access document if you have one, or we&rsquo;ll set up secure access together on your kickoff call.</span>
            </div>
            <p style={{ margin: 0, fontSize: "0.78rem", color: fg3 }}>No assets yet? No problem — submit anyway and we&rsquo;ll add a reminder to your project.</p>
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <ClientPageFrame width="standard">
      <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem", maxWidth: 720, marginInline: "auto", paddingBlock: "clamp(0.5rem,2vw,1rem)" }}>
        <div className="rd-rise" style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          <Eyebrow tone={onDark ? "onDark" : "amber"}>Start a project</Eyebrow>
          <h1 className="rd-display" style={{ margin: 0, fontSize: "clamp(1.6rem,4vw,2.2rem)", fontWeight: 600, lineHeight: 1.05, color: fg1 }}>{step?.title ?? "Project intake"}</h1>
        </div>

        {/* progress */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.76rem", color: fg3 }}>
            <span>Step {idx + 1} of {steps.length}</span><span>{progress}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: onDark ? "#2a251e" : "#eee9df", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, borderRadius: 999, background: "#d97706", transition: "width .3s var(--rd-ease-out)" }} />
          </div>
        </div>

        {/* fields */}
        <div className={`${panel} rd-rise`} style={{ borderRadius: 20, padding: "1.4rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {step?.fields.map((f) => <FieldView key={f.key} field={f} />)}
        </div>

        {/* budget ticker */}
        {estimate && (
          <div className={panel} style={{ borderRadius: 14, padding: "0.85rem 1.1rem", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontSize: "0.8rem", color: fg3 }}>Estimated range</span>
            <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span className="rd-tnum" style={{ fontSize: "1.15rem", fontWeight: 700, color: fg1 }}>{formatEstimate(estimate)}</span>
              <span style={{ fontSize: "0.72rem", color: fg3 }}>estimate — confirmed on your call</span>
            </span>
          </div>
        )}

        {/* nav */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {idx > 0 && <Button appearance="outline" icon={<ArrowLeft size={16} />} onClick={back}>Back</Button>}
            <Button appearance="subtle" onClick={saveExit} disabled={busy}>Save &amp; exit</Button>
          </div>
          {isLast ? (
            <EmberButton onClick={submit} loading={busy} icon={<Check size={16} />}>Submit project</EmberButton>
          ) : (
            <EmberButton onClick={next} icon={<ArrowRight size={16} />}>Next</EmberButton>
          )}
        </div>
      </div>
      <style>{`.rd-intake-services{display:grid;gap:0.75rem;grid-template-columns:1fr;} @media(min-width:560px){.rd-intake-services{grid-template-columns:1fr 1fr;}}`}</style>
    </ClientPageFrame>
  );
}
