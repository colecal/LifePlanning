"use client";

import { useEffect } from "react";

// Registers the service worker on every app load (not just when the user
// opts into push notifications) so its /_next/static/ cache-first handler
// is active for everyone, speeding up repeat launches on iOS.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return null;
}
