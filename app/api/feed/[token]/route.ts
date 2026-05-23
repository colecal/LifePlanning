import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Params = Promise<{ token: string }>;

export async function GET(_req: Request, { params }: { params: Params }) {
  const { token } = await params;
  if (!token || token.length < 16) {
    return new NextResponse("Not found", { status: 404 });
  }

  const admin = createAdminClient();

  // Look up the feed token (bypassing RLS via service role)
  const { data: feedRow, error: feedError } = await admin
    .from("feed_tokens")
    .select("profile_id")
    .eq("token", token)
    .single();
  if (feedError || !feedRow) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { data: membership, error: memberError } = await admin
    .from("household_members")
    .select("household_id")
    .eq("profile_id", feedRow.profile_id)
    .limit(1)
    .single();
  if (memberError || !membership) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { data: events } = await admin
    .from("events")
    .select(
      "id, title, description, location, starts_at, ends_at, all_day, rrule, updated_at",
    )
    .eq("household_id", membership.household_id)
    .order("starts_at", { ascending: true });

  const ics = buildIcs(events ?? []);

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "public, max-age=900, s-maxage=900",
      "X-Published-TTL": "PT15M",
    },
  });
}

type IcsEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  rrule: string | null;
  updated_at: string;
};

function buildIcs(events: IcsEvent[]): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//mi-vida-loca//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:mi vida loca",
    "X-PUBLISHED-TTL:PT15M",
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
  ];

  for (const ev of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${ev.id}@mividaloca`);
    lines.push(`DTSTAMP:${formatUTC(new Date(ev.updated_at))}`);
    if (ev.all_day) {
      lines.push(`DTSTART;VALUE=DATE:${formatDate(new Date(ev.starts_at))}`);
      lines.push(`DTEND;VALUE=DATE:${formatDate(new Date(ev.ends_at))}`);
    } else {
      lines.push(`DTSTART:${formatUTC(new Date(ev.starts_at))}`);
      lines.push(`DTEND:${formatUTC(new Date(ev.ends_at))}`);
    }
    lines.push(`SUMMARY:${escapeText(ev.title)}`);
    if (ev.location) lines.push(`LOCATION:${escapeText(ev.location)}`);
    if (ev.description) lines.push(`DESCRIPTION:${escapeText(ev.description)}`);
    if (ev.rrule) lines.push(`RRULE:${ev.rrule}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

function formatUTC(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function formatDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate())
  );
}

function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

// RFC 5545: lines > 75 octets must be folded with CRLF + single space.
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let i = 0;
  while (i < line.length) {
    chunks.push(line.slice(i, i + (i === 0 ? 75 : 74)));
    i += i === 0 ? 75 : 74;
  }
  return chunks.join("\r\n ");
}
