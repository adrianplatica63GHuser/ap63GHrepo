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
// step, with a numeric suffix on collision. The form itself never changes.

const ROMANIAN_DIACRITICS_MAP: Record<string, string> = {
  ă: "a", â: "a", î: "i", ș: "s", ş: "s", ț: "t", ţ: "t",
  Ă: "A", Â: "A", Î: "I", Ț: "T", Ţ: "T", Ș: "S", Ş: "S",
};

export function foldRomanianDiacritics(input: string): string {
  return input.replace(/[ăâîșşțţĂÂÎȚŢȘŞ]/g, (ch) => ROMANIAN_DIACRITICS_MAP[ch] ?? ch);
}

export function slugifyLookupKey(name: string): string {
  const slug = foldRomanianDiacritics(name)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || "DOCTYPE";
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
