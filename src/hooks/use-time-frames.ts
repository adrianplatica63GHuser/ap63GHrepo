// src/hooks/use-time-frames.ts
//
// React Query hook that fetches all time-frame settings from /api/time-frames.
// Stale time is long (5 min) — these values change rarely and are not
// security-sensitive, so serving a cached copy for a session is fine.

import { useQuery } from "@tanstack/react-query";
import type { TimeFrameMap, TimeFrameKey, TimeFrameRow } from "@/lib/time-frames/config";
import { TIME_FRAME_DEFAULTS, toMs } from "@/lib/time-frames/config";

async function fetchTimeFrames(): Promise<TimeFrameMap> {
  const res = await fetch("/api/time-frames");
  if (!res.ok) throw new Error("Failed to fetch time frame settings");
  const data = (await res.json()) as { items: TimeFrameRow[] };

  const map = {} as TimeFrameMap;

  // Seed with hard-coded defaults.
  for (const key of Object.keys(TIME_FRAME_DEFAULTS) as TimeFrameKey[]) {
    const d = TIME_FRAME_DEFAULTS[key];
    map[key] = {
      key,
      value:         d.value,
      unit:          d.unit,
      labelEn:       key,
      labelRo:       key,
      descriptionEn: null,
      descriptionRo: null,
      updatedAt:     new Date(0).toISOString(),
    };
  }

  // Overwrite with DB values.
  for (const row of data.items) {
    map[row.key as TimeFrameKey] = row;
  }

  return map;
}

export function useTimeFrames() {
  return useQuery<TimeFrameMap>({
    queryKey:            ["time-frames"],
    queryFn:             fetchTimeFrames,
    staleTime:           5 * 60 * 1000,  // 5 minutes
    refetchOnWindowFocus: false,
  });
}

// ---------------------------------------------------------------------------
// Convenience selectors — safe to call with a null/undefined map; fall back
// to hard-coded defaults so callers never need to guard for undefined.
// ---------------------------------------------------------------------------

export function tfDays(map: TimeFrameMap | null | undefined, key: TimeFrameKey): number {
  if (!map) return TIME_FRAME_DEFAULTS[key].value;
  return map[key]?.value ?? TIME_FRAME_DEFAULTS[key].value;
}

export function tfMs(map: TimeFrameMap | null | undefined, key: TimeFrameKey): number {
  if (!map) {
    const d = TIME_FRAME_DEFAULTS[key];
    return toMs(d.value, d.unit);
  }
  const row = map[key];
  if (!row) {
    const d = TIME_FRAME_DEFAULTS[key];
    return toMs(d.value, d.unit);
  }
  return toMs(row.value, row.unit);
}
