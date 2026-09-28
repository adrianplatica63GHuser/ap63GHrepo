/**
 * Tiles: several parts of a record shown at once, chosen with checkboxes.
 *                                                              (Slice #37.17)
 *
 * A detail screen declares its tiles in order (`TileRegistry`), which of them
 * show when nothing is stored (`defaults`, what its old Detalii tab showed), and
 * which are FORM tiles — parts of the one form — rather than LIST tiles (the
 * association lists and META INFO). The pure rules live here, so they can be
 * held by a test; `src/components/tiles/` draws them.
 *
 * ⚠️ **AT LEAST ONE TILE IS ALWAYS TICKED.** An empty screen is not a choice
 * anyone makes on purpose, and it would hide the action bar's reason to exist.
 * `toggleTile` refuses to untick the last one, and a stored empty choice reads
 * back as the defaults.
 *
 * ⚠️ **HIDING A FORM TILE NEVER LOSES A VALUE.** That is the screen's job, not
 * this module's: a form tile that is not shown is hidden, not unmounted, as the
 * document notebook's pages are (#36.01). This module only decides WHICH.
 */

export interface TileRegistry<K extends string> {
  /** The localStorage key's entity part: `ga40-tiles-<entity>-v1`. */
  entity: string;
  /** Every tile, in the order the checkboxes and the tiles are drawn. */
  all: readonly K[];
  /** What shows when nothing is stored — the old Detalii tab. „Implicit" returns here. */
  defaults: readonly K[];
  /** The tiles that are parts of the form (hidden, never unmounted). */
  form: readonly K[];
}

/** Where a screen's choice is remembered — per browser, per entity kind. */
export function tileStorageKey(entity: string): string {
  return `ga40-tiles-${entity}-v1`;
}

/** `keys` in the registry's order, known ones only, each once. */
export function inRegistryOrder<K extends string>(keys: Iterable<string>, all: readonly K[]): K[] {
  const set = new Set(keys);
  return all.filter((k) => set.has(k));
}

/**
 * A stored choice read back. Anything that is not a JSON array of known tile
 * keys — a missing value, a corrupt one, one naming only tiles this build no
 * longer has — reads as the defaults, so the screen always opens with a tile.
 */
export function parseStoredTiles<K extends string>(raw: string | null, reg: TileRegistry<K>): K[] {
  if (!raw) return [...reg.defaults];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...reg.defaults];
    const known = inRegistryOrder(parsed.filter((x): x is string => typeof x === "string"), reg.all);
    return known.length > 0 ? known : [...reg.defaults];
  } catch {
    return [...reg.defaults];
  }
}

/** Tick or untick one tile. Unticking the last one changes nothing. */
export function toggleTile<K extends string>(shown: readonly K[], key: K, all: readonly K[]): K[] {
  if (shown.includes(key)) {
    const next = shown.filter((k) => k !== key);
    return next.length > 0 ? next : [...shown];
  }
  return inRegistryOrder([...shown, key], all);
}

/**
 * What the screen shows: the stored choice, plus tiles added for this visit
 * only — the one a `?tab=` names, or the one a validation error brought back.
 * Those are never written to storage.
 */
export function shownTiles<K extends string>(stored: readonly K[], visit: readonly K[], all: readonly K[]): K[] {
  return inRegistryOrder([...stored, ...visit], all);
}

/**
 * The dotted path of the first field react-hook-form reports an error on —
 * `lastName`, `addresses.HOME.streetLine` — or null. A field error is the
 * object carrying `type`; its `ref` is never walked into.
 */
export function firstErrorPath(errors: unknown, prefix = ""): string | null {
  if (!errors || typeof errors !== "object") return null;
  for (const [key, value] of Object.entries(errors as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if ("type" in value) return path;
    const inner = firstErrorPath(value, path);
    if (inner) return inner;
  }
  return null;
}
