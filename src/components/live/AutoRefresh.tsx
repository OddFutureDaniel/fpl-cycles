"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-runs the server render every minute while matches are in play. */
export function AutoRefresh({ active, seconds = 60 }: { active: boolean; seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [active, seconds, router]);
  return null;
}
