import { requireRole } from "@/lib/auth/guards";
import { ClientCreateForm } from "@/components/clients/client-create-form";

export default async function NewClientPage() {
  await requireRole(["admin"]); // admin-only at the guard layer (RLS also enforces)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.015em]">New client</h1>
        <p className="text-muted-foreground">
          Program clients are seeded an onboarding checklist, 90-day roadmap, and
          metric definitions. Project clients get a projects board instead — pick
          the type below.
        </p>
      </div>
      <ClientCreateForm />
    </div>
  );
}
