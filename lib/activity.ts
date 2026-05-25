import { createClient } from "@/lib/supabase/server";

export type ActivityItem = {
  id: string;
  kind: "event" | "task" | "task_done" | "list_item" | "note" | "comment" | "pet_log";
  actor_id: string | null;
  at: string;
  title: string;
  detail?: string;
  href: string;
};

export async function getRecentActivity(householdId: string, limit = 12): Promise<ActivityItem[]> {
  const supabase = await createClient();

  const since = new Date();
  since.setDate(since.getDate() - 14);
  const sinceISO = since.toISOString();

  const [eventsR, tasksR, doneTasksR, notesR, listItemsR, commentsR, petLogsR] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, created_by, created_at")
      .eq("household_id", householdId)
      .gte("created_at", sinceISO)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("tasks")
      .select("id, title, created_by, created_at, status, updated_at")
      .eq("household_id", householdId)
      .gte("created_at", sinceISO)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("tasks")
      .select("id, title, updated_at, status, assignee_id")
      .eq("household_id", householdId)
      .eq("status", "done")
      .gte("updated_at", sinceISO)
      .order("updated_at", { ascending: false })
      .limit(limit),
    supabase
      .from("notes")
      .select("id, title, updated_by, updated_at")
      .eq("household_id", householdId)
      .gte("updated_at", sinceISO)
      .order("updated_at", { ascending: false })
      .limit(limit),
    supabase
      .from("list_items")
      .select("id, content, created_by, created_at, list_id, lists!inner(name, household_id)")
      .eq("lists.household_id", householdId)
      .gte("created_at", sinceISO)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("comments")
      .select("id, body, author_id, created_at, entity_type, entity_id")
      .eq("household_id", householdId)
      .gte("created_at", sinceISO)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("pet_logs")
      .select("id, kind, value, created_by, at, pets!inner(name, household_id)")
      .eq("pets.household_id", householdId)
      .gte("at", sinceISO)
      .order("at", { ascending: false })
      .limit(limit),
  ]);

  const items: ActivityItem[] = [];

  for (const e of eventsR.data ?? []) {
    items.push({
      id: `event-${e.id}`,
      kind: "event",
      actor_id: e.created_by,
      at: e.created_at,
      title: "added event",
      detail: e.title,
      href: "/calendar",
    });
  }
  for (const t of tasksR.data ?? []) {
    items.push({
      id: `task-${t.id}`,
      kind: "task",
      actor_id: t.created_by,
      at: t.created_at,
      title: "added task",
      detail: t.title,
      href: "/tasks",
    });
  }
  for (const t of doneTasksR.data ?? []) {
    items.push({
      id: `taskdone-${t.id}`,
      kind: "task_done",
      actor_id: t.assignee_id,
      at: t.updated_at,
      title: "completed",
      detail: t.title,
      href: "/tasks",
    });
  }
  for (const n of notesR.data ?? []) {
    items.push({
      id: `note-${n.id}`,
      kind: "note",
      actor_id: n.updated_by,
      at: n.updated_at,
      title: "updated note",
      detail: n.title || "Untitled",
      href: "/notes",
    });
  }
  for (const li of listItemsR.data ?? []) {
    const list = Array.isArray(li.lists) ? li.lists[0] : li.lists;
    items.push({
      id: `listitem-${li.id}`,
      kind: "list_item",
      actor_id: li.created_by,
      at: li.created_at,
      title: `added to ${list?.name ?? "list"}`,
      detail: li.content,
      href: `/lists/${li.list_id}`,
    });
  }
  for (const c of commentsR.data ?? []) {
    items.push({
      id: `comment-${c.id}`,
      kind: "comment",
      actor_id: c.author_id,
      at: c.created_at,
      title: `commented on ${c.entity_type}`,
      detail: c.body.slice(0, 80),
      href: c.entity_type === "event" ? "/calendar" : "/tasks",
    });
  }
  for (const log of petLogsR.data ?? []) {
    const pet = Array.isArray(log.pets) ? log.pets[0] : log.pets;
    items.push({
      id: `petlog-${log.id}`,
      kind: "pet_log",
      actor_id: log.created_by,
      at: log.at,
      title: `logged ${log.kind} for ${pet?.name ?? "pet"}`,
      detail: log.value ?? undefined,
      href: "/pets",
    });
  }

  items.sort((a, b) => b.at.localeCompare(a.at));
  return items.slice(0, limit);
}
