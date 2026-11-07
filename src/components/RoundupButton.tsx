"use client";

import { useState } from "react";

export function RoundupButton({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-line bg-card px-2.5 py-1 text-sm font-semibold hover:border-ink/40"
      >
        Round-up
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-label="WhatsApp round-up"
            className="w-full max-w-md rounded-t-2xl bg-card p-5 shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Round-up for the group</h2>
              <button onClick={() => setOpen(false)} className="rounded-lg px-2 py-1 text-muted hover:bg-paper" aria-label="Close">
                ✕
              </button>
            </div>
            <pre className="max-h-[50vh] overflow-auto rounded-lg bg-paper p-3 text-left font-sans text-sm whitespace-pre-wrap">{text}</pre>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={copy} className="rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:border-ink/40">
                {copied ? "Copied" : "Copy text"}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(text)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-pitch px-3 py-2 text-center text-sm font-semibold text-paper"
              >
                Open WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
