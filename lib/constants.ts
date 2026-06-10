export const INDUSTRIES = [
  { value: "painting_contractor", label: "Painting contractor" },
  { value: "tour_operator", label: "Tour operator" },
  { value: "other_local_service", label: "Other local service" },
] as const;

export const PROGRAMS = [
  { value: "foundation", label: "Foundation" },
  { value: "pipeline", label: "Pipeline" },
  { value: "operating_system", label: "Operating System" },
  { value: "pulse", label: "Pulse" },
] as const;

export const CLIENT_STATUSES = [
  { value: "onboarding", label: "Onboarding" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "churned", label: "Churned" },
] as const;

export const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "team", label: "Team" },
  { value: "client", label: "Client" },
] as const;

export const DELIVERABLE_TYPES = [
  { value: "blog_post", label: "Blog post" },
  { value: "landing_page", label: "Landing page" },
  { value: "ad_creative", label: "Ad creative" },
  { value: "design", label: "Design" },
  { value: "video", label: "Video" },
  { value: "gbp_update", label: "GBP update" },
  { value: "content_calendar", label: "Content calendar" },
  { value: "report", label: "Report" },
  { value: "strategy_doc", label: "Strategy doc" },
  { value: "other", label: "Other" },
] as const;

export const DELIVERABLE_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In progress" },
  { value: "needs_review", label: "Needs review" },
  { value: "delivered", label: "Delivered" },
] as const;

export const FILE_CATEGORIES = [
  { value: "agreement", label: "Agreement" },
  { value: "onboarding_form", label: "Onboarding form" },
  { value: "welcome_doc", label: "Welcome doc" },
  { value: "invoice", label: "Invoice" },
  { value: "brand_asset", label: "Brand asset" },
  { value: "template", label: "Template" },
  { value: "strategy_doc", label: "Strategy doc" },
  { value: "report", label: "Report" },
  { value: "other", label: "Other" },
] as const;

export function labelOf(
  list: ReadonlyArray<{ value: string; label: string }>,
  value: string | null | undefined,
): string {
  if (!value) return "—";
  return list.find((o) => o.value === value)?.label ?? value;
}
