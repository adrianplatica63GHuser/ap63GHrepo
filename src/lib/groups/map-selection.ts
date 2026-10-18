/**
 * The big map's selection, kept for one browser tab.   (Slice #39.73)
 *
 * „Selectează" on the map of all properties picks properties one click at a time, to add them to a property group.
 * Adrian, 2026-10-17: „when we are happy with the list we can assign it to a group either an existing group or we send
 * the user to create a new group under administration Then use the back button to come to the list of selected
 * properties and add them to the new group". Leaving the map unmounts it, so the selection lives in `sessionStorage`
 * (Ask first 3): per tab, until it is added to a group or cancelled; a new tab starts empty.
 *
 * Two keys. `SELECTION_KEY` holds the mode and the ids, and whether the group picker was open when the user left for
 * „Grup nou…", so the back button lands on the picker. `NEW_GROUP_KEY` is written by „Grupuri"'s add form when it was
 * opened from the map (`GROUPS_FROM_MAP_PATH`), and names the group just created, so the picker can choose it.
 *
 * Storage can be missing or throw (a private window, blocked site data): every read falls back to „nothing kept" and
 * every write is best-effort. The selection then lasts only while the map is open, which is how it was before.
 */

export const SELECTION_KEY = "ga40.map.selection";
export const NEW_GROUP_KEY = "ga40.map.newGroupId";

/** „Grup nou…" opens „Grupuri" with its add form open, for a property group, and a way back. */
export const GROUPS_FROM_MAP_PATH = "/admin/groups?from=map";

export type MapSelection = {
  /** „Selectează" is on. */
  selecting: boolean;
  /** The selected properties' ids, in the order they were clicked. */
  ids: string[];
  /** The group picker was open when the map was left („Grup nou…"): reopen it. */
  pickerOpen: boolean;
};

export const EMPTY_SELECTION: MapSelection = { selecting: false, ids: [], pickerOpen: false };

/** What was stored, made a selection: anything unreadable is the empty one. Pure, for the tests. */
export function parseMapSelection(raw: string | null): MapSelection {
  if (!raw) return EMPTY_SELECTION;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return EMPTY_SELECTION;
  }
  if (typeof v !== "object" || v === null) return EMPTY_SELECTION;
  const o = v as Record<string, unknown>;
  const ids = Array.isArray(o.ids) ? [...new Set(o.ids.filter((x): x is string => typeof x === "string" && x !== ""))] : [];
  const selecting = o.selecting === true;
  if (!selecting) return EMPTY_SELECTION;
  return { selecting, ids, pickerOpen: o.pickerOpen === true };
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readMapSelection(): MapSelection {
  try {
    return parseMapSelection(storage()?.getItem(SELECTION_KEY) ?? null);
  } catch {
    return EMPTY_SELECTION;
  }
}

/** Kept while selecting; removed when the mode is off, so a later visit opens the ordinary map. */
export function writeMapSelection(sel: MapSelection): void {
  try {
    const s = storage();
    if (!s) return;
    if (!sel.selecting) s.removeItem(SELECTION_KEY);
    else s.setItem(SELECTION_KEY, JSON.stringify(sel));
  } catch {
    /* best-effort: see the header */
  }
}

/** „Grupuri" — the group just created from the map's „Grup nou…". */
export function rememberNewGroup(id: string): void {
  try {
    storage()?.setItem(NEW_GROUP_KEY, id);
  } catch {
    /* best-effort */
  }
}

/**
 * The map — the group created on „Grupuri", to choose it in the picker. Only read here, never removed: a `useState`
 * initialiser runs twice under React's Strict Mode, and a read that forgot would lose it on the second run. The map
 * forgets it (`forgetNewGroup`) when the selection is added or cancelled.
 */
export function readNewGroup(): string | null {
  try {
    return storage()?.getItem(NEW_GROUP_KEY) ?? null;
  } catch {
    return null;
  }
}

export function forgetNewGroup(): void {
  try {
    storage()?.removeItem(NEW_GROUP_KEY);
  } catch {
    /* best-effort */
  }
}
