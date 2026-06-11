"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Read-only audit filters — pushes ?client=&action= to the URL (no mutation). */
export function AuditFilters({
  clients,
  actions,
  current,
}: {
  clients: { id: string; name: string }[];
  actions: string[];
  current: { client?: string; action?: string };
}) {
  const router = useRouter();
  const [client, setClient] = useState(current.client ?? "all");
  const [action, setAction] = useState(current.action ?? "all");
  const filtered = Boolean(current.client || current.action);

  function apply() {
    const params = new URLSearchParams();
    if (client !== "all") params.set("client", client);
    if (action !== "all") params.set("action", action);
    const qs = params.toString();
    router.push(`/admin/audit${qs ? `?${qs}` : ""}`);
  }

  return (
    <Card size="sm">
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold tracking-wider text-ink-3 uppercase">
            Client
          </label>
          <Select value={client} onValueChange={setClient}>
            <SelectTrigger size="sm" className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold tracking-wider text-ink-3 uppercase">
            Action
          </label>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger size="sm" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {actions.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={apply}>
          Filter
        </Button>
        {filtered && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setClient("all");
              setAction("all");
              router.push("/admin/audit");
            }}
          >
            Clear
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
