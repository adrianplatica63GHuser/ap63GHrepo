/**
 * How a lookup row's `key` is derived from its name, and what makes one free.
 *
 * PURE ON PURPOSE. Nothing here touches the database, so the rule can be
 * tested by the test that Slice #29.04 owes — create a type, delete it,
 * create it again, and get the ORIGINAL key back rather than a `_2` suffix.
 * With the loop inline in queries.ts the only way to run that experiment was
 * a live database, which is why it had never been run before Adrian ran it by
 * hand through the API in #29.01 and got `ZZZ_PROBA_SLICE_2901_2` (finding F3).
 *
 * Split out of src/lib/admin/value-lists/queries.ts, where it had lived since
 * Slice #15.05.
 */

// ── property-types / document-types: server-generated `key` slug ──────────
//
// Migration 020 (Slice #15.05) added `lookup_document_type.key` as an
// immutable, NOT NULL, UNIQUE slug that application code (getTypeConfig)
// switches on. The Value Lists admin form only ever exposed `name` — adding
// a new Document Type via Reference Data left `key` unset, violating the
// NOT NULL constraint. Per the standing rule ("new document types are added
// only by Adrian via Administration -> Reference Data ... never auto-seeded
// or hardcoded again"), `key` for an admin-added type doesn't need to match
// anything `type-config.ts` recognizes — unmapped keys already fall back to
// the GENERIC config. So the key is derived from `name` automatically here,
// using the same diacritics-folding approach as migration_020's fallback-slug
// step, with a numeric suffix on collision.
//
// ⚠️ **"The Value Lists admin form only ever exposed `name`" AND "The form
// itself never changes" WERE BOTH TRUE FOR NINETEEN SLICES AND ARE NOT TRUE
// SINCE #34.09.** Quoted rather than deleted, because the paragraph above is
// the record of why the slug generator exists at all and it should still read
// as the history it is. What changed: D-03 put a `key` field on the
// document-types ADD form (`LIST_META`, `createOnly: true`), so a key can now
// be CHOSEN. Nothing below changes — the generator is still what answers when
// no key was chosen, which is every other list and every create that leaves
// the field blank. See `requestedDocumentTypeKey` at the bottom of this file
// for what a chosen key goes through, and `createDocumentTypeRow` for why a
// chosen key that is taken is refused rather than suffixed.

const ROMANIAN_DIACRITICS_MAP: Record<string, string> = {
  ă: "a", â: "a", î: "i", ș: "s", ş: "s", ț: "t", ţ: "t",
  Ă: "A", Â: "A", Î: "I", Ț: "T", Ţ: "T", Ș: "S", Ş: "S",
};

export function foldRomanianDiacritics(input: string): string {
  return input.replace(/[ăâîșşțţĂÂÎȚŢȘŞ]/g, (ch) => ROMANIAN_DIACRITICS_MAP[ch] ?? ch);
}

/**
 * The slug, or `null` when there was nothing to slug.
 *
 * Split out of `slugifyLookupKey` in Slice #34.09, which needed the two
 * answers apart. Slugging a NAME can never fail usefully — `lookup_document_
 * type.key` is NOT NULL, so a name of „—" still has to produce something, and
 * `DOCTYPE` is that something. Slugging a KEY A PERSON TYPED is the opposite:
 * an input of „—" is a mistake, and answering `DOCTYPE` would mint the archive
 * a permanent, immutable key nobody chose, out of a typo — the exact shape
 * D-03 exists to remove. So the fallback stays where it was needed and this
 * function is what the create form asks.
 */
export function slugifyLookupKeyOrNull(name: string): string | null {
  const slug = foldRomanianDiacritics(name)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || null;
}

export function slugifyLookupKey(name: string): string {
  return slugifyLookupKeyOrNull(name) ?? "DOCTYPE";
}

