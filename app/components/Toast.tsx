"use client";

import { createContext, useCallback, useContext, useState } from "react";

type Toast = {
  id: string;
  message: string;
  variant: "default" | "success" | "error";
};

type ToastContextValue = {
  toast: (message: string, variant?: Toast["variant"]) => void;
  success: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, variant: Toast["variant"] = "default") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const value: ToastContextValue = {
    toast,
    success: useCallback((m: string) => toast(m, "success"), [toast]),
    error: useCallback((m: string) => toast(m, "error"), [toast]),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto animate-scale-in glass-strong shadow-lift flex max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-sm ${
              t.variant === "success"
                ? "border-amber-300/40"
                : t.variant === "error"
                  ? "border-red-300/40 text-red-700"
                  : "text-ink-800"
            }`}
          >
            {t.variant === "success" ? (
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber-gradient text-ink-900">
                <svg viewBox="0 0 12 12" className="h-3 w-3">
                  <path d="M2 6.5l2.5 2.5L10 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              </span>
            ) : t.variant === "error" ? (
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-red-100 text-red-700">!</span>
            ) : null}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
