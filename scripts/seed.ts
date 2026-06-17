/**
 * P1 seed script (spec §6 P1).
 *
 * Creates: 1 admin, 1 team, 2 demo clients (one pipeline / SEO, one pulse /
 * social), 1 client user — plus realistic demo data across every table.
 *
 * Idempotent: users are matched by email; clients by slug; per-client demo
 * child rows are cleared and re-inserted. Checklist / milestones / metric
 * definitions are created by the on-insert DB trigger and left intact.
 *
 * Run: npm run seed   (reads .env.local; uses the SERVICE ROLE key — bypasses RLS)
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
}

const db: SupabaseClient = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_PASSWORD = "FourPie!Demo2026";

async function upsertUser(
  email: string,
  full_name: string,
  meta: Record<string, unknown>,
): Promise<string> {
  const { data: list, error: listErr } = await db.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) throw listErr;
  const user_metadata = { full_name, ...meta };
  const existing = list.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );
  if (existing) {
    await db.auth.admin.updateUserById(existing.id, {
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata,
    });
    return existing.id;
  }
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata,
  });
  if (error) throw error;
  return data.user!.id;
}

async function upsertClient(row: Record<string, unknown>): Promise<string> {
  const { data, error } = await db
    .from("clients")
    .upsert(row, { onConflict: "slug" })
    .select("id")
    .single();
  if (error) throw error;
  return data!.id as string;
}

const CHILD_TABLES = [
  "deliverables",
  "content_items",
  "metric_entries",
  "competitors",
  "call_types",
  "call_recordings",
  "meeting_notes",
  "reports",
  "updates",
  "files",
];

async function clearChildData(clientId: string) {
  for (const t of CHILD_TABLES) {
    const { error } = await db.from(t).delete().eq("client_id", clientId);
    if (error) throw new Error(`clear ${t}: ${error.message}`);
  }
}

async function metricDefMap(clientId: string) {
  const { data, error } = await db
    .from("metric_definitions")
    .select("id, key, unit")
    .eq("client_id", clientId);
  if (error) throw error;
  const map = new Map<string, { id: string; unit: string }>();
  for (const d of data ?? []) map.set(d.key, { id: d.id, unit: d.unit });
  return map;
}

const PERIODS = ["2026-04-01", "2026-05-01", "2026-06-01"];

async function main() {
  console.log("Seeding 4Pie Labs portal (remote)…");

  // 1) Clients first — the on-insert trigger seeds checklist/milestones/metrics.
  const pipelineId = await upsertClient({
    name: "Premier Painting Co.",
    slug: "premier-painting",
    industry: "painting_contractor",
    program: "pipeline",
    status: "active",
    website_url: "https://premierpainting.example.com",
    start_date: "2026-03-01",
    service_type: "Done For You",
    investment: "$3,500/mo — monthly retainer",
    comms_channel: "WhatsApp group",
    best_way_to_reach: "WhatsApp group or email",
    response_time: "Within 24 hours, weekdays",
    revision_policy: "2 rounds per deliverable",
    whats_included:
      "- Local SEO + GBP optimization\n- AEO content engine\n- Paid ads management\n- Monthly reporting",
    whats_not_included:
      "- Website rebuilds\n- Print collateral\n- PR / media buying",
    internal_notes: "INTERNAL: upsell to operating_system in Q4. Do not show client.",
  });

  const pulseId = await upsertClient({
    name: "Coastal Tours Co.",
    slug: "coastal-tours",
    industry: "tour_operator",
    program: "pulse",
    status: "active",
    website_url: "https://coastaltours.example.com",
    start_date: "2026-04-01",
    service_type: "Done With You",
    investment: "$2,200/mo — monthly retainer",
    comms_channel: "Slack Connect",
    best_way_to_reach: "Slack Connect channel",
    response_time: "Within 1 business day",
    revision_policy: "2 rounds per deliverable",
    whats_included:
      "- Short-form social content\n- Hook/angle testing\n- Profile growth\n- Monthly reporting",
    whats_not_included: "- Paid influencer fees\n- Video production travel",
    internal_notes: "INTERNAL: founder prefers Friday calls. Do not show client.",
  });

  // 2) Users (admin + team have no client_id; client belongs to the pipeline client).
  const adminId = await upsertUser("demo-admin@example.com", "Avery Admin", {
    role: "admin",
  });
  const teamId = await upsertUser("demo-team@example.com", "Riley Partner", {
    role: "team",
  });
  const clientUserId = await upsertUser(
    "demo-client@example.com",
    "Pat Premier",
    { role: "client", client_id: pipelineId },
  );

  // 3) "Your Partner" + 4) assignments
  await db
    .from("clients")
    .update({ primary_contact_user_id: teamId })
    .in("id", [pipelineId, pulseId]);

  await db
    .from("client_assignments")
    .upsert(
      [
        { client_id: pipelineId, user_id: teamId, assigned_by: adminId },
        { client_id: pulseId, user_id: teamId, assigned_by: adminId },
      ],
      { onConflict: "client_id,user_id" },
    );

  // 5) Per-client demo data
  for (const clientId of [pipelineId, pulseId]) {
    await clearChildData(clientId);

    // mark the first few onboarding (client) items done
    const { data: items } = await db
      .from("checklist_items")
      .select("id, sort_order, assignee")
      .eq("client_id", clientId)
      .eq("kind", "onboarding")
      .order("sort_order");
    for (const it of items ?? []) {
      if (it.sort_order <= 5) {
        await db
          .from("checklist_items")
          .update({
            is_done: true,
            done_by: it.assignee === "client" ? clientUserId : teamId,
            done_at: "2026-05-15T10:00:00Z",
          })
          .eq("id", it.id);
      }
    }

    // mark the first milestone done, second in progress
    const { data: ms } = await db
      .from("milestones")
      .select("id, sort_order")
      .eq("client_id", clientId)
      .order("sort_order");
    if (ms?.[0]) await db.from("milestones").update({ status: "done" }).eq("id", ms[0].id);
    if (ms?.[1]) await db.from("milestones").update({ status: "in_progress" }).eq("id", ms[1].id);

    // deliverables
    await db.from("deliverables").insert([
      {
        client_id: clientId,
        title: "Brand strategy doc",
        description: "Positioning, ICP, and messaging pillars.",
        type: "strategy_doc",
        status: "delivered",
        due_date: "2026-04-10",
        preview_url: "https://docs.example.com/strategy",
        visible_to_client: true,
        delivered_at: "2026-04-09T12:00:00Z",
        created_by: teamId,
      },
      {
        client_id: clientId,
        title: "April content calendar",
        description: "12 pieces across channels.",
        type: "content_calendar",
        status: "needs_review",
        due_date: "2026-04-25",
        visible_to_client: true,
        created_by: teamId,
      },
      {
        client_id: clientId,
        title: "Landing page refresh",
        description: "New hero + lead form.",
        type: "landing_page",
        status: "in_progress",
        due_date: "2026-06-20",
        visible_to_client: false,
        created_by: teamId,
      },
    ]);

    // content_items
    await db.from("content_items").insert([
      {
        client_id: clientId,
        title: "How to choose a local pro (and avoid 3 mistakes)",
        platform: clientId === pulseId ? "instagram" : "blog",
        content_type: clientId === pulseId ? "Reel" : "Blog post",
        status: "published",
        publish_date: "2026-05-05",
        cta: "Book a free quote",
        core_message: "Trust + proof beats price.",
        views_after_posting: 4200,
        visible_to_client: true,
        created_by: teamId,
      },
      {
        client_id: clientId,
        title: "Behind the scenes: a day on the job",
        platform: clientId === pulseId ? "tiktok" : "gbp",
        content_type: clientId === pulseId ? "Reel" : "GBP post",
        status: "scheduled",
        publish_date: "2026-06-18",
        visible_to_client: true,
        created_by: teamId,
      },
    ]);

    // metric_entries for numeric defs across 3 months + one text metric
    const defs = await metricDefMap(clientId);
    const entries: Record<string, unknown>[] = [];
    let base = 100;
    for (const [key, def] of defs) {
      if (def.unit === "text") {
        entries.push({
          client_id: clientId,
          definition_id: def.id,
          period: PERIODS[PERIODS.length - 1],
          value_text:
            key === "key_learning"
              ? "Short-form + proof content drove the most qualified leads."
              : "Strong month — momentum building.",
          created_by: teamId,
        });
      } else {
        PERIODS.forEach((period, i) => {
          const val =
            def.unit === "currency"
              ? 1500 + i * 250
              : Math.round(base * (1 + i * 0.2));
          entries.push({
            client_id: clientId,
            definition_id: def.id,
            period,
            value_numeric: val,
            created_by: teamId,
          });
        });
      }
      base += 37;
    }
    if (entries.length) {
      const { error } = await db.from("metric_entries").insert(entries);
      if (error) throw new Error(`metric_entries: ${error.message}`);
    }

    // competitors
    await db.from("competitors").insert([
      {
        client_id: clientId,
        name_or_handle: "@bigrival",
        niche: "Same local market",
        follower_count: 18400,
        avg_views: 9000,
        top_content_format: "Before/after reels",
        hook_style: "Bold transformation claim",
        whats_working: "Consistent posting + proof",
        gap_notes: "Not answering common buyer questions",
        adapted_idea: "FAQ-style reels addressing objections",
        priority: "high",
        visible_to_client: true,
      },
    ]);

    // call_types. booking_url convention (see lib/cal.ts): a scheme-less
    // `username/event-slug` is a Cal.com calLink → opens the in-portal popup; a
    // full http(s) URL is legacy (Calendly) → falls back to an external link.
    await db.from("call_types").insert([
      {
        client_id: clientId,
        name: "Monthly Review Call",
        duration_label: "45 min",
        frequency_label: "Monthly",
        booking_url: "four-pie-labs/client-call", // Cal.com calLink → popup
        sort_order: 1,
      },
      {
        client_id: clientId,
        name: "Quick Question",
        duration_label: "15 min",
        frequency_label: "As needed",
        booking_url: "https://calendly.com/4pielabs/quick-question", // legacy URL → external link
        sort_order: 2,
      },
    ]);

    // call_recordings
    await db.from("call_recordings").insert([
      {
        client_id: clientId,
        call_date: "2026-05-12",
        call_type: "Monthly Review Call",
        recording_url: "https://video.example.com/rec/may",
        key_topic: "April results + May plan",
        visible_to_client: true,
        created_by: teamId,
      },
    ]);

    // meeting_notes
    await db.from("meeting_notes").insert([
      {
        client_id: clientId,
        meeting_date: "2026-05-12",
        title: "May Strategy Call",
        body: "**Decisions:** double down on proof content.\n**Actions:** ship 8 reels, refresh GBP.\n**Next steps:** review CPL in June.",
        visible_to_client: true,
        author_id: teamId,
      },
    ]);

    // reports — one published, one draft
    await db.from("reports").insert([
      {
        client_id: clientId,
        title: "April 2026 Performance",
        period_start: "2026-04-01",
        period_end: "2026-04-30",
        summary:
          "Leads up month over month; content engine live. CPL trending down.",
        published: true,
        published_at: "2026-05-03T09:00:00Z",
        created_by: teamId,
      },
      {
        client_id: clientId,
        title: "May 2026 Performance",
        period_start: "2026-05-01",
        period_end: "2026-05-31",
        summary: "Draft — finalizing numbers.",
        published: false,
        created_by: teamId,
      },
    ]);

    // updates — one pinned + one normal
    await db.from("updates").insert([
      {
        client_id: clientId,
        author_id: teamId,
        title: "Welcome to your portal 👋",
        body: "Everything we ship lives here. Tick off your onboarding steps to get started.",
        pinned: true,
        visible_to_client: true,
      },
      {
        client_id: clientId,
        author_id: teamId,
        title: "April report is live",
        body: "Your April performance report is published under Performance.",
        pinned: false,
        visible_to_client: true,
      },
    ]);

    // files — metadata row (no storage object uploaded in seed)
    await db.from("files").insert([
      {
        client_id: clientId,
        name: "Service Agreement.pdf",
        category: "agreement",
        storage_path: `${clientId}/seed-service-agreement.pdf`,
        mime_type: "application/pdf",
        size_bytes: 184320,
        visible_to_client: true,
        uploaded_by: teamId,
      },
    ]);
  }

  console.log("\n✅ Seed complete.");
  console.log("Demo accounts (password for all):", DEMO_PASSWORD);
  console.log("  admin :  demo-admin@example.com");
  console.log("  team  :  demo-team@example.com   (assigned to both clients)");
  console.log("  client:  demo-client@example.com (Premier Painting Co.)");
  console.log("Clients: Premier Painting Co. (pipeline), Coastal Tours Co. (pulse)");
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
