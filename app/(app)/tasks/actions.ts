"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndHousehold } from "@/lib/data";
import type { TablesUpdate } from "@/lib/database.types";

export async function createTaskAction(input: {
  title: string;
  due_at?: string | null;
  assignee_id?: string | null;
  notes?: string | null;
}) {
  const supabase = await createClient();
  const { userId, householdId } = await getCurrentUserAndHousehold();
  const { error } = await supabase.from("tasks").insert({
    household_id: householdId,
    title: input.title.trim(),
    due_at: input.due_at || null,
    assignee_id: input.assignee_id || null,
    notes: input.notes?.trim() || null,
    created_by: userId,
  });
  if (error) throw new Error(error.message);
}

export async function updateTaskAction(input: {
  id: string;
  title?: string;
  due_at?: string | null;
  assignee_id?: string | null;
  status?: "open" | "done";
  notes?: string | null;
}) {
  const supabase = await createClient();
  const patch: TablesUpdate<"tasks"> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.due_at !== undefined) patch.due_at = input.due_at;
  if (input.assignee_id !== undefined) patch.assignee_id = input.assignee_id;
  if (input.status !== undefined) patch.status = input.status;
  if (input.notes !== undefined) patch.notes = input.notes;

  const { error } = await supabase.from("tasks").update(patch).eq("id", input.id);
  if (error) throw new Error(error.message);
}

export async function deleteTaskAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
