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
  status: z.enum(["onboarding", "active", "paused", "churned"]),
  website_url: optionalUrl,
  start_date: optionalDate,
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

export const inviteSchema = z
  .object({
    email: z.string().trim().email("Enter a valid email"),
    full_name: z.string().trim().optional(),
    role: z.enum(["admin", "team", "client"]),
    client_id: z.string().uuid().optional().or(z.literal("")),
  })
  .refine((v) => v.role !== "client" || (v.client_id && v.client_id.length > 0), {
    message: "A client invite must select a client",
    path: ["client_id"],
  });
export type InviteValues = z.infer<typeof inviteSchema>;

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
