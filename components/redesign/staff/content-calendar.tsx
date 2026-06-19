"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Calendar, ChevronLeft, ChevronRight, Eye, EyeOff, Pencil, Plus } from "lucide-react";

import {
  setContentStatusAction,
  setContentVisibilityAction,
  deleteContentItemAction,
} from "@/lib/actions/content";
import { CONTENT_PLATFORMS, CONTENT_STATUSES, labelOf } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { Button, Select, Segmented } from "@/components/redesign/ui";
import { ContentDialog, type ContentItem } from "./content-dialog";
import { usePanel, EmptyPanel, ConfirmDelete, IconButton } from "./ui";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const pad = (n: number) => String(n).padStart(2, "0");

/** R3 staff content calendar (re-skinned, SOLID rows + month grid). All wiring verbatim. */
export function ContentCalendar({
  clientId,
  items,
}: {
  clientId: string;
  items: ContentItem[];
}) {
  const router = useRouter();
  const { panel, fg1, fg2, fg3, onDark, border } = usePanel();
  const [pending, setPending] = useState(false);
  const [platform, setPlatform] = useState("");
  const [status, setStatus] = useState("");
  const [view, setView] = useState<"table" | "month">("table");
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  async function run(p: Promise<{ ok: boolean; error?: string }>) {
    setPending(true);
    const res = await p;
    setPending(false);
    if (!res.ok) return toast.error("Action failed", { description: res.error });
    router.refresh();
  }

  const filtered = useMemo(
    () =>
      items.filter(
        (i) =>
          (!platform || i.platform === platform) &&
          (!status || i.status === status),
      ),
    [items, platform, status],
  );

  // month grid
  const monthPrefix = `${cursor.y}-${pad(cursor.m + 1)}`;
  const byDate = useMemo(() => {
    const map = new Map<string, ContentItem[]>();
    for (const i of items) {
      if (i.publish_date && i.publish_date.startsWith(monthPrefix)) {
        const list = map.get(i.publish_date) ?? [];
        list.push(i);
        map.set(i.publish_date, list);
      }
    }
    return map;
  }, [items, monthPrefix]);

  const firstWeekday = new Date(cursor.y, cursor.m, 1).getDay();
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const d = new Date(c.y, c.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  const unscheduled = items.filter((i) => !i.publish_date).length;

  const pillBase: React.CSSProperties = { fontSize: 10, fontWeight: 700, padding: "0.15rem 0.45rem", borderRadius: 999, whiteSpace: "nowrap" };

  const addBtn = (
    <ContentDialog
      clientId={clientId}
      trigger={<Button appearance="primary" icon={<Plus size={16} />}>New content</Button>}
    />
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
        <Segmented
          ariaLabel="View"
          options={[
            { value: "table", label: "Table" },
            { value: "month", label: "Month" },
          ]}
          value={view}
          onChange={(v) => setView(v as "table" | "month")}
        />
        {addBtn}
      </div>

      {view === "table" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <Select
              aria-label="Filter by platform"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              style={{ minWidth: "11rem" }}
            >
              <option value="">All platforms</option>
              {CONTENT_PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </Select>
            <Select
              aria-label="Filter by status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={{ minWidth: "11rem" }}
            >
              <option value="">All statuses</option>
              {CONTENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
            {(platform || status) && (
              <Button
                appearance="subtle"
                size="small"
                onClick={() => {
                  setPlatform("");
                  setStatus("");
                }}
              >
                Clear
              </Button>
            )}
          </div>

          {filtered.length === 0 ? (
            <EmptyPanel
              icon={<Calendar size={22} />}
              title={items.length === 0 ? "No content planned yet" : "No matches"}
              description={
                items.length === 0
                  ? "Plan and track content across channels here."
                  : "No items match these filters."
              }
              action={items.length === 0 ? addBtn : undefined}
            />
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.7rem" }}>
              {filtered.map((i) => (
                <li key={i.id} className={panel} style={{ borderRadius: 18, padding: "1rem 1.1rem", display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: fg1 }}>{i.title}</span>
                      <span style={{ ...pillBase, background: onDark ? "rgba(255,255,255,0.08)" : "#f1efe8", color: fg3 }}>{labelOf(CONTENT_PLATFORMS, i.platform)}</span>
                      {!i.visible_to_client && <span style={{ ...pillBase, background: "transparent", color: fg3, border: `1px solid ${border}` }}>hidden</span>}
                      <span style={{ fontSize: 12, color: fg3 }}>{i.publish_date ? formatDate(i.publish_date) : "No date"}</span>
                    </div>
                    {i.content_type && <p style={{ margin: "0.35rem 0 0", fontSize: "0.85rem", color: fg2 }}>{i.content_type}</p>}
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                    <Select
                      value={i.status}
                      onChange={(e) => run(setContentStatusAction(clientId, i.id, e.target.value as ContentItem["status"]))}
                      aria-label={`Status for ${i.title}`}
                      style={{ minWidth: "8.5rem" }}
                    >
                      {CONTENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </Select>
                    <IconButton label="Toggle visibility" disabled={pending} onClick={() => run(setContentVisibilityAction(clientId, i.id, !i.visible_to_client))}>
                      {i.visible_to_client ? <Eye size={16} /> : <EyeOff size={16} />}
                    </IconButton>
                    <ContentDialog
                      clientId={clientId}
                      item={i}
                      trigger={<button type="button" aria-label="Edit" className="rd-focus" style={{ flexShrink: 0, borderRadius: 8, border: "none", background: "none", cursor: "pointer", color: fg3, padding: 6, display: "inline-flex" }}><Pencil size={16} /></button>}
                    />
                    <ConfirmDelete title="Delete item?" description={`“${i.title}” will be removed.`} onConfirm={() => run(deleteContentItemAction(clientId, i.id))} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {view === "month" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontWeight: 600, color: fg1 }}>
              {MONTHS[cursor.m]} {cursor.y}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <Button appearance="outline" icon={<ChevronLeft size={16} />} onClick={() => shiftMonth(-1)} aria-label="Previous month" />
              <Button appearance="outline" icon={<ChevronRight size={16} />} onClick={() => shiftMonth(1)} aria-label="Next month" />
            </div>
          </div>
          <div
            className={panel}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 1,
              overflow: "hidden",
              borderRadius: 16,
              background: border,
              fontSize: "0.72rem",
            }}
          >
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} style={{ background: onDark ? "rgba(255,255,255,0.04)" : "#f7f5f0", padding: "0.3rem 0.25rem", textAlign: "center", fontWeight: 600, color: fg3 }}>
                {d}
              </div>
            ))}
            {cells.map((day, idx) => {
              const dateStr = day ? `${monthPrefix}-${pad(day)}` : "";
              const dayItems = day ? (byDate.get(dateStr) ?? []) : [];
              return (
                <div
                  key={idx}
                  style={{ minHeight: 80, background: onDark ? "#1b1815" : "#ffffff", padding: "0.3rem", verticalAlign: "top" }}
                >
                  {day && <div style={{ marginBottom: 4, color: fg3, fontVariantNumeric: "tabular-nums" }}>{day}</div>}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {dayItems.map((i) => (
                      <ContentDialog
                        key={i.id}
                        clientId={clientId}
                        item={i}
                        trigger={
                          <button
                            type="button"
                            className="rd-focus"
                            title={i.title}
                            style={{
                              display: "block",
                              width: "100%",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              textAlign: "left",
                              border: "none",
                              cursor: "pointer",
                              borderRadius: 6,
                              padding: "0.1rem 0.3rem",
                              fontSize: "0.72rem",
                              background: onDark ? "rgba(245,158,11,0.16)" : "#fef3c7",
                              color: onDark ? "#fcd34d" : "#92400e",
                            }}
                          >
                            {i.title}
                          </button>
                        }
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {unscheduled > 0 && (
            <p style={{ margin: 0, fontSize: "0.78rem", color: fg3 }}>
              {unscheduled} item{unscheduled === 1 ? "" : "s"} with no publish date (see the Table view).
            </p>
          )}
        </div>
      )}
    </div>
  );
}
