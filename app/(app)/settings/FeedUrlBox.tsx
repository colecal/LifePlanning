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
        label="webcal://"
        value={webcalUrl}
        href={webcalUrl}
        copied={copied === "webcal"}
        onCopy={() => copy(webcalUrl, "webcal")}
      />
      <Row
        label="https://"
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
    <div className="flex items-center gap-2 rounded-md border border-zinc-300 bg-zinc-50 p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900">
      <span className="w-16 shrink-0 font-medium text-zinc-500">{label}</span>
      <a
        href={href}
        className="flex-1 truncate font-mono text-zinc-700 hover:underline dark:text-zinc-300"
      >
        {value}
      </a>
      <button
        type="button"
        onClick={onCopy}
        className="shrink-0 rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
