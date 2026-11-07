"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useMe } from "@/components/me";

export function H2HPicker({ managers, a, b }: { managers: { entry: number; name: string }[]; a: number; b: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const me = useMe();
  const go = (na: number, nb: number) => router.replace(`/?view=h2h&a=${na}&b=${nb}`, { scroll: false });

  // No pair chosen in the URL: start from me vs whoever the server put opposite
  useEffect(() => {
    if (!me || params.get("a") || me === a) return;
    go(me, me === b ? a : b);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  const select = (value: number, other: number, onPick: (n: number) => void) => (
    <select
      value={value}
      onChange={(e) => onPick(Number(e.target.value))}
      className="w-full min-w-0 rounded-lg border border-line bg-card px-2 py-1.5 text-sm font-semibold"
    >
      {managers.map((m) => (
        <option key={m.entry} value={m.entry} disabled={m.entry === other}>
          {m.name}
        </option>
      ))}
    </select>
  );

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
      {select(a, b, (n) => go(n, b))}
      <button onClick={() => go(b, a)} className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-card" aria-label="Swap">
        ⇄
      </button>
      {select(b, a, (n) => go(a, n))}
    </div>
  );
}
