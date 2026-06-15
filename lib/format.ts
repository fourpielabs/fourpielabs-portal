export function formatMetricValue(
  unit: string,
  numeric: number | null,
  text: string | null,
): string {
  if (unit === "text") return text ?? "—";
  if (numeric === null) return "—";
  if (unit === "currency") return `$${numeric.toLocaleString()}`;
  if (unit === "percent") return `${numeric}%`;
  return numeric.toLocaleString();
}

export function initials(name: string | null, email: string | null): string {
  const src = (name ?? email ?? "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

// ---- dates (parse "YYYY-MM-DD" without timezone surprises) -------------------

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function parts(date: string | null | undefined): [number, number, number] | null {
  if (!date) return null;
  const m = date.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** "2026-03-01" -> "March 2026" */
export function formatMonthYear(date: string | null | undefined): string {
  const p = parts(date);
  return p ? `${MONTHS[p[1] - 1]} ${p[0]}` : "—";
}

/** "2026-04-01" -> "Apr 2026" (axis / column labels) */
export function formatMonthShort(date: string): string {
  const p = parts(date);
  return p ? `${MONTHS_SHORT[p[1] - 1]} ${p[0]}` : date;
}

/** "2026-04-12" -> "Apr 12, 2026" (specific-day fields) */
export function formatDate(date: string | null | undefined): string {
  const p = parts(date);
  return p ? `${MONTHS_SHORT[p[1] - 1]} ${p[2]}, ${p[0]}` : "—";
}

/** Full timestamp -> "Apr 12, 2026, 3:45 PM" (audit log). Real Date — has a time. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Full timestamp -> "Just now" / "5m ago" / "3h ago" / "Yesterday" / "Apr 12, 2026". */
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "Yesterday";
  if (day < 7) return `${day}d ago`;
  return formatDate(iso.slice(0, 10));
}

/** Report period -> "April 1–30, 2026" / "Apr 1, 2026 – May 3, 2026" / single / null */
export function formatReportPeriod(
  start: string | null,
  end: string | null,
): string | null {
  const s = parts(start);
  const e = parts(end);
  if (s && e) {
    if (s[0] === e[0] && s[1] === e[1]) {
      return `${MONTHS[s[1] - 1]} ${s[2]}–${e[2]}, ${s[0]}`;
    }
    return `${formatDate(start)} – ${formatDate(end)}`;
  }
  if (s) return formatDate(start);
  if (e) return formatDate(end);
  return null;
}

/** Contiguous first-of-month periods from min..max inclusive ("YYYY-MM-01"). */
export function monthsBetween(minPeriod: string, maxPeriod: string): string[] {
  const a = parts(minPeriod);
  const b = parts(maxPeriod);
  if (!a || !b) return [];
  const out: string[] = [];
  let y = a[0];
  let m = a[1];
  const pad = (n: number) => String(n).padStart(2, "0");
  while (y < b[0] || (y === b[0] && m <= b[1])) {
    out.push(`${y}-${pad(m)}-01`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}
