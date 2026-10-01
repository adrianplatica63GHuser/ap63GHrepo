/**
 * What a search for a cadastral value looks for — the words as typed, and the
 * same words with their `per` decoded.                         (Slice #37.39)
 *
 * The archive holds `47/2` and `T47/P2` where a folder said `47per2` and
 * `T47 per P2` (perToSlash, and migration_089 for what was already stored). A
 * person who types the folder's spelling into Căutare globală or a list's
 * filter is looking for that record, so the query asks for either form — as
 * `cadastralKey` already does when an import compares one. Typing the slash
 * form finds it as well, because that is the first term.
 *
 * Both, never only the decoded one: a value migration_089 had to leave alone
 * (it would have collided with another) still reads `per`, and a search for it
 * as it reads must still find it.
 *
 * PURE MODULE — unit-tested in src/__tests__/per-to-slash-names.test.ts.
 */
import { perToSlash } from "@/lib/import/folder-utils";

/** The term, then its decoded form when that differs. Empty for a blank term. */
export function perSearchTerms(q: string | null | undefined): string[] {
  const term = q?.trim() ?? "";
  if (term === "") return [];
  const decoded = perToSlash(term).trim();
  return decoded === term ? [term] : [term, decoded];
}
