import { requireRole } from "@/lib/auth/guards";
import { ClientCreateForm } from "@/components/clients/client-create-form";

export default async function NewClientPage() {
  await requireRole(["admin"]); // admin-only at the guard layer (RLS also enforces)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.015em]">New client</h1>
        <p className="text-muted-foreground">
          Creating a client automatically seeds its onboarding checklist, 90-day
          roadmap, and program metric definitions.
        </p>
      </div>
      <ClientCreateForm />
    </div>
  );
}
