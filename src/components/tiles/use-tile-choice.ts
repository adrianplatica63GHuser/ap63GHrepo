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
 *
 * Slice #38.04: `disabled` names tiles the record cannot show now (a Property
 * whose type hides „Adresă" and „Street View"). Their part of the stored choice
 * is KEPT, never rewritten — switching back to a type that allows the tile
 * brings it back as the user had it — so „Toate" ticks every enabled tile and
 * „Implicit" resets the enabled ones only. Which of them is on screen is the
 * caller's (`shown` still says what is stored).
 *
 * Slice 41.45: `only` — a group or stamp opened from a record (`?tiles=`) shows these tiles and no other, FOR THIS VISIT:
 * the stored choice is neither read for the screen nor written. „Panouri" ticks and unticks within the visit, „Toate"
 * shows every tile for it, and „Implicit" leaves the visit's set for the stored choice — without writing anything.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { TILES_ALL_UP, TILE_POSITIONS_RESET, tilePositionsKey } from "@/lib/ui/tile-positions";
import {
  parseStoredTiles,
  shownTiles,
  tileStorageKey,
  toggleTile,
  type TileRegistry,
} from "@/lib/ui/tiles";
import { effectiveDefaults, kindOfEntity } from "@/lib/ui/tile-defaults";
import { useSavedTileDefaults } from "./saved-tile-defaults";

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
  /** „Implicit": back to the defaults, the stored choice forgotten — and since #37.76 the dragged arrangement too. */
  reset: () => void;
  /** Show a tile for this visit (an error in it, a `?tab=`). */
  reveal: (key: K) => void;
  /** Slice 40.40 „Toate sus": tells this kind of record's tile row to rise every tile and even its columns. */
  allUp: () => void;
}

const NONE: readonly never[] = [];

export function useTileChoice<K extends string>(
  reg: TileRegistry<K>,
  initialVisit: readonly K[] = [],
  disabled: readonly K[] = NONE,
  only: readonly K[] = NONE,
): TileChoice<K> {
  const storageKey = tileStorageKey(reg.entity);
  // Slice #38.41: the user's own set for this kind of record, when „Contul meu" saved one —
  // what shows with nothing stored in this browser, and what „Implicit" returns to.
  const saved = useSavedTileDefaults();
  const kind = kindOfEntity(reg.entity);
  const defaults = useMemo(
    () => effectiveDefaults(reg, kind && saved ? saved[kind] : undefined),
    [reg, kind, saved],
  );
  const [stored, setStored] = useState<K[]>(() => [...reg.defaults]);
  const [visit, setVisit] = useState<K[]>(() => [...initialVisit]);
  // 41.45: the visit's own set, while the screen was opened with `?tiles=`; null once „Implicit" leaves it.
  const [onlySet, setOnlySet] = useState<K[] | null>(() => {
    const known = reg.all.filter((k) => only.includes(k));
    return known.length > 0 ? known : null;
  });

  useEffect(() => {
    const id = setTimeout(() => {
      let raw: string | null = null;
      try {
        raw = localStorage.getItem(storageKey);
      } catch {
        raw = null;
      }
      setStored(parseStoredTiles(raw, { ...reg, defaults }));
    }, 0);
    return () => clearTimeout(id);
  }, [storageKey, reg, defaults]);

  const fromStore = useMemo(() => shownTiles(stored, visit, reg.all), [stored, visit, reg.all]);
  const shown = onlySet ?? fromStore;

  const toggle = useCallback(
    (key: K) => {
      const next = toggleTile(shown, key, reg.all);
      if (onlySet) {
        setOnlySet(next); // 41.45: within the visit, never written
        return;
      }
      setStored(next);
      setVisit([]);
      write(storageKey, next);
    },
    [shown, reg.all, storageKey, onlySet],
  );

  const showAll = useCallback(() => {
    if (onlySet) {
      setOnlySet([...reg.all]); // 41.45: every tile, for the visit
      return;
    }
    // #38.04: a disabled tile keeps what was stored for it.
    const next = reg.all.filter((k) => !disabled.includes(k) || stored.includes(k));
    setStored(next);
    setVisit([]);
    write(storageKey, next);
  }, [reg.all, storageKey, disabled, stored, onlySet]);

  const reset = useCallback(() => {
    if (onlySet) {
      setOnlySet(null); // 41.45: the visit's set left for the stored choice; nothing written
      return;
    }
    if (disabled.length === 0) {
      setStored([...defaults]);
      write(storageKey, null);
    } else {
      // #38.04: the enabled tiles back to the defaults, the disabled ones as stored.
      const next = reg.all.filter((k) => (disabled.includes(k) ? stored.includes(k) : defaults.includes(k)));
      setStored(next);
      write(storageKey, next);
    }
    setVisit([]);
    // Slice #37.76 (its Ask first): „Implicit" returns the screen to how it first was — #37.75's places.
    write(tilePositionsKey(reg.entity), null);
    window.dispatchEvent(new CustomEvent(TILE_POSITIONS_RESET, { detail: reg.entity }));
  }, [reg.all, reg.entity, defaults, storageKey, disabled, stored, onlySet]);

  const reveal = useCallback((key: K) => {
    setVisit((v) => (v.includes(key) ? v : [...v, key]));
  }, []);

  const isShown = useCallback((key: K) => shown.includes(key), [shown]);

  // Slice 40.40: the packing hook (use-tile-packing.ts) does the moving; the bar does not need it.
  const allUp = useCallback(() => {
    window.dispatchEvent(new CustomEvent(TILES_ALL_UP, { detail: reg.entity }));
  }, [reg.entity]);

  return { shown, isShown, toggle, showAll, reset, reveal, allUp };
}
