import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

let configured = false;
function configure() {
  if (configured) return;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:coleaydancalderon@gmail.com";
  if (!pub || !priv) {
    throw new Error("VAPID keys not configured");
  }
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
}

export type PushPayload = {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
};

/**
 * Sends a push notification to every subscription for the given profiles.
 * Silently drops 404/410 subscriptions (revoked on the device).
 * No-op if VAPID keys aren't set (e.g. local dev).
 */
export async function sendPushToProfiles(
  profileIds: string[],
  payload: PushPayload,
): Promise<void> {
  if (profileIds.length === 0) return;
  if (!process.env.VAPID_PRIVATE_KEY) {
    console.warn("VAPID_PRIVATE_KEY missing — push skipped");
    return;
  }
  configure();

  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, profile_id")
    .in("profile_id", profileIds);

  if (!subs || subs.length === 0) return;

  const json = JSON.stringify(payload);
  const expired: string[] = [];

  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          json,
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          expired.push(s.id);
        } else {
          console.error("push send failed:", err);
        }
      }
    }),
  );

  if (expired.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", expired);
  }
}
