import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ExternalLink } from "lucide-react";

export default async function ClientCallsNotesPage() {
  await requireRole(["client"]);
  const supabase = await createClient();

  const [{ data: callTypes }, { data: recordings }, { data: notes }] =
    await Promise.all([
      supabase
        .from("call_types")
        .select("id, name, duration_label, frequency_label, booking_url")
        .order("sort_order"),
      supabase
        .from("call_recordings")
        .select("id, call_date, call_type, recording_url, key_topic")
        .order("call_date", { ascending: false }),
      supabase
        .from("meeting_notes")
        .select("id, title, meeting_date, body")
        .order("meeting_date", { ascending: false }),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.015em]">Calls &amp; Notes</h1>
        <p className="text-sm text-ink-2">Book time with us and catch up on sessions.</p>
      </div>

      {(callTypes ?? []).length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(callTypes ?? []).map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle className="text-base">{c.name}</CardTitle>
                <CardDescription>
                  {[c.duration_label, c.frequency_label].filter(Boolean).join(" · ") ||
                    "Book a time"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {c.booking_url ? (
                  <Button asChild className="w-full">
                    <a href={c.booking_url} target="_blank" rel="noreferrer">
                      Book
                    </a>
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Reach out to schedule.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recordings</CardTitle>
        </CardHeader>
        <CardContent>
          {(recordings ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Session recordings will appear here.
            </p>
          ) : (
            <ul className="divide-y">
              {(recordings ?? []).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                  <div>
                    <div className="text-sm font-medium">
                      {r.call_type ?? "Call"}
                      {r.call_date && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {formatDate(r.call_date)}
                        </span>
                      )}
                    </div>
                    {r.key_topic && (
                      <div className="text-xs text-muted-foreground">{r.key_topic}</div>
                    )}
                  </div>
                  {r.recording_url && (
                    <Button asChild variant="outline" size="sm">
                      <a href={r.recording_url} target="_blank" rel="noreferrer">
                        Watch <ExternalLink className="size-3" />
                      </a>
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Meeting notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(notes ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Notes from our sessions will show up here.
            </p>
          ) : (
            (notes ?? []).map((n) => (
              <div key={n.id} className="rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{n.title}</span>
                  {n.meeting_date && (
                    <span className="text-xs text-muted-foreground">
                      {formatDate(n.meeting_date)}
                    </span>
                  )}
                </div>
                {n.body && (
                  <div className="pt-2">
                    <Markdown>{n.body}</Markdown>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
