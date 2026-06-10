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

export function labelOf(
  list: ReadonlyArray<{ value: string; label: string }>,
  value: string | null | undefined,
): string {
  if (!value) return "—";
  return list.find((o) => o.value === value)?.label ?? value;
}
