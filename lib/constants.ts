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

/** Staff-invitable roles (clients are provisioned via the create-client flow,
 * not invited — see sendInviteAction / createClientAction). */
export const STAFF_ROLES = ROLES.filter((r) => r.value !== "client");

export const CLIENT_TYPES = [
  { value: "program", label: "Program — 90-day roadmap" },
  { value: "project", label: "Project — scoped / one-off work" },
] as const;

export const PROJECT_STATUSES = [
  { value: "proposed", label: "Proposed" },
  { value: "active", label: "Active" },
  { value: "in_review", label: "In review" },
  { value: "complete", label: "Complete" },
] as const;

export const TASK_STATUSES = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
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

export const CONTENT_PLATFORMS = [
  { value: "blog", label: "Blog" },
  { value: "gbp", label: "Google Business" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "google_ads", label: "Google Ads" },
  { value: "meta_ads", label: "Meta Ads" },
  { value: "email", label: "Email" },
  { value: "other", label: "Other" },
] as const;

export const CONTENT_STATUSES = [
  { value: "idea", label: "Idea" },
  { value: "drafting", label: "Drafting" },
  { value: "in_review", label: "In review" },
  { value: "approved", label: "Approved" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
] as const;

export const METRIC_UNITS = [
  { value: "number", label: "Number" },
  { value: "currency", label: "Currency" },
  { value: "percent", label: "Percent" },
  { value: "text", label: "Text" },
] as const;

export const COMPETITOR_PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
] as const;

export function labelOf(
  list: ReadonlyArray<{ value: string; label: string }>,
  value: string | null | undefined,
): string {
  if (!value) return "—";
  return list.find((o) => o.value === value)?.label ?? value;
}
