/**
 * The manual's search index, built once per language on the server.                          (Slice #39.45)
 *
 * The routes of „Întreabă” use this; a client never builds one, so the manual's text stays out of every other
 * screen's bundle (the manual screen itself already carries it).
 */
import { getManual } from "@/lib/manual/manual";
import type { ManualLocale } from "@/lib/manual/format";
import { buildIndex, type ManualIndex } from "@/lib/manual/search";

const cache = new Map<ManualLocale, ManualIndex>();

export function manualIndex(locale: ManualLocale): ManualIndex {
  let i = cache.get(locale);
  if (!i) {
    i = buildIndex(getManual(locale));
    cache.set(locale, i);
  }
  return i;
}
