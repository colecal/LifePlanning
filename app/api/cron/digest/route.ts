import { NextResponse } from "next/server";
import { runDigest } from "@/lib/digest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily digest cron — schedule in vercel.json (12:00 UTC = 6am CST / 7am CDT).
 * Vercel Cron auth: header `Authorization: Bearer ${CRON_SECRET}`.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not set" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sent = await runDigest();
  return NextResponse.json({ ok: true, sent });
}
