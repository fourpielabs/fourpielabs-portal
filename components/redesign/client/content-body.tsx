"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { CONTENT_PLATFORMS, labelOf } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { Eyebrow, Button, Segmented, StatusPill, tokens } from "@/components/redesign/ui";
import { useRedesignMode } from "@/components/redesign/themed-fluent";
import { ClientPageFrame } from "@/components/redesign/client/page-frame";

export type ClientContentItem = {
  id: string; title: string; platform: string; content_type: string | null; status: string; publish_date: string | null; asset_url: string | null;
};

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const pad = (n: number) => String(n).padStart(2, "0");
const dot = (s: string) => (/(publish|done|live)/.test(s) ? "#15803d" : /(review|progress|scheduled)/.test(s) ? "#d97706" : "#9a948b");

export function ContentBody({ items }: { items: ClientContentItem[] }) {
  const { mode } = useRedesignMode();
  const onDark = mode === "dark";
  const fg1 = tokens.colorNeutralForeground1, fg3 = tokens.colorNeutralForeground3;
  const panel = onDark ? "rd-solid--dark" : "rd-solid";
  const divider = onDark ? "#231f19" : "#f1efe8";
  const surface2 = onDark ? "#231f19" : "#f4f4f0";
  const [view, setView] = useState<"list" | "month">("list");
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });

  const monthPrefix = `${cursor.y}-${pad(cursor.m + 1)}`;
  const byDate = useMemo(() => {
    const map = new Map<string, ClientContentItem[]>();
    for (const i of items) if (i.publish_date?.startsWith(monthPrefix)) { const l = map.get(i.publish_date) ?? []; l.push(i); map.set(i.publish_date, l); }
    return map;
  }, [items, monthPrefix]);
  const firstWeekday = new Date(cursor.y, cursor.m, 1).getDay();
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const shift = (delta: number) => setCursor((c) => { const d = new Date(c.y, c.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; });

  return (
    <ClientPageFrame width="standard">
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", paddingBlock: "clamp(0.5rem,2vw,1rem)" }}>
        <div className="rd-rise" style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <Eyebrow tone={onDark ? "onDark" : "amber"}>Content calendar</Eyebrow>
          <h1 className="rd-display" style={{ margin: 0, fontSize: "clamp(1.9rem,5vw,2.6rem)", fontWeight: 600, lineHeight: 1.02, color: fg1 }}>
            What we&apos;re planning &amp; publishing.
          </h1>
        </div>

        {items.length === 0 ? (
          <div className={panel} style={{ borderRadius: 20, padding: "3rem 2rem", textAlign: "center", color: fg3 }}>Your content plan will show up here as we build it.</div>
        ) : (
          <div className={`${panel} rd-rise`} style={{ borderRadius: 20, padding: "1.3rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <Segmented ariaLabel="Calendar view" value={view} onChange={(v) => setView(v as "list" | "month")} options={[{ value: "list", label: "List" }, { value: "month", label: "Month" }]} />

            {view === "list" ? (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {items.map((i, idx) => (
                  <li key={i.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "0.7rem 0", borderTop: idx === 0 ? "none" : `1px solid ${divider}` }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: "0.9rem", fontWeight: 500, color: fg1 }}>{i.title}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2, fontSize: "0.74rem", color: fg3 }}>
                        <span>{labelOf(CONTENT_PLATFORMS, i.platform)}</span>
                        {i.content_type && <span>· {i.content_type}</span>}
                        {i.publish_date && <span>· {formatDate(i.publish_date)}</span>}
                      </div>
                    </div>
                    <StatusPill value={i.status} mode={mode} />
                    {i.asset_url && i.status === "published" && (
                      <Button as="a" href={i.asset_url} target="_blank" rel="noreferrer" appearance="subtle" size="small" icon={<ExternalLink size={13} />} iconPosition="after">View</Button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 600, color: fg1 }}>{MONTHS[cursor.m]} {cursor.y}</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <Button appearance="outline" size="small" icon={<ChevronLeft size={16} />} aria-label="Previous month" onClick={() => shift(-1)} />
                    <Button appearance="outline" size="small" icon={<ChevronRight size={16} />} aria-label="Next month" onClick={() => shift(1)} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 1, overflow: "hidden", borderRadius: 12, background: divider, fontSize: 12 }}>
                  {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
                    <div key={d} style={{ background: surface2, padding: "6px 4px", textAlign: "center", fontWeight: 600, color: fg3 }}>{d}</div>
                  ))}
                  {cells.map((day, idx) => {
                    const dateStr = day ? `${monthPrefix}-${pad(day)}` : "";
                    const dayItems = day ? byDate.get(dateStr) ?? [] : [];
                    return (
                      <div key={idx} style={{ minHeight: 80, background: onDark ? "#1c1813" : "#ffffff", padding: 4 }}>
                        {day && <div style={{ marginBottom: 4, color: fg3 }}>{day}</div>}
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          {dayItems.map((i) => {
                            const chip: React.CSSProperties = { display: "flex", alignItems: "center", gap: 4, borderRadius: 6, padding: "1px 5px", fontSize: 10.5, fontWeight: 600, background: surface2, color: fg1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none" };
                            const inner = (<><span style={{ width: 5, height: 5, borderRadius: 999, flexShrink: 0, background: dot(i.status) }} /><span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{i.title}</span></>);
                            return i.asset_url && i.status === "published" ? (
                              <a key={i.id} href={i.asset_url} target="_blank" rel="noreferrer" title={i.title} style={chip}>{inner}</a>
                            ) : (
                              <div key={i.id} title={i.title} style={chip}>{inner}</div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ClientPageFrame>
  );
}