/**
 * The key a person asked for on the create form, or `null` for "did not ask".
 *                                                              (Slice #34.09)
 *
 * ⚠️ **THIS IS THE FUNCTION THAT RETIRES THE RENAME WORKAROUND**, so it is
 * worth writing down what it replaces. `key` is an immutable slug that all
 * document matching, every `type-config` carve-out and the whole classifier
 * catalogue run on, and until now the create form asked only for a NAME and
 * slugged whatever it was given. The working method — written down in Adrian's
 * own `New.DocTypes.docx` — was therefore to type `CONTRACT_VANZARE` as the
 * NAME, let it slug to the key you wanted, and then rename the row to
 * „Contract de Vânzare". It works, because underscores are non-alphanumeric
 * and `name` is freely editable while `key` is not. D-03 is (b): a key field on
 * the form, so a permanent key stops being the by-product of remembering a
 * slugging rule.
 *
 * ⚠️ **FORGIVING ABOUT SPELLING, NEVER ABOUT IDENTITY.** The typed value goes
 * through the SAME `slugifyLookupKey` a name does, so `contract_vanzare`,
 * `Contract Vânzare` and `CONTRACT VANZARE` all reach `CONTRACT_VANZARE` and a
 * key can never be stored in a shape `nextFreeKey`, `KNOWN_DOCUMENT_TYPES` or a
 * carve-out could not match. What it will not do is invent a DIFFERENT key: a
 * value that slugs to nothing is `null` here and is refused by the zod schema
 * rather than becoming `DOCTYPE`.
 *
 * ⚠️ **AND A KEY THAT IS TAKEN IS REFUSED, NOT SUFFIXED.** That is not this
 * function's doing — it is `createDocumentTypeRow`'s `PREFERRED_KEY_TAKEN`,
 * written in #29.07 for the classifier and now doing the same job for a person.
 * `nextFreeKey` would happily answer `CONTRACT_VANZARE_2`, which is the right
 * answer for a slug derived from a name and the wrong one for a key someone
 * chose on purpose: a `_2` row is a row every carve-out matching the literal
 * key will miss.
 *
 * PURE, for `keys.ts`'s own stated reason: nothing here touches the database,
 * so „a key entered on the create form is the key stored" is three calls rather
 * than a live database.
 */
export function requestedDocumentTypeKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  return slugifyLookupKeyOrNull(trimmed);
}

/**
 * The base key if it is free, otherwise base_2, base_3, … — first gap wins.
 *
 * WHY THIS IS A PURE FUNCTION AND NOT A LOOP INSIDE THE QUERY
 *   Slice #29.04 owes a test for exactly one behaviour: create a type, delete
 *   it, create it again under the same name, and get the ORIGINAL key back
 *   rather than a _2 suffix. Adrian ran that experiment through the API in
 *   Slice #29.01 and got `ZZZ_PROBA_SLICE_2901_2`, which is finding F3. With
 *   the loop inline the only way to test it was a database; hoisted, the
 *   whole rule is `isTaken` and the experiment is three calls.
 *
 * WHY `isTaken` MUST NOT SKIP "DELETED" ROWS — AND WHY THAT IS NOW MOOT
 *   `lookup_document_type.key` is `.notNull().unique()`: a real UNIQUE
 *   constraint. While rows were soft-deleted, a tombstone went on occupying
 *   its key, so a caller that filtered tombstones out here would have handed
 *   back a candidate that then failed on INSERT with 23505 — which is why the
 *   query in queries.ts deliberately did not filter, and why "add a deletedAt
 *   filter here" was the WRONG fix for F3 and was retired rather than
 *   assigned.
 *   Slice #29.04 removed the cause instead: a deleted row is gone, so nothing
 *   holds the key and this function returns the base key with no change to
 *   its own logic.
 *
 *   The rule that sounds like this one and is its opposite: an entity CODE
 *   (PPERS00112 and siblings) must NEVER be reissued. Codes come from a
 *   Postgres sequence, `nextval()` does not roll back, and nothing in this
 *   codebase computes one. Reusable KEY, non-reusable CODE — see
 *   src/lib/entities/delete.ts.
 */
export function nextFreeKey(base: string, isTaken: (key: string) => boolean): string {
  if (!isTaken(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base}_${suffix}`;
    if (!isTaken(candidate)) return candidate;
  }
}
