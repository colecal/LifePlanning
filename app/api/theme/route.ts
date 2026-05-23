import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isValidTheme } from "@/lib/theme";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const pref = body?.preference;
  if (!isValidTheme(pref)) {
    return NextResponse.json({ error: "Invalid preference" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ theme_preference: pref })
    .eq("id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
