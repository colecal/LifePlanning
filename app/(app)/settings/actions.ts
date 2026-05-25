"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndHousehold } from "@/lib/data";
import type { TablesUpdate } from "@/lib/database.types";

export async function updateProfileAction(input: {
  display_name?: string;
  color?: string;
  email_digest_enabled?: boolean;
}) {
  const supabase = await createClient();
  const { userId } = await getCurrentUserAndHousehold();

  const patch: TablesUpdate<"profiles"> = {};
  if (input.display_name !== undefined) patch.display_name = input.display_name.trim();
  if (input.color !== undefined) patch.color = input.color;
  if (input.email_digest_enabled !== undefined)
    patch.email_digest_enabled = input.email_digest_enabled;

  if (Object.keys(patch).length === 0) return;

  const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
  if (error) throw new Error(error.message);

  revalidatePath("/", "layout");
}

export async function changePasswordAction(newPassword: string) {
  if (newPassword.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}
