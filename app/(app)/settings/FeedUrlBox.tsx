"use client";

import { useState } from "react";

export function FeedUrlBox({
  webcalUrl,
  httpsUrl,
}: {
  webcalUrl: string;
  httpsUrl: string;
}) {
  const [copied, setCopied] = useState<"webcal" | "https" | null>(null);

  async function copy(value: string, which: "webcal" | "https") {
    await navigator.clipboard.writeText(value);
    setCopied(which);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="flex flex-col gap-2">
      <Row
        label="webcal"
        value={webcalUrl}
        href={webcalUrl}
        copied={copied === "webcal"}
        onCopy={() => copy(webcalUrl, "webcal")}
      />
      <Row
        label="https"
        value={httpsUrl}
        href={httpsUrl}
        copied={copied === "https"}
        onCopy={() => copy(httpsUrl, "https")}
      />
    </div>
  );
}

function Row({
  label,
  value,
  href,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  href: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-ink-700/8 bg-cream-50/60 p-2.5 backdrop-blur">
      <span className="shrink-0 rounded-full bg-ink-900 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-cream-50">
        {label}
      </span>
      <a
        href={href}
        className="min-w-0 flex-1 truncate font-mono text-xs text-ink-700 hover:text-amber-700"
      >
        {value}
      </a>
      <button
        type="button"
        onClick={onCopy}
        className={`shrink-0 rounded-lg px-3 py-1 text-xs font-medium transition ${
          copied
            ? "bg-amber-gradient text-ink-900"
            : "border border-ink-700/10 bg-cream-50/40 text-ink-600 hover:bg-cream-50/80"
        }`}
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
