"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useTimeFrames, tfMs } from "@/hooks/use-time-frames";

const TICK_MS = 30 * 1000;

/**
 * Slice #16.UX.01 — small "New!" / "Nou!" badge rendered next to a list
 * row's checkbox when the record was created or modified within the last
 * N minutes (configurable via time_frame_setting.recency_badge_window).
 *
 * Color fades as the record ages:
 *   - #FF0000 (red)       — within recency_badge_red threshold (default 5 min)
 *   - #FF7C80 (mid pink)  — within recency_badge_amber threshold (default 15 min)
 *   - #FFCCCC (pale pink) — within recency_badge_window threshold (default 30 min)
 *   - hidden              — older than the window
 *
 * "Modified" is computed as GREATEST(updatedAt, createdAt) — see
 * src/lib/persons|properties|documents/queries.ts for the matching
 * server-side sort, which uses the same definition.
 *
 * Recency is recomputed client-side on a timer so the badge fades and
 * eventually disappears live, without requiring a refetch from the server.
 */
export function RecencyBadge({
  createdAt,
  updatedAt,
}: {
  createdAt: string | Date;
  updatedAt: string | Date;
}) {
  const t = useTranslations("shared.recency");
  const { data: tf } = useTimeFrames();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const handle = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(handle);
  }, []);

  const redMs    = tfMs(tf, "recency_badge_red");
  const amberMs  = tfMs(tf, "recency_badge_amber");
  const windowMs = tfMs(tf, "recency_badge_window");

  const created = new Date(createdAt).getTime();
  const updated = new Date(updatedAt).getTime();
  const effective = Math.max(created, updated);
  const ageMs = now - effective;

  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > windowMs) {
    return null;
  }

  const color =
    ageMs <= redMs
      ? "#FF0000"
      : ageMs <= amberMs
      ? "#FF7C80"
      : "#FFCCCC";

  return (
    <span
      className="ml-1.5 font-semibold whitespace-nowrap"
      style={{ color, fontSize: "0.75em" }}
    >
      {t("label")}
    </span>
  );
}
