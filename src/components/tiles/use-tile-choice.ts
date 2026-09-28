"use client";

/**
 * The tiles a detail screen shows, remembered per browser.     (Slice #37.17)
 *
 * The choice lives in localStorage under `tileStorageKey(reg.entity)` — the same
 * way the lists' „Câmpuri afișate" pickers keep theirs — so each of Adrian's
 * machines keeps the arrangement that suits its own screen. Remembering it per
 * user in the database is a register row.
 *
 * The first render shows the defaults (the server has no localStorage), and the
 * stored choice lands one tick after mount, as in the lists. A tile a `?tab=`
 * names, or one a validation error brings back, is added for THIS VISIT only
 * (`visit`) and never written; ticking or unticking anything turns what is on
 * screen into the stored choice.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  parseStoredTiles,
  shownTiles,
  tileStorageKey,
  toggleTile,
  type TileRegistry,
} from "@/lib/ui/tiles";

function write(key: string, value: string[] | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private windows and full storage: the choice holds for this visit.
  }
}

export interface TileChoice<K extends string> {
  /** What is on screen, in registry order. Never empty. */
  shown: K[];
  isShown: (key: K) => boolean;
  toggle: (key: K) => void;
  /** „Toate". */
  showAll: () => void;
  /** „Implicit": back to the defaults, and the stored choice forgotten. */
  reset: () => void;
  /** Show a tile for this visit (an error in it, a `?tab=`). */
  reveal: (key: K) => void;
}

export function useTileChoice<K extends string>(reg: TileRegistry<K>, initialVisit: readonly K[] = []): TileChoice<K> {
  const storageKey = tileStorageKey(reg.entity);
  const [stored, setStored] = useState<K[]>(() => [...reg.defaults]);
  const [visit, setVisit] = useState<K[]>(() => [...initialVisit]);

  useEffect(() => {
    const id = setTimeout(() => {
      let raw: string | null = null;
      try {
        raw = localStorage.getItem(storageKey);
      } catch {
        raw = null;
      }
      setStored(parseStoredTiles(raw, reg));
    }, 0);
    return () => clearTimeout(id);
  }, [storageKey, reg]);

  const shown = useMemo(() => shownTiles(stored, visit, reg.all), [stored, visit, reg.all]);

  const toggle = useCallback(
    (key: K) => {
      const next = toggleTile(shown, key, reg.all);
      setStored(next);
      setVisit([]);
      write(storageKey, next);
    },
    [shown, reg.all, storageKey],
  );

  const showAll = useCallback(() => {
    setStored([...reg.all]);
    setVisit([]);
    write(storageKey, [...reg.all]);
  }, [reg.all, storageKey]);

  const reset = useCallback(() => {
    setStored([...reg.defaults]);
    setVisit([]);
    write(storageKey, null);
  }, [reg.defaults, storageKey]);

  const reveal = useCallback((key: K) => {
    setVisit((v) => (v.includes(key) ? v : [...v, key]));
  }, []);

  const isShown = useCallback((key: K) => shown.includes(key), [shown]);

  return { shown, isShown, toggle, showAll, reset, reveal };
}
