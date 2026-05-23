import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndHousehold, getHouseholdMembers } from "@/lib/data";
import { TasksView } from "./TasksView";

export default async function TasksPage() {
  const supabase = await createClient();
  const { householdId } = await getCurrentUserAndHousehold();

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, notes, due_at, assignee_id, status, created_at")
    .eq("household_id", householdId)
    .order("due_at", { ascending: true, nullsFirst: false });

  const members = await getHouseholdMembers();
  const { userId } = await getCurrentUserAndHousehold();

  return (
    <TasksView
      initialTasks={tasks ?? []}
      members={members}
      currentUserId={userId}
    />
  );
}
