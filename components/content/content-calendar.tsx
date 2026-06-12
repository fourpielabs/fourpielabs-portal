"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";

import {
  setContentStatusAction,
  setContentVisibilityAction,
  deleteContentItemAction,
} from "@/lib/actions/content";
import { CONTENT_PLATFORMS, CONTENT_STATUSES, labelOf } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SegmentedControl } from "@/components/ui/segmented";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ContentDialog, type ContentItem } from "./content-dialog";
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

export function ContentCalendar({
  clientId,
  items,
}: {
  clientId: string;
  items: ContentItem[];
}) {
  const router = useRouter();
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          options={[
            { value: "table", label: "Table" },
            { value: "month", label: "Month" },
          ]}
          value={view}
          onValueChange={setView}
        />
        <ContentDialog
          clientId={clientId}
          trigger={
            <Button size="sm">
              <Plus className="size-4" /> New content
            </Button>
          }
        />
      </div>

      {view === "table" && (
        <div className="space-y-3 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={platform || "all"} onValueChange={(v) => setPlatform(v === "all" ? "" : v)}>
            <SelectTrigger size="sm" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All platforms</SelectItem>
              {CONTENT_PLATFORMS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
            <SelectTrigger size="sm" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {CONTENT_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(platform || status) && (
            <Button
              variant="ghost"
              size="sm"
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
          <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
            {items.length === 0
              ? "No content planned yet."
              : "No items match these filters."}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {i.title}
                        {!i.visible_to_client && (
                          <Badge variant="outline" className="text-[10px]">
                            hidden
                          </Badge>
                        )}
                      </div>
                      {i.content_type && (
                        <div className="text-xs text-muted-foreground">
                          {i.content_type}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{labelOf(CONTENT_PLATFORMS, i.platform)}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {i.publish_date ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={i.status}
                        onValueChange={(s) =>
                          run(
                            setContentStatusAction(
                              clientId,
                              i.id,
                              s as ContentItem["status"],
                            ),
                          )
                        }
                      >
                        <SelectTrigger size="sm" className="w-[8.5rem]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CONTENT_STATUSES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={pending}
                          onClick={() =>
                            run(
                              setContentVisibilityAction(
                                clientId,
                                i.id,
                                !i.visible_to_client,
                              ),
                            )
                          }
                          aria-label="Toggle visibility"
                        >
                          {i.visible_to_client ? (
                            <Eye className="size-4" />
                          ) : (
                            <EyeOff className="size-4" />
                          )}
                        </Button>
                        <ContentDialog
                          clientId={clientId}
                          item={i}
                          trigger={
                            <Button variant="ghost" size="icon" aria-label="Edit">
                              <Pencil className="size-4" />
                            </Button>
                          }
                        />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Delete">
                              <Trash2 className="size-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete item?</AlertDialogTitle>
                              <AlertDialogDescription>
                                &ldquo;{i.title}&rdquo; will be removed.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  run(deleteContentItemAction(clientId, i.id))
                                }
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        </div>
      )}

      {view === "month" && (
        <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <div className="font-medium">
            {MONTHS[cursor.m]} {cursor.y}
          </div>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" onClick={() => shiftMonth(-1)} aria-label="Previous month">
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => shiftMonth(1)} aria-label="Next month">
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
              <div
                key={idx}
                className="min-h-20 bg-card p-1 align-top"
              >
                {day && <div className="mb-1 text-muted-foreground">{day}</div>}
                <div className="space-y-1">
                  {dayItems.map((i) => (
                    <ContentDialog
                      key={i.id}
                      clientId={clientId}
                      item={i}
                      trigger={
                        <button
                          type="button"
                          className="block w-full truncate rounded bg-primary/10 px-1 py-0.5 text-left text-primary hover:bg-primary/20"
                          title={i.title}
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
          <p className="text-xs text-muted-foreground">
            {unscheduled} item{unscheduled === 1 ? "" : "s"} with no publish date
            (see the Table view).
          </p>
        )}
        </div>
      )}
    </div>
  );
}
