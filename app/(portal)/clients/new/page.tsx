import { requireRole } from "@/lib/auth/guards";
import { ClientCreateForm } from "@/components/clients/client-create-form";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";

export default async function NewClientPage() {
  await requireRole(["admin"]); // admin-only at the guard layer (RLS also enforces)

  return (
    <PageContainer width="focused" stack>
      <PageHeader
        title="New client"
        description="Program clients are seeded an onboarding checklist, 90-day roadmap, and metric definitions. Project clients get a projects board instead — pick the type below."
      />
      <ClientCreateForm />
    </PageContainer>
  );
}
