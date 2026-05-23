"use client";

import { useTheme } from "@/app/components/ThemeProvider";
import type { ThemePreference } from "@/lib/theme";

const OPTIONS: { value: ThemePreference; label: string; icon: React.ReactNode }[] = [
  {
    value: "light",
    label: "Light",
    icon: (
      <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
        <circle cx="8" cy="8" r="3.2" fill="currentColor" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <line
            key={deg}
            x1="8"
            y1="1.5"
            x2="8"
            y2="3.4"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            transform={`rotate(${deg} 8 8)`}
          />
        ))}
      </svg>
    ),
  },
  {
    value: "system",
    label: "System",
    icon: (
      <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
        <rect
          x="1.5"
          y="2.5"
          width="13"
          height="9"
          rx="1.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <line x1="5" y1="13.5" x2="11" y2="13.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: "dark",
    label: "Dark",
    icon: (
      <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
        <path
          d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5z"
          fill="currentColor"
        />
      </svg>
    ),
  },
];

export function ThemeToggle() {
  const { preference, resolved, setPreference } = useTheme();

  return (
    <div className="flex flex-col gap-2">
      <div className="card inline-flex w-fit p-1">
        {OPTIONS.map((opt) => {
          const active = preference === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPreference(opt.value)}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
                active
                  ? "bg-amber-gradient text-ink-900 shadow-soft"
                  : "text-ink-500 hover:text-ink-900"
              }`}
              aria-pressed={active}
            >
              <span className={active ? "text-ink-900" : "text-ink-400"}>
                {opt.icon}
              </span>
              {opt.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-ink-400">
        {preference === "system"
          ? `Following your device — currently ${resolved}.`
          : `Always ${preference}.`}
      </p>
    </div>
  );
}
