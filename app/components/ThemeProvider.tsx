"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  THEME_COOKIE,
  isValidTheme,
  type ThemePreference,
} from "@/lib/theme";

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: "light" | "dark";
  setPreference: (pref: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readCookiePref(): ThemePreference {
  if (typeof document === "undefined") return "system";
  const match = document.cookie.match(/(?:^|; )mvl-theme=([^;]+)/);
  const raw = match ? decodeURIComponent(match[1]) : "system";
  return isValidTheme(raw) ? raw : "system";
}

function resolve(pref: ThemePreference): "light" | "dark" {
  if (pref === "system") {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return pref;
}

export function ThemeProvider({
  initialPreference,
  children,
}: {
  initialPreference: ThemePreference;
  children: React.ReactNode;
}) {
  const [preference, setPreferenceState] = useState<ThemePreference>(initialPreference);
  const [resolved, setResolved] = useState<"light" | "dark">(() =>
    resolve(initialPreference),
  );

  // Hydrate from cookie. If no cookie yet (first visit on this device,
  // initial came from DB), write one so subsequent SSR sees it.
  useEffect(() => {
    const hasCookie = /(?:^|; )mvl-theme=/.test(document.cookie);
    if (!hasCookie) {
      const oneYear = 60 * 60 * 24 * 365;
      document.cookie = `${THEME_COOKIE}=${encodeURIComponent(preference)}; path=/; max-age=${oneYear}; samesite=lax`;
      setResolved(resolve(preference));
      return;
    }
    const fromCookie = readCookiePref();
    if (fromCookie !== preference) setPreferenceState(fromCookie);
    setResolved(resolve(fromCookie));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to OS color-scheme changes when in "system" mode
  useEffect(() => {
    if (preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolved(mq.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference]);

  // Apply data-theme attribute whenever resolved changes
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolved);
    document.documentElement.setAttribute("data-theme-pref", preference);
  }, [resolved, preference]);

  const setPreference = useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
    setResolved(resolve(pref));
    // 1 year, sameSite=Lax so SSR sees it on subsequent navigations
    const oneYear = 60 * 60 * 24 * 365;
    document.cookie = `${THEME_COOKIE}=${encodeURIComponent(pref)}; path=/; max-age=${oneYear}; samesite=lax`;
    // Persist to DB in the background (non-blocking)
    void fetch("/api/theme", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preference: pref }),
    }).catch(() => {});
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
