/**
 * A document type's short name — what the Documents list's „Tip" column
 * shows, the full name in its tooltip.                          (Slice #37.95)
 *
 * Stored per type (`lookup_document_type.short_name`, migration_092), set in
 * Date de referință beside the name, and seeded for the catalogue: an
 * abbreviation where the archive uses one (CVC, PAD, CU, AC, TP, CI), otherwise
 * the type's meaningful last words. A type whose short name is blank falls
 * back to the rule below — the name without its leading „Contract de",
 * „Act de", „Încheiere de", „Certificat de"… phrase — so a type added later
 * still reads short before anyone names it.
 *
 * The full name stays everywhere else: the type filter, the document form,
 * the previews, the import. Two types may not share a short name — the
 * database refuses a stored duplicate (its unique index), and the reference
 * data route refuses one that would equal another type's effective short
 * name, stored or derived (`shortNameClash`).
 */

/** The leading phrases the rule drops, longest first so „Act de" never eats „Act adițional"'s first word alone. */
const LEADING_PHRASES = [
  "Contract de",
  "Încheiere de",
  "Certificat de",
  "Cerere de",
  "Dovadă de",
  "Act de",
] as const;

const fold = (s: string) => s.normalize("NFC").toLocaleLowerCase("ro-RO");

/** The rule: the name without its leading phrase, the rest's first letter capitalised; the name itself when nothing is left. */
export function derivedShortName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  for (const phrase of LEADING_PHRASES) {
    const head = trimmed.slice(0, phrase.length);
    const rest = trimmed.slice(phrase.length);
    if (fold(head) === fold(phrase) && rest.startsWith(" ") && rest.trim() !== "") {
      const tail = rest.trim();
      return tail.charAt(0).toLocaleUpperCase("ro-RO") + tail.slice(1);
    }
  }
  return trimmed;
}

/** What the list shows: the stored short name, or the rule's when it is blank. */
export function documentTypeShortName(type: { name: string; shortName?: string | null }): string {
  const stored = type.shortName?.trim();
  return stored ? stored : derivedShortName(type.name);
}

/** The comparison two short names are told apart by: case, spacing and Unicode form ignored. */
export function shortNameKey(shortName: string): string {
  return fold(shortName.trim().replace(/\s+/g, " "));
}

/**
 * The other type whose short name — stored, or the rule's — would read the
 * same as `candidate`'s, if any. `candidate.id` is left out of the comparison,
 * so a type keeps its own name.
 */
export function shortNameClash<T extends { id: string; name: string; shortName?: string | null }>(
  candidate: { id: string | null; name: string; shortName?: string | null },
  others: readonly T[],
): T | null {
  const mine = shortNameKey(documentTypeShortName(candidate));
  return others.find((o) => o.id !== candidate.id && shortNameKey(documentTypeShortName(o)) === mine) ?? null;
}

// ---------------------------------------------------------------------------
// The refusal                                                   (Slice #37.95)
// ---------------------------------------------------------------------------

/** The `code` the reference-data routes answer a short name that is taken with. */
export const DOCUMENT_TYPE_SHORT_NAME_TAKEN_CODE = "document_type_short_name_taken";

/** migration_092's partial unique index — a stored duplicate that slips past the read arrives as its 23505. */
export const DOCUMENT_TYPE_SHORT_NAME_UNIQUE_INDEX = "lookup_document_type_short_name_uq";

/** Thrown by the query layer, so a direct caller of `createValue` / `updateValue` is bound too. */
export class DocumentTypeShortNameTakenError extends Error {
  constructor(readonly takenBy: string) {
    super(DOCUMENT_TYPE_SHORT_NAME_TAKEN_CODE);
    this.name = "DocumentTypeShortNameTakenError";
  }
}

/** The error, if that is what this is. */
export function asDocumentTypeShortNameTaken(err: unknown): DocumentTypeShortNameTakenError | null {
  return err instanceof DocumentTypeShortNameTakenError ? err : null;
}

/** A short name as stored: trimmed, single-spaced, and a blank is NULL — the rule's. */
export function storedShortName(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const tidy = value.trim().replace(/\s+/g, " ");
  return tidy === "" ? null : tidy;
}
