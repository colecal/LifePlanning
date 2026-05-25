"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/app/components/Toast";

function urlBase64ToUint8Array(b64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buf = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushNotifications({ vapidPublicKey }: { vapidPublicKey: string }) {
  const toast = useToast();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    const ok = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
    setSupported(ok);
    if (!ok) return;
    setPermission(Notification.permission);
    (async () => {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      setSubscribed(!!sub);
    })();
  }, []);

  async function subscribe() {
    if (!vapidPublicKey) {
      toast.error("Push isn't configured on the server yet.");
      return;
    }
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        toast.error("Permission denied.");
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error(await res.text());

      setSubscribed(true);
      toast.success("Notifications on");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast.success("Notifications off");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? "Failed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (supported === null) return null;

  if (!supported) {
    return (
      <p className="text-sm text-ink-500">
        Your browser doesn't support push notifications. On iPhone,{" "}
        <strong className="text-ink-800">Add to Home Screen</strong> first, then open the
        installed app and revisit this page.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-600">
        Get notified when {/* */}a task is assigned to you, someone comments on your event,
        or you have an event starting soon.
      </p>

      {permission === "denied" ? (
        <p className="rounded-lg bg-red-50/80 px-3 py-2 text-xs text-red-700">
          You blocked notifications in your browser. Re-enable from your browser/OS
          settings, then revisit this page.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {subscribed ? (
          <>
            <button
              type="button"
              onClick={sendTest}
              disabled={busy}
              className="btn-ghost"
            >
              Send test
            </button>
            <button
              type="button"
              onClick={unsubscribe}
              disabled={busy}
              className="btn-ghost"
            >
              Turn off on this device
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={subscribe}
            disabled={busy || permission === "denied"}
            className="btn-primary"
          >
            {busy ? "…" : "Enable on this device"}
          </button>
        )}
      </div>

      <p className="text-xs text-ink-400">
        On iPhone: open this site in Safari → Share → Add to Home Screen, then enable
        notifications from the installed app.
      </p>
    </div>
  );
}
