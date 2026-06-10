"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

import { CONTENT_PLATFORMS, CONTENT_STATUSES, labelOf } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

function statusVariant(s: string): "default" | "secondary" | "outline" {
  if (s === "published") return "default";
  if (s === "idea") return "outline";
  return "secondary";
}

export function ClientContent({ items }: { items: ClientContentItem[] }) {
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
      <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
        Your content plan will show up here as we build it.
      </div>
    );
  }

  return (
    <Tabs defaultValue="list">
      <TabsList>
        <TabsTrigger value="list">List</TabsTrigger>
        <TabsTrigger value="month">Month</TabsTrigger>
      </TabsList>

      <TabsContent value="list" className="pt-4">
        <ul className="divide-y rounded-lg border">
          {items.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-2 p-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{i.title}</div>
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
                  <span>{labelOf(CONTENT_PLATFORMS, i.platform)}</span>
                  {i.content_type && <span>· {i.content_type}</span>}
                  {i.publish_date && <span>· {i.publish_date}</span>}
                </div>
              </div>
              <Badge variant={statusVariant(i.status)} className="text-[10px]">
                {labelOf(CONTENT_STATUSES, i.status)}
              </Badge>
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
      </TabsContent>

      <TabsContent value="month" className="space-y-3 pt-4">
        <div className="flex items-center justify-between">
          <div className="font-medium">
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
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border text-xs">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="bg-muted px-1 py-1 text-center font-medium text-muted-foreground">
              {d}
            </div>
          ))}
          {cells.map((day, idx) => {
            const dateStr = day ? `${monthPrefix}-${pad(day)}` : "";
            const dayItems = day ? (byDate.get(dateStr) ?? []) : [];
            return (
              <div key={idx} className="min-h-20 bg-card p-1">
                {day && <div className="mb-1 text-muted-foreground">{day}</div>}
                <div className="space-y-1">
                  {dayItems.map((i) =>
                    i.asset_url && i.status === "published" ? (
                      <a
                        key={i.id}
                        href={i.asset_url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate rounded bg-primary/10 px-1 py-0.5 text-primary hover:bg-primary/20"
                        title={i.title}
                      >
                        {i.title}
                      </a>
                    ) : (
                      <div
                        key={i.id}
                        className="truncate rounded bg-muted px-1 py-0.5"
                        title={i.title}
                      >
                        {i.title}
                      </div>
                    ),
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </TabsContent>
    </Tabs>
  );
}
