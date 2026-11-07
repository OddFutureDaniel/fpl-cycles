"use client";

import { useEffect, useState } from "react";

// "This is me" is per device: stored in localStorage, no accounts.
const KEY = "fpl-me";
const EVENT = "fpl-me-change";

export function readMe(): number | null {
  try {
    const v = Number(localStorage.getItem(KEY));
    return v > 0 ? v : null;
  } catch {
    return null;
  }
}

function writeMe(entry: number | null) {
  try {
    if (entry) localStorage.setItem(KEY, String(entry));
    else localStorage.removeItem(KEY);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

/** Current "me" entry; null until mounted or if unset. */
export function useMe() {
  const [me, setMe] = useState<number | null>(null);
  useEffect(() => {
    const sync = () => setMe(readMe());
    sync();
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  return me;
}

/**
 * Header picker. Highlighting works by writing one CSS rule that targets
 * rows carrying data-entry="<me>", so server-rendered tables need no client code.
 */
export function MeSelect({ managers }: { managers: { entry: number; name: string }[] }) {
  const me = useMe();
  const css = me
    ? `tr[data-entry="${me}"] > td { background: color-mix(in oklab, var(--color-pitch) 9%, transparent); }
       tr[data-entry="${me}"] > td:first-child { box-shadow: inset 3px 0 var(--color-pitch); }`
    : "";

  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      <style>{css}</style>
      <span>I’m</span>
      <select
        value={me ?? ""}
        onChange={(e) => writeMe(Number(e.target.value) || null)}
        className="rounded-lg border border-line bg-card px-2 py-1 text-sm font-semibold text-ink"
      >
        <option value="">pick yourself…</option>
        {managers.map((m) => (
          <option key={m.entry} value={m.entry}>
            {m.name}
          </option>
        ))}
      </select>
    </label>
  );
}
