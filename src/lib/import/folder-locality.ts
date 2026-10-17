/**
 * The locality an import's root folder names, if it names one.                        (Slice #39.67)
 *
 * Tarla numbers restart in every locality, so the import's property step asks for the locality its tarlale belong
 * to — once, for the whole run — and offers what the root folder's name says: „CLINCENI.3" → „Clinceni". Only a
 * first segment of letters (before a dot, an underscore, a dash, a space or a digit) at least four letters long is
 * read as one; anything else offers nothing, and the person types it. It is an offer, never a decision: the field
 * stays editable.
 */
export function localityFromFolderName(name: string | null | undefined): string {
  const first = (name ?? "").trim().split(/[._\-\s\d]/)[0] ?? "";
  if (!/^[\p{L}]{4,}$/u.test(first)) return "";
  return first.charAt(0).toLocaleUpperCase("ro-RO") + first.slice(1).toLocaleLowerCase("ro-RO");
}
