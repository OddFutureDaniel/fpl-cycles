"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Item = { id: string; text: string; votes: number; createdAt: number };
const MAX = 140;
const sortItems = (list: Item[]) => [...list].sort((a, b) => b.votes - a.votes || a.createdAt - b.createdAt);

export function ForfeitBoard(props: {
  cycle: number;
  endGw: number;
  open: boolean;
  initial: Item[];
  /** Who finished (or is currently) bottom of the cycle */
  loser: string | null;
}) {
  const { cycle, endGw, open, loser } = props;
  const [items, setItems] = useState(() => sortItems(props.initial));
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Quick taps are counted locally and sent as one request per suggestion
  const pending = useRef(new Map<string, number>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const refresh = useCallback(async () => {
    if (pending.current.size) return; // don't overwrite taps still in flight
    const res = await fetch(`/api/forfeits/${cycle}`, { cache: "no-store" });
    if (res.ok) setItems(sortItems((await res.json()).items));
  }, [cycle]);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => document.visibilityState === "visible" && refresh(), 30_000);
    return () => clearInterval(id);
  }, [open, refresh]);

  const flush = async (id: string) => {
    const by = pending.current.get(id) ?? 0;
    pending.current.delete(id);
    timers.current.delete(id);
    if (!by) return;
    const res = await fetch(`/api/forfeits/${cycle}/${id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ by }),
    });
    if (res.ok) {
      const { votes } = await res.json();
      // Re-sort only once the server confirms, so the list doesn't jump under your thumb mid-tapping
      setItems((list) => sortItems(list.map((i) => (i.id === id ? { ...i, votes } : i))));
    } else {
      setError((await res.json().catch(() => ({}))).error ?? "Vote didn’t save");
      refresh();
    }
  };

  const vote = (id: string) => {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, votes: i.votes + 1 } : i)));
    pending.current.set(id, (pending.current.get(id) ?? 0) + 1);
    clearTimeout(timers.current.get(id));
    timers.current.set(id, setTimeout(() => flush(id), (pending.current.get(id) ?? 0) >= 50 ? 0 : 600));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/forfeits/${cycle}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    setBusy(false);
    if (res.ok) {
      const item = await res.json();
      setItems((list) => sortItems([...list, item]));
      setText("");
    } else {
      setError((await res.json().catch(() => ({}))).error ?? "Couldn’t add that");
    }
  };

  const winner = !open ? items[0] : null;

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-lg font-bold">Forfeit vote</h3>
        <p className="text-sm text-muted">
          {open
            ? `Suggest as many as you like and upvote as often as you like. Whatever's top when GW${endGw} is final is the forfeit for whoever finishes bottom.`
            : "Voting closed when the cycle finished."}
        </p>
      </div>

      {winner && (
        <div className="rounded-xl border border-live/30 bg-live-soft px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-live">Forfeit{loser ? ` for ${loser}` : ""}</div>
          <div className="text-lg font-bold">{winner.text}</div>
          <div className="text-sm text-muted">{winner.votes} votes</div>
        </div>
      )}
      {open && loser && (
        <p className="text-sm">
          Currently bottom: <span className="font-semibold">{loser}</span>
        </p>
      )}

      {open && (
        <form onSubmit={submit} className="flex gap-2">
          <div className="relative flex-1">
            <input
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX))}
              placeholder="Suggest a forfeit…"
              aria-label="Suggest a forfeit"
              className="w-full rounded-lg border border-line bg-card px-3 py-2 pr-12 text-sm outline-none focus:border-ink/40"
            />
            {text.length > MAX - 30 && (
              <span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted">{MAX - text.length}</span>
            )}
          </div>
          <button
            disabled={!text.trim() || busy}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-40"
          >
            Suggest
          </button>
        </form>
      )}
      {error && <p className="text-sm text-live">{error}</p>}

      <div className="divide-y divide-line rounded-xl border border-line bg-card">
        {items.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted">No suggestions yet. Get the ball rolling.</p>}
        {items.map((item, i) => (
          <div key={item.id} className="flex items-center gap-3 px-3 py-2.5">
            <span className="w-5 text-right text-sm text-muted">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm break-words">{item.text}</div>
              {i === 0 && item.votes > 0 && open && <div className="text-[11px] font-semibold text-gold">Leading</div>}
            </div>
            {open ? (
              <button
                onClick={() => vote(item.id)}
                aria-label={`Upvote: ${item.text}`}
                className="flex min-w-14 flex-col items-center rounded-lg border border-line px-2 py-1 hover:border-ink/40 active:scale-95"
              >
                <span className="text-xs leading-none">▲</span>
                <span className="text-sm font-bold tabular-nums">{item.votes}</span>
              </button>
            ) : (
              <span className="min-w-14 text-center text-sm font-bold tabular-nums">{item.votes}</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
