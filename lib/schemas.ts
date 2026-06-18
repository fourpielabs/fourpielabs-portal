import { z } from "zod";

// Shared by client forms (RHF resolver) and server actions (re-validation).

const optionalUrl = z
  .string()
  .trim()
  .url("Enter a valid URL")
  .or(z.literal(""))
  .optional();

const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .or(z.literal(""))
  .optional();

export const clientCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers, and hyphens"),
  industry: z.enum([
    "painting_contractor",
    "tour_operator",
    "other_local_service",
  ]),
  program: z.enum(["foundation", "pipeline", "operating_system", "pulse"]),
  // program → 90-day roadmap (seeded); project → projects board (no roadmap seed).
  client_type: z.enum(["program", "project"]),
  status: z.enum(["onboarding", "active", "paused", "churned"]),
  website_url: optionalUrl,
  start_date: optionalDate,
  // Optional client-user provisioning (the "create client account" flow). When an
  // email is supplied we invite a client portal user and send the welcome email.
  client_email: z.string().trim().email("Enter a valid email").or(z.literal("")).optional(),
  client_full_name: z.string().trim().optional(),
});
export type ClientCreateValues = z.infer<typeof clientCreateSchema>;

export const clientUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Name is required"),
  industry: z.enum([
    "painting_contractor",
    "tour_operator",
    "other_local_service",
  ]),
  program: z.enum(["foundation", "pipeline", "operating_system", "pulse"]),
  status: z.enum(["onboarding", "active", "paused", "churned"]),
  website_url: optionalUrl,
  start_date: optionalDate,
  service_type: z.string().trim().optional(),
  investment: z.string().trim().optional(),
  comms_channel: z.string().trim().optional(),
  internal_notes: z.string().trim().optional(),
});
export type ClientUpdateValues = z.infer<typeof clientUpdateSchema>;

// Invites are STAFF-ONLY (admin/team). Client portal users are provisioned via
// the create-client flow (createClientAction), never invited from here.
export const inviteSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  full_name: z.string().trim().optional(),
  role: z.enum(["admin", "team"]),
});
export type InviteValues = z.infer<typeof inviteSchema>;

// --- Projects (client-owned, written via create_project/update_project RPCs) --
export const projectCreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().optional(),
});
export type ProjectCreateValues = z.infer<typeof projectCreateSchema>;

// Clients edit title + description ONLY — project status is staff-controlled
// (the update_project RPC dropped p_status; status is never client-settable).
export const projectUpdateSchema = projectCreateSchema.extend({
  id: z.string().uuid(),
});
export type ProjectUpdateValues = z.infer<typeof projectUpdateSchema>;

// Staff project management (direct table writes under the projects for-all
// policies — admin/assigned team). Staff also set dates; the client RPC doesn't.
export const projectStaffSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().optional(),
  status: z.enum(["proposed", "active", "in_review", "complete"]),
  start_date: optionalDate,
  due_date: optionalDate,
});
export type ProjectStaffValues = z.infer<typeof projectStaffSchema>;

// --- Tasks (5a) — staff direct writes + client create_task RPC. Status is staff-only
//     (the client update_task_status RPC was dropped — see lock_task_status migration). --
const optionalUuid = z.string().uuid().or(z.literal("")).optional().nullable();

// Client write path (create_task RPC): no status (always starts 'todo'), no visibility
// (client tasks are always client-visible). assignee/source validated by the RPC.
export const taskClientCreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().optional(),
  assignee_id: optionalUuid,
  due_date: optionalDate,
  source_message_id: optionalUuid,
});
export type TaskClientCreateValues = z.infer<typeof taskClientCreateSchema>;

// Client EDIT path (update_task RPC): TITLE + DESCRIPTION only. status / assignee /
// due_date / visible_to_client are staff-only and structurally unreachable here.
export const taskClientUpdateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().optional(),
});
export type TaskClientUpdateValues = z.infer<typeof taskClientUpdateSchema>;

// Staff write path (direct table under the tasks for-all policies). Staff set
// status + visibility; assignee is re-validated to the client's circle in the action.
export const taskStaffSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().optional(),
  status: z.enum(["todo", "in_progress", "done"]),
  assignee_id: optionalUuid,
  due_date: optionalDate,
  visible_to_client: z.boolean(),
  source_message_id: optionalUuid,
});
export type TaskStaffValues = z.infer<typeof taskStaffSchema>;

export const setActiveSchema = z.object({
  userId: z.string().uuid(),
  isActive: z.boolean(),
});

export const assignmentSchema = z.object({
  clientId: z.string().uuid(),
  userId: z.string().uuid(),
});

// --- P3: team workspace ------------------------------------------------------

const optionalText = z.string().trim().optional();

export const checklistItemSchema = z.object({
  phase_label: optionalText,
  title: z.string().trim().min(1, "Title is required"),
  link_url: optionalUrl,
  assignee: z.enum(["client", "team"]),
  visible_to_client: z.boolean(),
});
export type ChecklistItemValues = z.infer<typeof checklistItemSchema>;

