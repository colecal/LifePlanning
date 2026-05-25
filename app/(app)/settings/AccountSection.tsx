"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/app/components/Toast";
import { changePasswordAction, updateProfileAction } from "./actions";

const COLOR_SWATCHES = [
  "#3b82f6", // blue
  "#ec4899", // pink
  "#10b981", // green
  "#f59e0b", // amber
  "#a855f7", // purple
  "#ef4444", // red
  "#06b6d4", // cyan
  "#84cc16", // lime
];

export function AccountSection({
  profile,
  email,
}: {
  profile: {
    display_name: string;
    color: string;
    email_digest_enabled: boolean;
  };
  email: string;
}) {
  const toast = useToast();
  const [name, setName] = useState(profile.display_name);
  const [color, setColor] = useState(profile.color);
  const [digest, setDigest] = useState(profile.email_digest_enabled);
  const [pwOpen, setPwOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const isDirty =
    name !== profile.display_name ||
    color !== profile.color ||
    digest !== profile.email_digest_enabled;

  function save() {
    startTransition(async () => {
      try {
        await updateProfileAction({
          display_name: name,
          color,
          email_digest_enabled: digest,
        });
        toast.success("Profile saved");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <>
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <div
            className="grid h-14 w-14 shrink-0 place-items-center rounded-full text-xl font-semibold text-ink-900 shadow-soft"
            style={{ background: `linear-gradient(135deg, ${color}cc, ${color})` }}
          >
            {(name || email).charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink-900">{name || email}</p>
            <p className="truncate text-xs text-ink-400">{email}</p>
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">
            Display name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field"
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">
            Color
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {COLOR_SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-8 w-8 rounded-full transition ${
                  color === c ? "ring-2 ring-offset-2 ring-offset-cream-50" : ""
                }`}
                style={{
                  backgroundColor: c,
                  boxShadow: color === c ? `0 0 0 2px ${c}` : "none",
                }}
                aria-label={c}
              />
            ))}
            <label className="ml-2 flex items-center gap-1.5 text-xs text-ink-500">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-7 w-10 cursor-pointer rounded-md border border-ink-700/10 bg-transparent"
              />
              Custom
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-ink-700/8 bg-cream-50/40 p-3">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={digest}
              onChange={(e) => setDigest(e.target.checked)}
              className="mt-1 h-4 w-4 accent-amber-500"
            />
            <span className="text-sm text-ink-700">
              Daily digest push at 6am Central
              <span className="block text-xs text-ink-400">
                A morning summary: today&apos;s events, your due tasks, what your partner
                has open. Requires notifications enabled below.
              </span>
            </span>
          </label>
          <button
            type="button"
            onClick={async () => {
              try {
                const r = await fetch("/api/digest/test", { method: "POST" });
                const j = await r.json().catch(() => ({}));
                if (!r.ok) throw new Error(j?.error ?? "Failed");
                if (j.sent === 0) {
                  toast.error("No push sent — enable notifications first.");
                } else {
                  toast.success("Digest sent");
                }
              } catch (err) {
                toast.error(err instanceof Error ? err.message : String(err));
              }
            }}
            className="btn-ghost self-start text-xs"
          >
            Send me one now
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={() => setPwOpen(true)}
            className="btn-ghost"
          >
            Change password
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!isDirty || pending}
            className="btn-primary"
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {pwOpen ? (
        <ChangePasswordModal onClose={() => setPwOpen(false)} />
      ) : null}
    </>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    startTransition(async () => {
      try {
        await changePasswordAction(pw);
        toast.success("Password updated");
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="glass-strong shadow-deep animate-scale-in flex w-full max-w-sm flex-col gap-4 rounded-t-3xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:rounded-3xl sm:pb-6"
      >
        <h2 className="text-lg font-semibold text-ink-900">Change password</h2>

        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">
            New password
          </span>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
            className="input-field"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">
            Confirm
          </span>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
            className="input-field"
          />
        </label>

        {error ? (
          <p className="rounded-lg bg-red-50/80 px-3 py-2 text-xs text-red-700">{error}</p>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending || pw.length < 8}
            className="btn-primary"
          >
            {pending ? "Saving…" : "Update password"}
          </button>
        </div>
      </form>
    </div>
  );
}
