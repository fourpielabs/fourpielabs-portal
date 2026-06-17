import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { BookButton } from "@/components/booking/book-button";
import { BookingTime } from "@/components/booking/booking-time";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CalendarClock, ExternalLink, FileText, Video } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";

export default async function ClientCallsNotesPage() {
  const me = await requireRole(["client"]);
  const supabase = await createClient();

  const [{ data: callTypes }, { data: upcoming }, { data: recordings }, { data: notes }] =
    await Promise.all([
      supabase
        .from("call_types")
        .select("id, name, duration_label, frequency_label, booking_url")
        .order("sort_order"),
      // Upcoming = booked + still in the future. RLS already scopes to the client's
      // OWN visible bookings; cancelled/rescheduled/past are excluded here.
      supabase
        .from("call_bookings")
        .select("id, title, start_at, meeting_url")
        .eq("status", "booked")
        .gte("start_at", new Date().toISOString())
        .order("start_at", { ascending: true }),
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
    <PageContainer width="standard" stack>
      <PageHeader
        title="Calls & Notes"
        description="Book time with us and catch up on sessions."
      />

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
                  <BookButton
                    bookingUrl={c.booking_url}
                    name={me.full_name}
                    email={me.email}
                    clientId={me.client_id ?? ""}
                    callTypeId={c.id}
                  />
                ) : (
                  <p className="text-sm text-ink-3">Reach out to schedule.</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Upcoming calls</CardTitle>
        </CardHeader>
        <CardContent>
          {(upcoming ?? []).length === 0 ? (
            <EmptyState
              icon={<CalendarClock />}
              title="No upcoming calls"
              description="Book one above and it'll appear here."
            />
          ) : (
            <ul className="divide-y">
              {(upcoming ?? []).map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {b.title ?? "Call"}
                    </div>
                    {b.start_at && (
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-3">
                        <CalendarClock className="size-3.5 shrink-0" />
                        <BookingTime iso={b.start_at} />
                      </div>
                    )}
                  </div>
                  {b.meeting_url && (
                    <Button asChild variant="amber" size="sm">
                      <a href={b.meeting_url} target="_blank" rel="noreferrer">
                        Join <Video className="size-3.5" />
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
          <CardTitle>Recordings</CardTitle>
        </CardHeader>
        <CardContent>
          {(recordings ?? []).length === 0 ? (
            <EmptyState
              icon={<Video />}
              title="No recordings yet"
              description="Session recordings will appear here."
            />
          ) : (
            <ul className="divide-y">
              {(recordings ?? []).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                  <div>
                    <div className="text-sm font-medium">
                      {r.call_type ?? "Call"}
                      {r.call_date && (
                        <span className="ml-2 text-xs text-ink-3">
                          {formatDate(r.call_date)}
                        </span>
                      )}
                    </div>
                    {r.key_topic && (
                      <div className="text-xs text-ink-3">{r.key_topic}</div>
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
            <EmptyState
              icon={<FileText />}
              title="No notes yet"
              description="Notes from our sessions will show up here."
            />
          ) : (
            (notes ?? []).map((n) => (
              <div key={n.id} className="rounded-xl border border-border bg-surface p-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{n.title}</span>
                  {n.meeting_date && (
                    <span className="text-xs text-ink-3">
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
    </PageContainer>
  );
}
