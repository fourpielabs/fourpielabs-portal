import { requireRole } from "@/lib/auth/guards";
import { ClientCreateForm } from "@/components/redesign/staff/client-create-form";
import { StaffPageFrame, StaffPageHeader } from "@/components/redesign/staff/ui";

export default async function NewClientPage() {
  await requireRole(["admin"]); // admin-only at the guard layer (RLS also enforces)

  return (
    <StaffPageFrame max="44rem">
      <StaffPageHeader
        title="New client"
        description="Program clients are seeded an onboarding checklist, 90-day roadmap, and metric definitions. Project clients get a projects board instead — pick the type below."
      />
      <ClientCreateForm />
    </StaffPageFrame>
  );
}
