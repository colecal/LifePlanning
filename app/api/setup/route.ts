import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const SEED_USERS = [
  { email: "coleaydancalderon@gmail.com", display_name: "Cole" },
  { email: "lee.kaytie@yahoo.com",         display_name: "Kaytie" },
];

function generatePassword(length = 18): string {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

// One-shot user provisioning. Only runs if no profiles exist yet.
// After both accounts are created, this endpoint becomes a 410 Gone.
async function runSetup() {
  const admin = createAdminClient();

  const { count, error: countError } = await admin
    .from("profiles")
    .select("*", { count: "exact", head: true });

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: "Setup already complete. Endpoint locked." },
      { status: 410 },
    );
  }

  const results: { email: string; password: string }[] = [];
  for (const user of SEED_USERS) {
    const password = generatePassword();
    const { error } = await admin.auth.admin.createUser({
      email: user.email,
      password,
      email_confirm: true,
      user_metadata: { display_name: user.display_name },
    });
    if (error) {
      return NextResponse.json(
        { error: `Failed to create ${user.email}: ${error.message}`, partial: results },
        { status: 500 },
      );
    }
    results.push({ email: user.email, password });
  }

  return NextResponse.json({
    ok: true,
    message: "Both users created. Save these passwords now — they will not be shown again.",
    users: results,
  });
}

// Single-shot. Safe to call once: locks itself after the first successful run.
export const GET = runSetup;
export const POST = runSetup;
