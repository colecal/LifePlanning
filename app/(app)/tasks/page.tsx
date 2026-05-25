import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndHousehold, getHouseholdMembers } from "@/lib/data";
import { TasksView } from "./TasksView";

export default async function TasksPage() {
  const supabase = await createClient();
  const { userId, householdId } = await getCurrentUserAndHousehold();

  const [members, tasksR] = await Promise.all([
    getHouseholdMembers(),
    supabase
      .from("tasks")
      .select("id, title, notes, due_at, assignee_id, status, rrule, created_at")
      .eq("household_id", householdId)
      .order("due_at", { ascending: true, nullsFirst: false }),
  ]);

  return (
    <TasksView
      initialTasks={tasksR.data ?? []}
      members={members}
      currentUserId={userId}
    />
  );
}
