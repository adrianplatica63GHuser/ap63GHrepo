/**
 * When a record's form tile counts as empty — the rule behind 40.64's one-line tiles.
 *
 * A tile is EMPTY when every field in it is empty or unset (the header's Ask first 1): a text that is blank once
 * trimmed, a box unticked, a select at its default — the value the form starts a new record with. Only the four
 * record forms' own tiles collapse; Legături, the family tree, Clasificare, Etichete and Interacțiuni keep the empty
 * states they have.
 *
 * Pure, so a test can pin it without a form: the forms pass their values, the tile's field paths and their own
 * `emptyFormValues` as the defaults.
 */

/** A value with nothing in it: null, undefined, a blank string, `false`, an empty list, an object of empties. */
export function isBlank(value: unknown): boolean {
  if (value === null || value === undefined || value === false) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.every(isBlank);
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).every(isBlank);
  return false;
}

/** Reads a dotted path (`addresses.HOME.locality`) out of a plain object. */
export function valueAt(source: unknown, path: string): unknown {
  let at: unknown = source;
  for (const key of path.split(".")) {
    if (at === null || typeof at !== "object") return undefined;
    at = (at as Record<string, unknown>)[key];
  }
  return at;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === "string" && typeof b === "string") return a.trim() === b.trim();
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a as object);
    const kb = Object.keys(b as object);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => sameValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return false;
}

/** One field is unset: blank, or the value a new record starts with (a select at its default). */
export function isUnset(value: unknown, start?: unknown): boolean {
  return isBlank(value) || (start !== undefined && sameValue(value, start));
}

/** Every one of `paths` is unset in `values`, measured against `defaults`. An empty list of paths is NOT empty. */
export function tileIsEmpty(values: unknown, paths: readonly string[], defaults?: unknown): boolean {
  if (paths.length === 0) return false;
  return paths.every((p) => isUnset(valueAt(values, p), defaults === undefined ? undefined : valueAt(defaults, p)));
}
