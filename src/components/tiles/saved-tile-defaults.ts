"use client";

/**
 * The user's own default tiles, read once per page load.          (Slice #38.41)
 *
 * A module-level promise rather than a React Query entry, deliberately: every
 * record screen's `useTileChoice` reads it, and several of those screens are
 * rendered by tests with no QueryClientProvider. „Contul meu" calls
 * `forgetSavedTileDefaults()` after a save so the next screen reads afresh.
 * A failed read (offline, signed out, no table yet) is no saved set: the
 * registry's defaults stand, exactly as before this slice.
 */

import { useEffect, useState } from "react";
import type { TileDefaultKind } from "@/lib/ui/tile-defaults";

export type SavedTileDefaults = Partial<Record<TileDefaultKind, string[]>>;

let pending: Promise<SavedTileDefaults> | null = null;

function load(): Promise<SavedTileDefaults> {
  if (pending) return pending;
  pending =
    typeof fetch !== "function"
      ? Promise.resolve({})
      : fetch("/api/account/tile-defaults")
          .then((r) => (r.ok ? (r.json() as Promise<{ items?: SavedTileDefaults }>) : { items: {} }))
          .then((j) => j.items ?? {})
          .catch(() => ({}));
  return pending;
}

/** After „Contul meu" saves or clears a set. */
export function forgetSavedTileDefaults(): void {
  pending = null;
}

/** The saved sets — `undefined` until read, `{}` when there are none or the read failed. */
export function useSavedTileDefaults(): SavedTileDefaults | undefined {
  const [saved, setSaved] = useState<SavedTileDefaults | undefined>(undefined);
  useEffect(() => {
    let live = true;
    load().then((s) => {
      if (live) setSaved(s);
    });
    return () => {
      live = false;
    };
  }, []);
  return saved;
}
