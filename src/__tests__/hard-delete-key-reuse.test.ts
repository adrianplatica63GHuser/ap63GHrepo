/**
 * @jest-environment node
 */

/**
 * Slice #29.04 — a deleted KEY is reusable; a deleted CODE never is.
 *
 * Two rules live in this slice, they sound alike, and they are opposite. This
 * file exists so a later reader cannot collapse them into one sentence:
 *
 *   • a document type's KEY is freed the instant the type is deleted, and the
 *     next type with the same name gets the ORIGINAL key back;
 *   • an entity's CODE (PPERS00112 and siblings) is never handed out twice,
 *     however many rows are deleted.
 *
 * THE EXPERIMENT THIS REPRODUCES
 *   Slice #29.01 created a document type through the API, deleted it, created
 *   it again under the same name, and got `ZZZ_PROBA_SLICE_2901_2`. That is
 *   finding F3. The cause was not `generateUniqueDocumentTypeKey` — which
 *   deliberately does not filter, and was CORRECT, because
 *   lookup_document_type.key is a real UNIQUE constraint that a soft-deleted
 *   row still occupied. The cause was the row surviving the delete. #29.04
 *   removes the row, so the same code now answers differently.
 *
 * WHY IT IS TESTED THROUGH `nextFreeKey` AND A SET
 *   The rule is "what does the generator do when the table no longer holds
 *   the key", and a Set models the table for that question exactly. The other
 *   half — that a delete really empties the table — cannot be asserted from
 *   the same place, so it is asserted where it lives:
 *   hard-delete-single-source.test.ts → "deleting a lookup value really
 *   removes the row", which pins all nine branches of `deleteValue` to
 *   `db.delete`. Together those two are the round trip; NEITHER ALONE IS, and
 *   an adversarial round caught this file claiming the pair existed when the
 *   sibling assertion had not been written.
 *
 * MEASURED AGAINST A REAL DATABASE TOO
 *   These are unit tests, and the sentence they are about is a database
 *   sentence. The migration was run against the real schema loaded into a
 *   throwaway Postgres 16: after purging tombstones and dropping the column,
 *   the deleted type's key was free, the deleted person's CNP was reusable,
 *   and the sequence was untouched — the next code after deleting DOC00010
 *   was DOC00012, not DOC00010. Numbers in the migration_070 header.
 */

import { nextFreeKey, slugifyLookupKey } from "@/lib/admin/value-lists/keys";

describe("nextFreeKey", () => {
  it("returns the base key when nothing holds it", () => {
    expect(nextFreeKey("ZZZ_PROBA", () => false)).toBe("ZZZ_PROBA");
  });

  it("suffixes from _2 when the base is taken", () => {
    const taken = new Set(["ZZZ_PROBA"]);
    expect(nextFreeKey("ZZZ_PROBA", (k) => taken.has(k))).toBe("ZZZ_PROBA_2");
  });

  it("takes the first gap, not the next number after the highest", () => {
    // A run of deletes can leave holes. _2 free with _3 taken must yield _2 —
    // otherwise keys drift upwards forever and the suffix stops meaning
    // anything.
    const taken = new Set(["K", "K_3", "K_4"]);
    expect(nextFreeKey("K", (k) => taken.has(k))).toBe("K_2");
  });

  it("keeps counting past a contiguous run", () => {
    const taken = new Set(["K", "K_2", "K_3"]);
    expect(nextFreeKey("K", (k) => taken.has(k))).toBe("K_4");
  });
});

describe("slugifyLookupKey", () => {
  it("folds Romanian diacritics rather than dropping the letters", () => {
    // ș/ț are comma-below (U+0219/U+021B) and there are cedilla look-alikes
    // in circulation too; both must fold, or one name yields two keys.
    expect(slugifyLookupKey("Certificat de Urbanism")).toBe("CERTIFICAT_DE_URBANISM");
    expect(slugifyLookupKey("Hotărâre Judecătorească")).toBe("HOTARARE_JUDECATOREASCA");
    // ș and ț must fold to s and t ABSOLUTELY, not merely consistently.
    // Comparing the two spellings to each other passes even if both fold to
    // nothing: delete the four s/t entries from the map and
    // "Certificat de Moștenitor" slugs to CERTIFICAT_DE_MO_TENITOR while a
    // same-to-same assertion stays green.
    expect(slugifyLookupKey("Certificat de Moștenitor")).toBe("CERTIFICAT_DE_MOSTENITOR");
    expect(slugifyLookupKey("Ţară Ștampilă")).toBe("TARA_STAMPILA");
    // …and both Unicode spellings of ș/ț (comma-below and cedilla) agree, so
    // one name cannot yield two keys depending on the keyboard.
    expect(slugifyLookupKey("Adeverință")).toBe(slugifyLookupKey("Adeverinţă"));
  });

  it("never returns an empty key", () => {
    expect(slugifyLookupKey("   ")).toBe("DOCTYPE");
    expect(slugifyLookupKey("!!!")).toBe("DOCTYPE");
  });
});

describe("create → delete → create returns the ORIGINAL key", () => {
  // The table, modelled as the set of keys it holds. `deleteValue` is a real
  // DELETE (pinned in hard-delete-single-source.test.ts), so deleting removes
  // the entry — which is the entire difference this slice makes.
  const table = new Set<string>();
  const isTaken = (k: string) => table.has(k);

  it("gives back ZZZ_PROBA, not ZZZ_PROBA_2", () => {
    const first = nextFreeKey("ZZZ_PROBA", isTaken);
    expect(first).toBe("ZZZ_PROBA");
    table.add(first);

    // ── delete ──
    table.delete(first);

    const second = nextFreeKey("ZZZ_PROBA", isTaken);
    expect(second).toBe("ZZZ_PROBA");
    expect(second).toBe(first);
  });

  it("is not vacuous — the suffix still appears while the row IS there", () => {
    // If this one ever fails the test above proves nothing: it would be
    // passing because the generator never suffixes at all.
    const stillThere = new Set(["ZZZ_PROBA"]);
    expect(nextFreeKey("ZZZ_PROBA", (k) => stillThere.has(k))).toBe("ZZZ_PROBA_2");
  });
});
