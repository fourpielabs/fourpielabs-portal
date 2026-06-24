"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/guards";

export type SearchHit = { id: string; label: string; sub?: string | null; href: string };
export type SearchResults = {
  clients: SearchHit[];
  projects: SearchHit[];
  tasks: SearchHit[];
  deliverables: SearchHit[];
  messages: SearchHit[];
  documents: SearchHit[];
  total: number;
};

const PER = 6;
const EMPTY: SearchResults = { clients: [], projects: [], tasks: [], deliverables: [], messages: [], documents: [], total: 0 };
// escape LIKE wildcards so a user-typed % / _ is literal (the method form sends the
// pattern as a value, so there's no filter-string injection surface — only wildcards).
const escapeLike = (s: string) => s.replace(/[%_\\]/g, (m) => "\\" + m);
const snip = (s: string | null | undefined, n = 70) => { const t = (s ?? "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n) + "…" : t; };
function dedupe<T extends { id: string }>(rows: T[]): T[] { const seen = new Set<string>(); return rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true))); }

/**
 * RLS-SCOPED global search. Runs AS THE CALLER through the user-scoped Supabase client
 * (createClient) — every query is a plain RLS-protected SELECT, so the database filters
 * each entity to exactly what this caller may already see. NO SECURITY DEFINER, NO view:
 *  - a CLIENT gets only their own client's projects/tasks/deliverables/messages/docs, and
 *    only client_shared messages (the messages RLS excludes INTERNAL threads → search can
 *    never surface an internal message to a client),
 *  - a TEAM member gets only assigned clients (is_assigned), incl. internal they may see,
 *  - an ADMIN gets all.
 * Each searched table enforces its OWN RLS independently (no trust in the search layer).
 */
export async function globalSearchAction(qRaw: string): Promise<SearchResults> {
  const me = await requireProfile();
  const q = (qRaw ?? "").trim();
  if (q.length < 2) return EMPTY;

  const supabase = await createClient(); // ← user-scoped: RLS inherited
  const like = `%${escapeLike(q)}%`;
  const isClient = me.role === "client";
  // role-aware deep-link base: clients see their own top-level routes; staff use the workspace.
  const link = (cid: string | null, clientPath: string, staffPath: string) =>
    isClient ? clientPath : `/clients/${cid ?? ""}${staffPath}`;

  const [cl, pT, pD, tT, tD, dT, dD, msg, fl] = await Promise.all([
    supabase.from("clients").select("id, name").ilike("name", like).limit(PER),
    supabase.from("projects").select("id, client_id, title, description").ilike("title", like).limit(PER),
    supabase.from("projects").select("id, client_id, title, description").ilike("description", like).limit(PER),
    supabase.from("tasks").select("id, client_id, title, description").ilike("title", like).limit(PER),
    supabase.from("tasks").select("id, client_id, title, description").ilike("description", like).limit(PER),
    supabase.from("deliverables").select("id, client_id, title, description").ilike("title", like).limit(PER),
    supabase.from("deliverables").select("id, client_id, title, description").ilike("description", like).limit(PER),
    supabase.from("messages").select("id, client_id, body, thread_type").ilike("body", like).is("deleted_at", null).limit(PER),
    supabase.from("files").select("id, client_id, name").ilike("name", like).limit(PER),
  ]);

  const clients: SearchHit[] = (cl.data ?? []).map((c) => ({ id: c.id, label: c.name, href: isClient ? "/dashboard" : `/clients/${c.id}` }));
  const projects: SearchHit[] = dedupe([...(pT.data ?? []), ...(pD.data ?? [])]).slice(0, PER).map((p) => ({ id: p.id, label: p.title, sub: snip(p.description), href: link(p.client_id, "/dashboard", "/projects") }));
  const tasks: SearchHit[] = dedupe([...(tT.data ?? []), ...(tD.data ?? [])]).slice(0, PER).map((t) => ({ id: t.id, label: t.title, sub: snip(t.description), href: link(t.client_id, `/tasks?task=${t.id}`, `/tasks?task=${t.id}`) }));
  const deliverables: SearchHit[] = dedupe([...(dT.data ?? []), ...(dD.data ?? [])]).slice(0, PER).map((d) => ({ id: d.id, label: d.title, sub: snip(d.description), href: link(d.client_id, "/deliverables", "/deliverables") }));
  const messages: SearchHit[] = (msg.data ?? []).map((m) => ({ id: m.id, label: snip(m.body), sub: isClient ? null : (m.thread_type === "internal" ? "Internal" : "Client"), href: link(m.client_id, "/messages", m.thread_type === "internal" ? "/messages?tab=internal" : "/messages") }));
  const documents: SearchHit[] = (fl.data ?? []).map((f) => ({ id: f.id, label: f.name, href: link(f.client_id, "/documents", "/files") }));

  const total = clients.length + projects.length + tasks.length + deliverables.length + messages.length + documents.length;
  return { clients, projects, tasks, deliverables, messages, documents, total };
}

export type LinkableEntity = { type: "project" | "task" | "deliverable"; id: string; title: string };

/**
 * RLS-SCOPED suggestions for the chat "#" deep-link picker, constrained to ONE client (the
 * thread's client). Runs AS THE CALLER through the user-scoped client (no SECURITY DEFINER, no
 * view) — each entity table's own RLS does the filtering, so a CLIENT sees only their own
 * client's projects/tasks/deliverables AND only client-visible tasks/deliverables (the
 * visible_to_client gate); a TEAM member only assigned clients; admin all. The .eq(client_id)
 * scopes to the thread's client and is itself RLS-bounded (a foreign clientId yields zero rows).
 * A client therefore can never be offered another client's — or a staff-only — item to link.
 */
export async function searchLinkablesAction(clientId: string, qRaw: string): Promise<LinkableEntity[]> {
  await requireProfile();
  if (!clientId) return [];
  const q = (qRaw ?? "").trim();
  const supabase = await createClient(); // ← user-scoped: RLS inherited
  const like = q.length >= 1 ? `%${escapeLike(q)}%` : "%";
  const [p, t, d] = await Promise.all([
    supabase.from("projects").select("id, title").eq("client_id", clientId).ilike("title", like).order("created_at", { ascending: false }).limit(6),
    supabase.from("tasks").select("id, title").eq("client_id", clientId).ilike("title", like).order("created_at", { ascending: false }).limit(6),
    supabase.from("deliverables").select("id, title").eq("client_id", clientId).ilike("title", like).order("created_at", { ascending: false }).limit(6),
  ]);
  const out: LinkableEntity[] = [];
  for (const r of p.data ?? []) out.push({ type: "project", id: r.id as string, title: r.title as string });
  for (const r of t.data ?? []) out.push({ type: "task", id: r.id as string, title: r.title as string });
  for (const r of d.data ?? []) out.push({ type: "deliverable", id: r.id as string, title: r.title as string });
  return out;
}
