"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, FolderKanban, ListChecks, Package, MessageSquare, FileText, Building2 } from "lucide-react";
import { tokens, Input, BaseModal } from "@/components/redesign/ui";
import { globalSearchAction, type SearchResults, type SearchHit } from "@/lib/actions/search";

const GROUPS: { key: keyof Omit<SearchResults, "total">; label: string; icon: React.ReactNode }[] = [
  { key: "clients", label: "Clients", icon: <Building2 size={15} /> },
  { key: "projects", label: "Projects", icon: <FolderKanban size={15} /> },
  { key: "tasks", label: "Tasks", icon: <ListChecks size={15} /> },
  { key: "deliverables", label: "Deliverables", icon: <Package size={15} /> },
  { key: "messages", label: "Messages", icon: <MessageSquare size={15} /> },
  { key: "documents", label: "Documents", icon: <FileText size={15} /> },
];

/**
 * Global search — opens a BaseModal command palette; the input is debounced and calls
 * globalSearchAction (RLS-scoped on the server: results are physically limited to what the
 * caller may see — never cross-client, never an internal-thread message for a client).
 * Results group by entity and deep-link to the item. `tone` styles the trigger for the bar.
 */
export function GlobalSearch({ tone = "light" }: { tone?: "light" | "dark" }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState<SearchResults | null>(null);
  const [loading, setLoading] = React.useState(false);
  const onDark = tone === "dark";

  // debounced, race-safe search
  React.useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) { setResults(null); setLoading(false); return; }
    setLoading(true);
    let active = true;
    const t = setTimeout(async () => {
      const res = await globalSearchAction(term);
      if (active) { setResults(res); setLoading(false); }
    }, 250);
    return () => { active = false; clearTimeout(t); };
  }, [q, open]);

  function go(hit: SearchHit) {
    setOpen(false);
    setQ("");
    setResults(null);
    router.push(hit.href);
  }

  const fg1 = tokens.colorNeutralForeground1, fg3 = tokens.colorNeutralForeground3;

  return (
    <>
      <button
        type="button"
        aria-label="Search"
        onClick={() => setOpen(true)}
        className="rd-focus"
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 36, height: 36, borderRadius: 999, border: "none", cursor: "pointer",
          background: "transparent", color: onDark ? "#b3aca0" : "#6f6c66",
        }}
      >
        <Search size={18} />
      </button>

      <BaseModal isOpen={open} onClose={() => setOpen(false)} title="Search" size="md">
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minHeight: 200 }}>
          <Input
            autoFocus
            value={q}
            onChange={(_, d) => setQ(d.value)}
            placeholder="Search clients, projects, tasks, deliverables, messages, documents…"
            contentBefore={<Search size={16} />}
          />

          {q.trim().length < 2 ? (
            <p style={{ margin: 0, fontSize: 13, color: fg3 }}>Type at least 2 characters to search.</p>
          ) : loading ? (
            <p style={{ margin: 0, fontSize: 13, color: fg3 }}>Searching…</p>
          ) : results && results.total === 0 ? (
            <div style={{ padding: "1.5rem 0", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: fg1 }}>No results for &ldquo;{q.trim()}&rdquo;</p>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: fg3 }}>You only see items you have access to.</p>
            </div>
          ) : results ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {GROUPS.map((g) => {
                const hits = results[g.key];
                if (!hits.length) return null;
                return (
                  <div key={g.key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: fg3 }}>
                      {g.icon} {g.label}
                    </div>
                    {hits.map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => go(h)}
                        className="rd-focus"
                        style={{ display: "flex", flexDirection: "column", gap: 1, alignItems: "flex-start", textAlign: "left", width: "100%", borderRadius: 10, border: "none", cursor: "pointer", background: "transparent", padding: "0.5rem 0.6rem", color: fg1 }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = onDark ? "rgba(255,255,255,0.06)" : "#f4f1ea")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <span style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{h.label}</span>
                        {(h.sub) && <span style={{ fontSize: 12, color: fg3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{h.sub}</span>}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </BaseModal>
    </>
  );
}
