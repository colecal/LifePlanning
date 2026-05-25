import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPushToProfiles } from "@/lib/push";

export const dynamic = "force-dynamic";

// Sends a test notification to the current user — wired to a button in Settings.
export async function POST() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    await sendPushToProfiles([userId], {
      title: "mi vida loca",
      body: "Test push delivered 🐾",
      url: "/",
      tag: "test",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
