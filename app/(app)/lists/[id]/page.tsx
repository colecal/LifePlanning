import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndHousehold, getHouseholdMembers } from "@/lib/data";
import { ListDetailView } from "./ListDetailView";

type Params = Promise<{ id: string }>;

export default async function ListDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { householdId } = await getCurrentUserAndHousehold();

  const { data: list } = await supabase
    .from("lists")
    .select("id, name, kind, household_id")
    .eq("id", id)
    .single();

  if (!list || list.household_id !== householdId) notFound();

  const { data: items } = await supabase
    .from("list_items")
    .select("id, content, category, checked, assignee_id, created_at")
    .eq("list_id", id)
    .order("created_at", { ascending: true });

  const members = await getHouseholdMembers();

  return (
    <ListDetailView
      list={list}
      initialItems={items ?? []}
      members={members}
    />
  );
}
