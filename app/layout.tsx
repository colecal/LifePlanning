import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { ThemeProvider } from "./components/ThemeProvider";
import {
  THEME_COOKIE,
  isValidTheme,
  themeInitScript,
  type ThemePreference,
} from "@/lib/theme";
import { createClient } from "@/lib/supabase/server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "mi vida loca",
  description: "Cole + Kaytie's life dashboard",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FCF8EF" },
    { media: "(prefers-color-scheme: dark)", color: "#0C0906" },
  ],
};

async function resolveInitialTheme(): Promise<ThemePreference> {
  const c = await cookies();
  const raw = c.get(THEME_COOKIE)?.value;
  if (isValidTheme(raw)) return raw;

  // No cookie — try to read the signed-in user's saved preference so it
  // follows them across devices on first visit.
  try {
    const supabase = await createClient();
    const { data: claims } = await supabase.auth.getClaims();
    const userId = claims?.claims?.sub;
    if (userId) {
      const { data } = await supabase
        .from("profiles")
        .select("theme_preference")
        .eq("id", userId)
        .single();
      if (isValidTheme(data?.theme_preference)) {
        return data.theme_preference as ThemePreference;
      }
    }
  } catch {
    // Not signed in or query failed — fall through to system default
  }
  return "system";
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initial = await resolveInitialTheme();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
      data-theme-pref={initial}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col text-ink-700">
        <ThemeProvider initialPreference={initial}>{children}</ThemeProvider>
      </body>
    </html>
  );
}
