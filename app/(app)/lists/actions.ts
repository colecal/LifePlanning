"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndHousehold } from "@/lib/data";
import type { TablesUpdate } from "@/lib/database.types";

export async function createListAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "todo");
  if (!name) return;

  const supabase = await createClient();
  const { householdId } = await getCurrentUserAndHousehold();

  const { data, error } = await supabase
    .from("lists")
    .insert({ name, kind, household_id: householdId })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/lists");
  redirect(`/lists/${data.id}`);
}

export async function deleteListAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("lists").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/lists");
  redirect("/lists");
}

export async function addItemAction(input: {
  list_id: string;
  content: string;
  category?: string | null;
  assignee_id?: string | null;
}) {
  const supabase = await createClient();
  const { userId } = await getCurrentUserAndHousehold();
  const { error } = await supabase.from("list_items").insert({
    list_id: input.list_id,
    content: input.content,
    category: input.category || null,
    assignee_id: input.assignee_id || null,
    created_by: userId,
  });
  if (error) throw new Error(error.message);
}

export async function updateItemAction(input: {
  id: string;
  checked?: boolean;
  content?: string;
  category?: string | null;
  assignee_id?: string | null;
}) {
  const supabase = await createClient();
  const patch: TablesUpdate<"list_items"> = {};
  if (input.checked !== undefined) patch.checked = input.checked;
  if (input.content !== undefined) patch.content = input.content;
  if (input.category !== undefined) patch.category = input.category;
  if (input.assignee_id !== undefined) patch.assignee_id = input.assignee_id;

  const { error } = await supabase.from("list_items").update(patch).eq("id", input.id);
  if (error) throw new Error(error.message);
}

export async function deleteItemAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("list_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function clearCheckedAction(listId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("list_items")
    .delete()
    .eq("list_id", listId)
    .eq("checked", true);
  if (error) throw new Error(error.message);
}
