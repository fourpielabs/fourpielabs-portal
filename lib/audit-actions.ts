/**
 * Canonical audit_log action constants — the SINGLE SOURCE OF TRUTH.
 *
 * `logAudit()` (lib/audit.ts) types its `action` param as `AuditAction`, so any
 * new audit() call whose action isn't listed here is a COMPILE ERROR — the list
 * can't silently drift. The admin audit filter reads `AUDIT_ACTION_GROUPS`
 * directly, so it always reflects the full set (grouped by entity).
 *
 * When you add a new audited action in lib/actions/*, add it to its group here.
 */
export const AUDIT_ACTION_GROUPS = {
  Clients: ["client.created", "client.updated", "client.status_changed"],
  Users: [
    "user.invited",
    "user.invite_failed",
    "user.invite_resent",
    "user.invite_revoked",
    "user.reactivated",
    "user.deactivated",
    "assignment.created",
    "assignment.removed",
  ],
  Account: [
    "profile.updated",
    "profile.avatar_updated",
    "password_reset.requested",
    "password_reset.failed",
  ],
  Checklist: [
    "checklist_item.created",
    "checklist_item.updated",
    "checklist_item.deleted",
    "checklist_item.completed",
    "checklist_item.reopened",
    "checklist_item.visibility_changed",
    "checklist_item.reordered",
  ],
  Milestones: [
    "milestone.created",
    "milestone.updated",
    "milestone.status_changed",
    "milestone.deleted",
    "milestone.reordered",
  ],
  Deliverables: [
    "deliverable.created",
    "deliverable.updated",
    "deliverable.status_changed",
    "deliverable.visibility_changed",
    "deliverable.deleted",
    "deliverable.client_approved",
  ],
  Content: [
    "content_item.created",
    "content_item.updated",
    "content_item.status_changed",
    "content_item.visibility_changed",
    "content_item.deleted",
  ],
  Metrics: [
    "metric_definition.created",
    "metric_definition.updated",
    "metric_definition.reactivated",
    "metric_definition.deactivated",
    "metric_definition.reordered",
    "metric_entries.saved",
    "metric_entries.csv_import",
  ],
  Competitors: [
    "competitor.created",
    "competitor.updated",
    "competitor.visibility_changed",
    "competitor.deleted",
  ],
  Calls: [
    "call_type.created",
    "call_type.updated",
    "call_type.deleted",
    "call_recording.created",
    "call_recording.updated",
    "call_recording.visibility_changed",
    "call_recording.deleted",
  ],
  Notes: [
    "meeting_note.created",
    "meeting_note.updated",
    "meeting_note.visibility_changed",
    "meeting_note.deleted",
  ],
  Reports: [
    "report.created",
    "report.updated",
    "report.published",
    "report.unpublished",
    "report.deleted",
  ],
  Projects: [
    "project.created",
    "project.updated",
    "project.status_changed",
    "project.deleted",
  ],
  Tasks: [
    "task.created",
    "task.updated",
    "task.status_changed",
    "task.deleted",
  ],
  Updates: ["update.created", "update.updated", "update.deleted", "update.flags_changed"],
  Files: ["file.uploaded", "file.visibility_changed", "file.deleted"],
  Program: ["program.updated"],
} as const;

export type AuditAction =
  (typeof AUDIT_ACTION_GROUPS)[keyof typeof AUDIT_ACTION_GROUPS][number];

/** Flat list of every action (for non-grouped consumers). */
export const AUDIT_ACTIONS = Object.values(AUDIT_ACTION_GROUPS).flat() as AuditAction[];