export const milestoneSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: optionalText,
  phase_label: optionalText,
  status: z.enum(["upcoming", "in_progress", "done"]),
  due_date: optionalDate,
  visible_to_client: z.boolean(),
});
export type MilestoneValues = z.infer<typeof milestoneSchema>;

export const programSchema = z.object({
  id: z.string().uuid(),
  service_type: optionalText,
  investment: optionalText,
  start_date: optionalDate,
  end_date: optionalDate,
  comms_channel: optionalText,
  best_way_to_reach: optionalText,
  response_time: optionalText,
  call_scheduling_note: optionalText,
  revision_policy: optionalText,
  whats_included: optionalText,
  whats_not_included: optionalText,
});
export type ProgramValues = z.infer<typeof programSchema>;

export const deliverableSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: optionalText,
  type: z.enum([
    "blog_post",
    "landing_page",
    "ad_creative",
    "design",
    "video",
    "gbp_update",
    "content_calendar",
    "report",
    "strategy_doc",
    "other",
  ]),
  status: z.enum(["pending", "in_progress", "needs_review", "delivered"]),
  due_date: optionalDate,
  preview_url: optionalUrl,
  visible_to_client: z.boolean(),
  // optional link to one of the client's projects ("" = none, only offered for
  // project-type clients). The action re-validates it belongs to the same client.
  project_id: z.string().uuid().or(z.literal("")).optional().nullable(),
});
export type DeliverableValues = z.infer<typeof deliverableSchema>;

export const fileMetaSchema = z.object({
  category: z.enum([
    "agreement",
    "onboarding_form",
    "welcome_doc",
    "invoice",
    "brand_asset",
    "template",
    "strategy_doc",
    "report",
    "other",
  ]),
  visible_to_client: z.boolean(),
});

export const updateSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  body: optionalText,
  pinned: z.boolean(),
  visible_to_client: z.boolean(),
});
export type UpdateValues = z.infer<typeof updateSchema>;

// --- P4: trackers ------------------------------------------------------------

// Numeric form fields are kept as strings here (so RHF typing stays clean) and
// parsed to number-or-null in the server actions via numFromStr().
const optionalNumber = z.string().trim().optional();

export const contentItemSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  platform: z.enum([
    "blog",
    "gbp",
    "instagram",
    "tiktok",
    "youtube",
    "facebook",
    "linkedin",
    "google_ads",
    "meta_ads",
    "email",
    "other",
  ]),
  content_type: optionalText,
  status: z.enum([
    "idea",
    "drafting",
    "in_review",
    "approved",
    "scheduled",
    "published",
  ]),
  publish_date: optionalDate,
  cta: optionalText,
  core_message: optionalText,
  notes: optionalText,
  asset_url: optionalUrl,
  views_after_posting: optionalNumber,
  visible_to_client: z.boolean(),
});
export type ContentItemValues = z.infer<typeof contentItemSchema>;

export const metricDefinitionSchema = z.object({
  label: z.string().trim().min(1, "Label is required"),
  key: z
    .string()
    .trim()
    .min(1, "Key is required")
    .regex(/^[a-z0-9_]+$/, "Lowercase letters, numbers, underscores"),
  unit: z.enum(["number", "currency", "percent", "text"]),
  is_active: z.boolean(),
});
export type MetricDefinitionValues = z.infer<typeof metricDefinitionSchema>;

export const competitorSchema = z.object({
  name_or_handle: z.string().trim().min(1, "Name/handle is required"),
  niche: optionalText,
  follower_count: optionalNumber,
  avg_views: optionalNumber,
  top_content_format: optionalText,
  hook_style: optionalText,
  whats_working: optionalText,
  gap_notes: optionalText,
  adapted_idea: optionalText,
  priority: z.enum(["low", "medium", "high"]),
  visible_to_client: z.boolean(),
});
export type CompetitorValues = z.infer<typeof competitorSchema>;

export const callTypeSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  duration_label: optionalText,
  frequency_label: optionalText,
  booking_url: optionalUrl,
});
export type CallTypeValues = z.infer<typeof callTypeSchema>;

export const callRecordingSchema = z.object({
  call_date: optionalDate,
  call_type: optionalText,
  recording_url: optionalUrl,
  key_topic: optionalText,
  visible_to_client: z.boolean(),
});
export type CallRecordingValues = z.infer<typeof callRecordingSchema>;

export const meetingNoteSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  meeting_date: optionalDate,
  body: optionalText,
  visible_to_client: z.boolean(),
});
export type MeetingNoteValues = z.infer<typeof meetingNoteSchema>;

export const reportSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  period_start: optionalDate,
  period_end: optionalDate,
  summary: optionalText,
});
export type ReportValues = z.infer<typeof reportSchema>;
