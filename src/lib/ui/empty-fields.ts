/**
 * Which fields of a partly filled form tile hide behind „Arată N câmpuri goale".                    (Slice 40.71)
 *
 * 40.64 folds a wholly empty tile to one line. A tile that holds some values still drew every empty box — on the test
 * record, four of „Contact"'s six. Now an empty field hides, and the tile ends in a link that names how many and which
 * („Arată 4 câmpuri goale", the names in grey); pressing it shows them all, for as long as the record is open.
 *
 * A field hides when it is unset as loaded AND unset now — so a box emptied while typing never vanishes under the
 * cursor, and one that gets a value stays — and is not on the form's always-shown list (`ALWAYS_SHOWN_FIELDS`,
 * field-widths.ts: the fields whose absence is itself information, CNP on a person first). A tile that holds nothing
 * as loaded hides nothing: it is 40.64's one line, and once opened it shows every box.
 *
 * Pure, so a test can pin it without a form; `useEmptyFields` (src/components/tiles/empty-fields.tsx) adds the visit's
 * opened tiles and the cases that draw a tile whole.
 */
import { isUnset, valueAt } from "@/lib/ui/empty-tile";

export type EmptyFieldsInput = {
  /** The tile's field paths, in the order they are drawn. */
  paths: readonly string[];
  /** The form's always-shown paths. */
  always: readonly string[];
  /** The values as loaded — `formState.defaultValues`, a version's `form.reset` included. */
  loaded: unknown;
  /** The values now. */
  now: unknown;
  /** The values a new record starts with, so a select at its default counts as unset. */
  defaults?: unknown;
};

/** The paths to hide, in `paths`' order. */
export function emptyFieldsToHide({ paths, always, loaded, now, defaults }: EmptyFieldsInput): string[] {
  const unset = (source: unknown, path: string): boolean =>
    isUnset(valueAt(source, path), defaults === undefined ? undefined : valueAt(defaults, path));
  if (paths.every((p) => unset(loaded, p))) return [];
  return paths.filter((p) => !always.includes(p) && unset(loaded, p) && unset(now, p));
}
