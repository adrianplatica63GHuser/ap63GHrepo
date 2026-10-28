/**
 * What a change of a saved document's type drops — the confirmation's list.                         (Slice 40.92)
 *
 * A saved document's type is changed only as a deliberate correction („Schimbă tipul…", document-type-change.tsx):
 * the confirmation names, before anything changes, what the new type will drop. Each answer here is derived from
 * the code that does the dropping, never restated beside it:
 *
 *   - the form fields — `keepsCustomFieldOnRetype` IS the filter `valuesForSave` (document-form.tsx) applies to
 *     `customFields` on a re-type, so the dialog and the save cannot disagree about which value goes;
 *   - the identity fields — `identityChangeNotice` (src/lib/identity-documents/form.ts), as before;
 *   - the parties — a link whose role the new type does not allow. **A save does not re-check them**: the PATCH
 *     never touches `person_document` (measured in 40.92 — `updateDocument` writes the document row and its
 *     version, nothing else, and no trigger reaches the links). So such a party is named, never removed, and stays
 *     linked as it was (Ask first 4); FU-375 holds what is left.
 *
 * PURE — no React, no DB. Unit-tested in src/__tests__/document-type-change.test.ts.
 */

/**
 * Does a `customFields` value survive a re-type to a type declaring `newTypeKeys`?
 *
 * Kept unless it is an orphan: a key some OTHER type declares and the new one does not. A key no type declares —
 * left by a field an administrator removed (#27.03) — is the user's and is kept, so re-adding the field brings it
 * back (#27.04).
 */
export function keepsCustomFieldOnRetype(
  key: string,
  someTypeDeclares: ReadonlySet<string>,
  newTypeKeys: ReadonlySet<string>,
): boolean {
  return !someTypeDeclares.has(key) || newTypeKeys.has(key);
}

const filled = (v: string | null | undefined): boolean => (v ?? "").trim() !== "";

/**
 * The form fields a change to the new type drops, by their labels: each value that is filled and that
 * `keepsCustomFieldOnRetype` would not keep. In the order the values were entered, each label once.
 *
 * `labelOf` names a key — the old type's own label first (the caller decides which types it reads, and in what
 * order); a key it cannot name is shown as the key.
 */
export function customFieldsDroppedByType(
  values: Readonly<Record<string, string | null | undefined>>,
  someTypeDeclares: ReadonlySet<string>,
  newTypeKeys: ReadonlySet<string>,
  labelOf: (key: string) => string | undefined,
): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(values)) {
    if (!filled(value) || keepsCustomFieldOnRetype(key, someTypeDeclares, newTypeKeys)) continue;
    const label = labelOf(key) ?? key;
    if (!out.includes(label)) out.push(label);
  }
  return out;
}

/** One link of a person to the document, as `listDocumentPersons` returns it — the fields the dialog names. */
export type TypeChangeLink = {
  linkId: string;
  id: string;
  code: string;
  displayName: string;
  personRoleId: string | null;
  roleName: string | null;
};

/** A party the new type has no role for: named in the dialog, and left linked as it is. */
export type StrandedParty = { linkId: string; personId: string; code: string; displayName: string; roleName: string };

/**
 * The links whose role the new type does not allow. A link with no role is not one — there is no role to disallow.
 * A role is matched by its id, never its name: two roles may share a name across a merge (#34.x role-merge).
 */
export function partiesStrandedByType(
  links: readonly TypeChangeLink[],
  allowedRoleIds: ReadonlySet<string>,
): StrandedParty[] {
  return links
    .filter((l) => l.personRoleId !== null && !allowedRoleIds.has(l.personRoleId))
    .map((l) => ({
      linkId: l.linkId,
      personId: l.id,
      code: l.code,
      displayName: l.displayName,
      roleName: l.roleName ?? "",
    }));
}
