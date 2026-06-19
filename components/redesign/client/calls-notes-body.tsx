"use client";

import * as React from "react";
import { CalendarClock, ExternalLink, FileText, Video } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { formatDate } from "@/lib/format";
import { Eyebrow, Button, EmberButton, tokens } from "@/components/redesign/ui";
import { useRedesignMode } from "@/components/redesign/themed-fluent";
import { ClientPageFrame } from "@/components/redesign/client/page-frame";
import { BookButton } from "@/components/booking/book-button";
import { BookingTime } from "@/components/booking/booking-time";

export type CallsData = {
  callTypes: { id: string; name: string; durationLabel: string | null; frequencyLabel: string | null; bookingUrl: string | null }[];
  upcoming: { id: string; title: string | null; start_at: string | null; meeting_url: string | null }[];
  recordings: { id: string; call_date: string | null; call_type: string | null; recording_url: string | null; key_topic: string | null }[];
  notes: { id: string; title: string; meeting_date: string | null; body: string | null }[];
  user: { name: string | null; email: string | null; clientId: string };
};

/** R2 Calls & Notes — re-skinned; the cal.com booking popup (BookButton, with name/
 *  email/clientId/callTypeId metadata) is reused verbatim. */
export function CallsNotesBody({ data }: { data: CallsData }) {
  const { mode } = useRedesignMode();
  const onDark = mode === "dark";
  const fg1 = tokens.colorNeutralForeground1, fg2 = tokens.colorNeutralForeground2, fg3 = tokens.colorNeutralForeground3;
  const panel = onDark ? "rd-solid--dark" : "rd-solid";
  const divider = onDark ? "#231f19" : "#f1efe8";
  const card: React.CSSProperties = { borderRadius: 20, padding: "1.3rem" };
  const title = (t: string) => <h2 className="rd-display" style={{ margin: "0 0 0.85rem", fontSize: "1.1rem", fontWeight: 600, color: fg1 }}>{t}</h2>;
  const emptyRow = (icon: React.ReactNode, t: string, d: string) => (
    <div style={{ textAlign: "center", padding: "1.5rem 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <span style={{ display: "grid", placeItems: "center", width: 40, height: 40, borderRadius: 12, background: onDark ? "rgba(245,158,11,0.14)" : "#fef3c7", color: "#b45309" }}>{icon}</span>
      <div style={{ fontSize: "0.95rem", fontWeight: 600, color: fg1 }}>{t}</div>
      <p style={{ margin: 0, fontSize: "0.82rem", color: fg3 }}>{d}</p>
    </div>
  );

  return (
    <ClientPageFrame width="standard">
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", paddingBlock: "clamp(0.5rem,2vw,1rem)" }}>
        <div className="rd-rise" style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <Eyebrow tone={onDark ? "onDark" : "amber"}>Calls &amp; Notes</Eyebrow>
          <h1 className="rd-display" style={{ margin: 0, fontSize: "clamp(1.9rem,5vw,2.6rem)", fontWeight: 600, lineHeight: 1.02, color: fg1 }}>
            Book time &amp; catch up on sessions.
          </h1>
        </div>

        {data.callTypes.length > 0 && (
          <div className="rd-calltypes rd-rise">
            {data.callTypes.map((c) => (
              <div key={c.id} className={panel} style={{ ...card, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div>
                  <div style={{ fontSize: "1rem", fontWeight: 600, color: fg1 }}>{c.name}</div>
                  <div style={{ fontSize: "0.8rem", color: fg3 }}>{[c.durationLabel, c.frequencyLabel].filter(Boolean).join(" · ") || "Book a time"}</div>
                </div>
                {c.bookingUrl ? (
                  <BookButton bookingUrl={c.bookingUrl} name={data.user.name} email={data.user.email} clientId={data.user.clientId} callTypeId={c.id} />
                ) : (
                  <p style={{ margin: 0, fontSize: "0.85rem", color: fg3 }}>Reach out to schedule.</p>
                )}
              </div>
            ))}
          </div>
        )}

        <div className={`${panel} rd-rise`} style={card}>
          {title("Upcoming calls")}
          {data.upcoming.length === 0 ? emptyRow(<CalendarClock size={18} />, "No upcoming calls", "Book one above and it'll appear here.") : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {data.upcoming.map((b, i) => (
                <li key={b.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "0.7rem 0", borderTop: i === 0 ? "none" : `1px solid ${divider}` }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "0.9rem", fontWeight: 500, color: fg1 }}>{b.title ?? "Call"}</div>
                    {b.start_at && <div style={{ marginTop: 2, display: "flex", alignItems: "center", gap: 6, fontSize: "0.76rem", color: fg3 }}><CalendarClock size={13} /> <BookingTime iso={b.start_at} /></div>}
                  </div>
                  {b.meeting_url && <EmberButton as="a" href={b.meeting_url} target="_blank" rel="noreferrer" size="small" icon={<Video size={14} />} iconPosition="after">Join</EmberButton>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={`${panel} rd-rise`} style={card}>
          {title("Recordings")}
          {data.recordings.length === 0 ? emptyRow(<Video size={18} />, "No recordings yet", "Session recordings will appear here.") : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {data.recordings.map((r, i) => (
                <li key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "0.6rem 0", borderTop: i === 0 ? "none" : `1px solid ${divider}` }}>
                  <div>
                    <div style={{ fontSize: "0.88rem", fontWeight: 500, color: fg1 }}>{r.call_type ?? "Call"}{r.call_date && <span style={{ marginLeft: 8, fontSize: "0.74rem", color: fg3 }}>{formatDate(r.call_date)}</span>}</div>
                    {r.key_topic && <div style={{ fontSize: "0.74rem", color: fg3 }}>{r.key_topic}</div>}
                  </div>
                  {r.recording_url && <Button as="a" href={r.recording_url} target="_blank" rel="noreferrer" appearance="outline" size="small" icon={<ExternalLink size={14} />} iconPosition="after">Watch</Button>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={`${panel} rd-rise`} style={card}>
          {title("Meeting notes")}
          {data.notes.length === 0 ? emptyRow(<FileText size={18} />, "No notes yet", "Notes from our sessions will show up here.") : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {data.notes.map((n) => (
                <div key={n.id} style={{ borderRadius: 12, border: `1px solid ${divider}`, padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: "0.9rem", fontWeight: 600, color: fg1 }}>{n.title}</span>
                    {n.meeting_date && <span style={{ fontSize: "0.74rem", color: fg3 }}>{formatDate(n.meeting_date)}</span>}
                  </div>
                  {n.body && <div className="rd-prose" style={{ paddingTop: 6, fontSize: "0.88rem", color: fg2 }}><Markdown>{n.body}</Markdown></div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <style>{`.rd-calltypes{display:grid;gap:1rem;grid-template-columns:1fr;} @media(min-width:640px){.rd-calltypes{grid-template-columns:1fr 1fr;}} @media(min-width:1000px){.rd-calltypes{grid-template-columns:1fr 1fr 1fr;}}`}</style>
    </ClientPageFrame>
  );
}
