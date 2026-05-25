import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runDigest } from "@/lib/digest";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * "Send me one now" button in Settings hits this. Session-authenticated;
 * builds the digest for the current user only (ignores their preference toggle
 * so they can test even when opted out).
 */
export async function POST() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  try {
    const sent = await runDigest({ onlyProfileId: userId });
    return NextResponse.json({ ok: true, sent });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
