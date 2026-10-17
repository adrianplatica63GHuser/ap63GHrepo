"use client";

import { useCallback, useSyncExternalStore } from "react";
import { MERGE_DISTANCE, clampMergeDistance } from "@/lib/geo/map-drops";

/**
 * The big map's merge distance — „Setări hartă" — kept per browser.                 (Slice #39.60)
 *
 * Adrian, 2026-10-16: „let's make it a setting". Kept in `localStorage`, like a list's „Câmpuri afișate", so the
 * slice needed no migration (#39.60's Ask first 2); a server-wide setting under Administrare → Setări can follow.
 * Read as a store (`useSyncExternalStore`, as `use-session-value.ts`): the server renders the default, the browser
 * then re-renders with what it holds. Storage that throws (a private window) reads as the default and a write lasts
 * the visit — the value is a convenience, never the record.
 */
export const MERGE_DISTANCE_STORAGE_KEY = "ga40.map.mergeDistancePx";
const EVENT = "ga:merge-distance";

/** In-memory fallback for a browser whose storage refuses the write. */
let memory: number | null = null;

function read(): number {
  try {
    const raw = window.localStorage.getItem(MERGE_DISTANCE_STORAGE_KEY);
    if (raw !== null) return clampMergeDistance(raw);
  } catch {
    /* storage refused: fall through to the visit's value */
  }
  return memory ?? MERGE_DISTANCE.default;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useMergeDistance(): [number, (px: number) => void] {
  const value = useSyncExternalStore(subscribe, read, () => MERGE_DISTANCE.default);
  const set = useCallback((px: number) => {
    const next = clampMergeDistance(px);
    memory = next;
    try {
      window.localStorage.setItem(MERGE_DISTANCE_STORAGE_KEY, String(next));
    } catch {
      /* private window: the choice lasts the visit */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [value, set];
}
