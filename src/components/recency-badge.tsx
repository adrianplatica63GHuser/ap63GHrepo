"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const FIVE_MIN_MS = 5 * 60 * 1000;
const FIFTEEN_MIN_MS = 15 * 60 * 1000;
const THIRTY_MIN_MS = 30 * 60 * 1000;
const TICK_MS = 30 * 1000;

/**
 * Slice #16.UX.01 — small "New!" / "Nou!" badge rendered next to a list
 * row's checkbox when the record was created or modified within the last
 * 30 minutes.
 *
 * Color fades as the record ages:
 *   - #FF0000 (red)       — modified within the last 5 minutes
 *   - #FF7C80 (mid pink)  — modified within the last 5–15 minutes
 *   - #FFCCCC (pale pink) — modified within the last 15–30 minutes
 *   - hidden              — older than 30 minutes
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
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const handle = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(handle);
  }, []);

  const created = new Date(createdAt).getTime();
  const updated = new Date(updatedAt).getTime();
  const effective = Math.max(created, updated);
  const ageMs = now - effective;

  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > THIRTY_MIN_MS) {
    return null;
  }

  const color =
    ageMs <= FIVE_MIN_MS
      ? "#FF0000"
      : ageMs <= FIFTEEN_MIN_MS
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
