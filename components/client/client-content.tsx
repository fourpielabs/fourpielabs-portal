"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

import { CONTENT_PLATFORMS, labelOf } from "@/lib/constants";
import { StatusChip, STATUS_MAP } from "@/components/ui/status-chip";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/empty-state";

export type ClientContentItem = {
  id: string;
  title: string;
  platform: string;
  content_type: string | null;
  status: string;
  publish_date: string | null;
  asset_url: string | null;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const pad = (n: number) => String(n).padStart(2, "0");

export function ClientContent({ items }: { items: ClientContentItem[] }) {
  const [view, setView] = useState<"list" | "month">("list");
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const monthPrefix = `${cursor.y}-${pad(cursor.m + 1)}`;
  const byDate = useMemo(() => {
    const map = new Map<string, ClientContentItem[]>();
    for (const i of items) {
      if (i.publish_date?.startsWith(monthPrefix)) {
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

  function shift(delta: number) {
    setCursor((c) => {
      const d = new Date(c.y, c.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="No content planned yet"
        description="Your content plan will show up here as we build it."
      />
    );
  }

  return (
    <div className="space-y-4">
      <SegmentedControl
        options={[
          { value: "list", label: "List" },
          { value: "month", label: "Month" },
        ]}
        value={view}
        onValueChange={setView}
      />

      {view === "list" ? (
        <ul className="divide-y divide-row-divider rounded-2xl border border-border">
          {items.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-2 p-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{i.title}</div>
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-ink-3">
                  <span>{labelOf(CONTENT_PLATFORMS, i.platform)}</span>
                  {i.content_type && <span>· {i.content_type}</span>}
                  {i.publish_date && <span>· {formatDate(i.publish_date)}</span>}
                </div>
              </div>
              <StatusChip kind="content" value={i.status} />
              {i.asset_url && i.status === "published" && (
                <Button asChild variant="ghost" size="sm">
                  <a href={i.asset_url} target="_blank" rel="noreferrer">
                    View <ExternalLink className="size-3" />
                  </a>
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold">
              {MONTHS[cursor.m]} {cursor.y}
            </div>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" onClick={() => shift(-1)} aria-label="Previous month">
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => shift(1)} aria-label="Next month">
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border text-xs">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="bg-bg px-1 py-1.5 text-center font-semibold text-ink-3">
                {d}
              </div>
            ))}
            {cells.map((day, idx) => {
              const dateStr = day ? `${monthPrefix}-${pad(day)}` : "";
              const dayItems = day ? (byDate.get(dateStr) ?? []) : [];
              return (
                <div key={idx} className="min-h-20 bg-surface p-1">
                  {day && <div className="mb-1 text-ink-3">{day}</div>}
                  <div className="space-y-1">
                    {dayItems.map((i) => {
                      const r = STATUS_MAP.content[i.status];
                      const style = r ? { background: r.bg, color: r.text } : undefined;
                      const cls =
                        "block truncate rounded-md px-1 py-0.5 text-[10.5px] font-semibold";
                      return i.asset_url && i.status === "published" ? (
                        <a key={i.id} href={i.asset_url} target="_blank" rel="noreferrer" className={cls} style={style} title={i.title}>
                          {i.title}
                        </a>
                      ) : (
                        <div key={i.id} className={cls} style={style} title={i.title}>
                          {i.title}
                        </div>
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
  );
}
