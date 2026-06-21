import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { IntakeWizard } from "@/components/redesign/client/intake-wizard";
import type { IntakeConfig, IntakeAnswers, IntakeAsset } from "@/lib/intake/config";

/**
 * Project intake wizard — PROJECT clients only (program clients → dashboard).
 * Loads the staff-editable config + the client's resumable draft + any assets
 * already uploaded (RLS-scoped). All writes happen via the SECURITY DEFINER RPCs
 * inside the wizard's actions; this page only READS.
 */
export default async function IntakePage() {
  const profile = await requireRole(["client"]);
  const supabase = await createClient();

  const { data: typeRow } = await supabase.from("client_clients").select("client_type").maybeSingle();
  if (typeRow?.client_type !== "project") redirect("/dashboard");

  const [{ data: cfg }, { data: draft }, { data: assetFiles }] = await Promise.all([
    supabase.from("intake_config").select("config").eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("project_intakes").select("service, answers, current_step").eq("status", "draft").maybeSingle(),
    supabase.from("files").select("name, storage_path").like("storage_path", "%/intake/%").order("created_at", { ascending: false }),
  ]);
  if (!cfg?.config) redirect("/dashboard");

  const config = cfg.config as IntakeConfig;
  const assets: IntakeAsset[] = (assetFiles ?? []).map((f) => ({ name: f.name as string, path: f.storage_path as string }));

  return (
    <IntakeWizard
      config={config}
      initial={{
        clientId: profile.client_id!,
        service: (draft?.service as string) ?? null,
        answers: (draft?.answers as IntakeAnswers) ?? {},
        currentStep: (draft?.current_step as number) ?? 0,
        assets,
        prefill: { name: profile.full_name, email: profile.email },
      }}
    />
  );
}
