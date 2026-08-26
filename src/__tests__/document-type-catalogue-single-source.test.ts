/**
 * The document-type catalogue is ONE list, and this is what keeps it one.
 *                                                              (Slice #29.07)
 *
 * `KNOWN_DOCUMENT_TYPES` (src/lib/import/classify-prompts.ts) is the codebase's
 * copy of `lookup_document_type`. Its own header has asserted since Slice
 * #23.01.Import that a key on that list with no seeded row is not harmless —
 * the scan route whitelists the model's `suggestedTypeKey` against it, the
 * resolver finds no row carrying the key, and the document lands under a key
 * generated from the free-text label that nothing matches on. The invariant was
 * asserted and never checked, and it was false: three keys had no row.
 *
 * So this file is the check. Same shape as
 * `document-type-origin-single-source.test.ts`'s SQL bind at the end — a TS
 * value set and a SQL file are one decision written in two languages, and only
 * a test can hold them together.
 *
 * FOUR BINDS, and each one is a way the list has actually drifted:
 *
 *   1. **The seed.** `sync-reference-data.sql` is what a rebuilt cloud project
 *      and Ciprian's UAT box are given. Three keys were missing from it
 *      (AUTORIZATIE_CONSTRUIRE, DOCUMENTATIE_CADASTRALA,
 *      HOTARARE_ADMINISTRATIVA) and one row it seeded had been deleted by a
 *      migration (AUTORIZATIE). Both directions are checked, because either
 *      one alone lets the other side grow.
 *
 *   2. **The migrations after it.** The seed file is hand-maintained and the
 *      migration chain is not replayed into it, so a migration that adds or
 *      removes a document type is exactly the event that puts the two out of
 *      step. migration_035 (adds four) and migration_043 (deletes one, renames
 *      the catch-all) are the two that have done it so far.
 *
 *   3. **The code that switches on a key.** `type-config.ts` and
 *      `ID_CARD_TYPE_KEYS` are the carve-outs finding F6 broke: they match a
 *      literal canonical key, so a key they name that the catalogue does not
 *      hold is a carve-out that can never fire.
 *
 *   4. **The prompts.** The model can only answer with a key it was taught, so
 *      a catalogue the prompt does not render is a catalogue half the app
 *      believes in.
 *
 * ⚠️ **`seed.ts` IS PARSED RATHER THAN IMPORTED.** It opens a database
 * connection at module scope; importing it from a test would try to reach
 * Postgres. Its `DocumentTypeKey` union is read out of the source text — which
 * is a weaker guard than an import and is the only one available. The same
 * applies to `type-config.ts`'s `CONFIG`, which is not exported.
 */

import fs from "fs";
import path from "path";
import {
  KNOWN_DOCUMENT_TYPES,
  KNOWN_TYPE_KEYS,
  CLASSIFY_SYSTEM_PROMPT,
  buildExtractSystemPrompt,
  canonicalTypeKey,
} from "@/lib/import/classify-prompts";
import { UNCLASSIFIED_DOCUMENT_TYPE_KEY } from "@/lib/documents/document-type-match";
import { ID_CARD_TYPE_KEYS } from "@/lib/import/id-card";

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), "utf8");

/** Strip `-- …` comment lines so a commented-out row can never be read as a row. */
function sqlWithoutComments(sql: string): string {
  return sql
    .split("\n")
    .filter((line) => !/^\s*--/.test(line))
    .join("\n");
}

/**
 * The `(key, name)` pairs `sync-reference-data.sql` inserts into
 * `lookup_document_type`, in file order.
 *
 * ⚠️ **COMMENTS ARE STRIPPED FIRST, AND THEN THE BLOCK IS CUT AT THE FIRST `;`
 * — in that order, because the block's own comments mention one.** Cutting
 * first reads seven rows of twenty-six and reports them as the whole
 * catalogue, which is a green test over a broken invariant. A round hit exactly
 * that.
 *
 * ⚠️ **EVERY tuple, not the first one per line, and a third review round is
 * why.** A line-anchored `.exec` reads one tuple and drops the rest, and this
 * very file already writes other lookup tables several tuples to a line
 * (`('II',  5), ('IF', 6), …`). A document type added in that style would be
 * invisible here: the seed would hold a type the catalogue has never heard of
 * and both directions of the bind below would still pass.
 */
function seededDocumentTypes(): { key: string; name: string; sortOrder: number }[] {
  const sql = sqlWithoutComments(read("src/db/sync-reference-data.sql"));
  const start = sql.indexOf("INSERT INTO lookup_document_type (key, name, sort_order) VALUES");
  expect(start).toBeGreaterThan(-1);
  const end = sql.indexOf(";", start);
  expect(end).toBeGreaterThan(start);
  const block = sql.slice(start, end);
  return [...block.matchAll(/\('([A-Z0-9_]+)',\s*'([^']*)',\s*(\d+)\)/g)].map((m) => ({
    key: m[1],
    name: m[2],
    sortOrder: Number(m[3]),
  }));
}

describe("the catalogue and the seed are one list", () => {
  it("seeds a row for every key the classifier is allowed to answer", () => {
    const seededKeys = seededDocumentTypes().map((r) => r.key).sort();
    expect([...KNOWN_TYPE_KEYS].sort()).toEqual(seededKeys);
  });

  it("agrees with the seed on the display name of every one of them", () => {
    const seeded = new Map(seededDocumentTypes().map((r) => [r.key, r.name]));
    const mismatches = KNOWN_DOCUMENT_TYPES
      .filter((type) => seeded.get(type.key) !== type.name)
      .map((type) => `${type.key}: code "${type.name}" vs seed "${seeded.get(type.key)}"`);
    expect(mismatches).toEqual([]);
  });

  it("names each key once, in the catalogue and in the seed", () => {
    expect(new Set(KNOWN_TYPE_KEYS).size).toBe(KNOWN_TYPE_KEYS.length);
    const seededKeys = seededDocumentTypes().map((r) => r.key);
    expect(new Set(seededKeys).size).toBe(seededKeys.length);
  });

  it("derives KNOWN_TYPE_KEYS from the catalogue rather than restating it", () => {
    expect([...KNOWN_TYPE_KEYS]).toEqual(KNOWN_DOCUMENT_TYPES.map((type) => type.key));
  });
});

describe("the catalogue and the migration chain are one list", () => {
  it("holds every type migration_035 seeds, under the same name", () => {
    const sql = sqlWithoutComments(read("src/db/migration_035_seed_doc_types.sql"));
    const byKey = new Map(KNOWN_DOCUMENT_TYPES.map((type) => [type.key as string, type.name as string]));
    const inserted: string[] = [];
    for (const line of sql.split("\n")) {
      const m = /'([A-Z0-9_]+)',\s*'([^']*)',\s*(\d+)/.exec(line);
      if (!m) continue;
      inserted.push(m[1]);
      expect(byKey.get(m[1])).toBe(m[2]);
    }
    // The four the migration actually writes — a regex that silently matched
    // nothing would otherwise make this test pass by checking no rows at all.
    expect(inserted.sort()).toEqual([
      "AUTORIZATIE_CONSTRUIRE",
      "DOCUMENTATIE_CADASTRALA",
      "HOTARARE_ADMINISTRATIVA",
      "HOTARARE_JUDECATOREASCA",
    ]);
  });

  /**
   * ⚠️ **THIS USED TO ASSERT THE OPPOSITE, AND THE INVARIANT IT GUARDED IS THE
   * ONE THAT CHANGED.** migration_043 deletes the key `AUTORIZATIE` — the row
   * NAMED `Autorizare` — and while that key was free the catalogue was required
   * not to offer it, because offering a key nothing seeds is finding F6. The
   * re-key gave that free key to the SURVIVING `Autorizație` row (it was
   * AUTORIZATIE_ALT), so the key is seeded again and the old assertion would
   * now be asserting that a seeded key is absent.
   *
   * What is tested instead is the thing that was always the point: whatever
   * migration_043 deletes must not be left dangling — either the catalogue
   * does not offer the key at all, or `sync-reference-data.sql` seeds a row for
   * it. A key on the list with no row anywhere is the failure; a key that was
   * deleted and later re-seeded under a different name is not.
   */
  it("leaves no key migration_043 deletes without a seeded row", () => {
    const sql = sqlWithoutComments(read("src/db/migration_043_doctype_cleanup.sql"));
    const deleted = [...sql.matchAll(/DELETE FROM lookup_document_type\s+WHERE\s+key\s*=\s*'([A-Z0-9_]+)'/g)]
      .map((m) => m[1]);
    expect(deleted).toEqual(["AUTORIZATIE"]);
    const seededKeys = new Set(seededDocumentTypes().map((r) => r.key));
    for (const key of deleted) {
      const offered = (KNOWN_TYPE_KEYS as readonly string[]).includes(key);
      expect(offered).toBe(seededKeys.has(key));
    }
  });

  /**
   * The re-key itself, asserted against the migration that performs it rather
   * than restated as four literals: migration_071 is the only thing standing
   * between a database seeded before it and one seeded after, so a catalogue
   * that moved without it is the drift this file exists to catch.
   */
  it("offers the keys migration_071 renames rows to, and none it renames away", () => {
    const sql = sqlWithoutComments(read("src/db/migration_071_doctype_rekey.sql"));
    const renames = [...sql.matchAll(
      /SET\s+key = '([A-Z0-9_]+)', updated_at = now\(\)\s+WHERE\s+key = '([A-Z0-9_]+)'/g,
    )].map((m) => ({ to: m[1], from: m[2] }));
    expect(renames).toEqual([
      { from: "AUTORIZATIE_ALT",        to: "AUTORIZATIE" },
      { from: "CERTIFICAT_SARCINI",     to: "CERTIFICAT_BUNURI" },
      { from: "CERTIFICAT_SARCINI_ALT", to: "CERTIFICAT_SARCINI" },
    ]);
    const keys = KNOWN_TYPE_KEYS as readonly string[];
    for (const { to } of renames) expect(keys).toContain(to);
    // A `from` may legitimately still be offered when another rename hands the
    // key on — CERTIFICAT_SARCINI is vacated by 2a and re-taken by 2b. What may
    // never survive is a source key nothing renames TO.
    const targets = new Set(renames.map((r) => r.to));
    for (const { from } of renames) {
      if (!targets.has(from)) expect(keys).not.toContain(from);
    }
    // The folded row is deleted outright and must be offered by nothing.
    expect(sql).toContain("DELETE FROM lookup_document_type\nWHERE  key = 'EXTRAS_CARTE_FUNCIARA_ALT';");
    expect(keys).not.toContain("EXTRAS_CARTE_FUNCIARA_ALT");
  });

  it("calls the catch-all what migration_043 renames it to", () => {
    const sql = sqlWithoutComments(read("src/db/migration_043_doctype_cleanup.sql"));
    const m = /SET\s+name = '([^']*)', updated_at = now\(\)\s+WHERE\s+key\s*=\s*'UNCLASSIFIED'/.exec(sql);
    expect(m).not.toBeNull();
    const catchAll = KNOWN_DOCUMENT_TYPES.find((type) => type.key === UNCLASSIFIED_DOCUMENT_TYPE_KEY);
    expect(catchAll?.name).toBe(m?.[1]);
  });

  it("still holds every key the dev seed script files documents under", () => {
    const src = read("src/db/seed.ts");
    const union = /type DocumentTypeKey =\s*([\s\S]*?);/.exec(src);
    expect(union).not.toBeNull();
    const keys = [...(union?.[1] ?? "").matchAll(/"([A-Z0-9_]+)"/g)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(15);
    const unknown = keys.filter((k) => !(KNOWN_TYPE_KEYS as readonly string[]).includes(k));
    expect(unknown).toEqual([]);
  });
});

describe("every carve-out that matches a canonical key can still fire", () => {
  it("holds every key type-config.ts configures", () => {
    const src = read("src/lib/documents/type-config.ts");
    const start = src.indexOf("const CONFIG: Record<string, TypeConfig> = {");
    expect(start).toBeGreaterThan(-1);
    const configured = [...src.slice(start).matchAll(/^ {2}([A-Z][A-Z0-9_]*): \{/gm)].map((m) => m[1]);
    expect(configured.length).toBeGreaterThan(5);
    const unknown = configured.filter((k) => !(KNOWN_TYPE_KEYS as readonly string[]).includes(k));
    expect(unknown).toEqual([]);
  });

  it("holds the identity-card key", () => {
    for (const key of ID_CARD_TYPE_KEYS) {
      expect(KNOWN_TYPE_KEYS as readonly string[]).toContain(key);
    }
  });
});

describe("canonicalTypeKey is the one position on a classifier's key", () => {
  it("accepts a key the catalogue defines, trimmed", () => {
    expect(canonicalTypeKey("CONTRACT_VANZARE")).toBe("CONTRACT_VANZARE");
    expect(canonicalTypeKey("  CARTE_IDENTITATE \n")).toBe("CARTE_IDENTITATE");
  });

  it("refuses the catch-all, because it is the absence of an answer", () => {
    expect(canonicalTypeKey(UNCLASSIFIED_DOCUMENT_TYPE_KEY)).toBeNull();
  });

  it("refuses a key nothing defines, and anything that is not a string", () => {
    // The exact shape finding F6 produced: a key slugged from a display label.
    expect(canonicalTypeKey("CARTE_DE_IDENTITATE")).toBeNull();
    // `AUTORIZATIE` used to belong here — migration_043 deleted the row that
    // held it. migration_071 gave the freed key to the surviving `Autorizație`
    // row, so it is a real answer now and is asserted as one above.
    expect(canonicalTypeKey("AUTORIZATIE_ALT")).toBeNull();       // retired by migration_071
    expect(canonicalTypeKey("CERTIFICAT_SARCINI_ALT")).toBeNull(); // retired by migration_071
    expect(canonicalTypeKey("")).toBeNull();
    expect(canonicalTypeKey("   ")).toBeNull();
    expect(canonicalTypeKey(null)).toBeNull();
    expect(canonicalTypeKey(undefined)).toBeNull();
    expect(canonicalTypeKey(42)).toBeNull();
    expect(canonicalTypeKey(["CONTRACT_VANZARE"])).toBeNull();
  });
});

describe("both prompts teach the whole catalogue", () => {
  const prompts: { label: string; text: string }[] = [
    { label: "classify", text: CLASSIFY_SYSTEM_PROMPT },
    { label: "extract",  text: buildExtractSystemPrompt([]) },
  ];
  const catchAll = KNOWN_DOCUMENT_TYPES.find(
    (type) => type.key === UNCLASSIFIED_DOCUMENT_TYPE_KEY,
  );

  // A plain loop rather than `it.each`: the sandbox harness this test was first
  // run under has no `@types/jest`, and a readonly tuple table types both
  // parameters as `any` there — which is a warning about the table, not about
  // jest, and is cheaper to avoid than to explain.
  for (const { label, text } of prompts) {
    it(`${label} names every key beside its stored name`, () => {
      const missing = KNOWN_DOCUMENT_TYPES
        .filter((type) => type.key !== UNCLASSIFIED_DOCUMENT_TYPE_KEY)
        .filter((type) => !text.includes(`${type.key} — ${type.name}`))
        .map((type) => type.key);
      expect(missing).toEqual([]);
    });

    // ⚠️ **The catch-all must not appear in a prompt AT ALL — not as a line,
    // not as a word — and a second review round tightened this from the former
    // to the latter.** `canonicalTypeKey` maps an answer of `UNCLASSIFIED` to
    // `null`, so a prompt that offers the key teaches the model an answer this
    // codebase throws away, and the two would drift apart with nothing
    // complaining. Both prompts ask for `null` instead. The version this
    // replaces only checked the `KEY — NAME` line, and justified the weakness
    // by quoting an instruction ("or UNCLASSIFIED when none of them fits") that
    // the same slice had already removed.
    it(`${label} never mentions the catch-all key`, () => {
      expect(catchAll).toBeDefined();
      expect(text).not.toContain(String(catchAll?.key));
      expect(text).not.toContain(`${catchAll?.key} — ${catchAll?.name}`);
    });
  }
});

/**
 * The two halves of the canonical-key create, pinned to each other.
 *                                                              (Slice #29.07)
 *
 * ⚠️ **A SOURCE-LEVEL BIND AND IT SAYS SO, because the behaviour it guards
 * needs a database and this suite has none.** `createDocumentTypeRow` refuses
 * to substitute `<KEY>_2` for a canonical key it was asked for, and
 * `resolveClassifiedDocumentType` catches that refusal and goes round again to
 * adopt the row that took it. Neither half is any use alone: without the throw
 * a lost race leaves a `_2` row no carve-out will ever match (finding F6 with
 * the canonical key in place of the label slug); without the catch the same
 * race becomes a 500 on an import that should simply have adopted. Deleting
 * one as unused is the failure this exists to make loud.
 *
 * What it cannot see: whether the catch actually re-reads, whether the loop
 * terminates, or whether the outcome is reported as `adopted`. Those need
 * `npx jest` with a database, and they are named in the handover.
 */
describe("the canonical-key create and its retry are one mechanism", () => {
  it("is thrown in one place and understood in exactly two", () => {
    const queries = read("src/lib/admin/value-lists/queries.ts");
    const resolver = read("src/lib/documents/resolve-document-type.ts");

    expect(queries).toContain(
      'export const PREFERRED_KEY_TAKEN = "preferred-document-type-key-taken"',
    );
    expect(queries).toContain("throw new Error(PREFERRED_KEY_TAKEN)");
    expect(resolver).toContain("err.message === PREFERRED_KEY_TAKEN");
  });

  /**
   * ⚠️ **The tree is WALKED, and a third review round is why.** The version
   * this replaces asserted that three NAMED files contain the identifier — two
   * of which the assertion above already covers, and none of which says
   * anything about a fourth file. Its comment nonetheless claimed "and nowhere
   * else in production code, so a third site cannot start meaning something
   * different by it", which a module throwing the raw literal would have
   * falsified in silence. The same trap
   * `document-type-origin-single-source.test.ts` records in its own header: an
   * assertion that filters a hand-written list and then checks that list.
   */
  it("has no other producer, and no other file that spells the value", () => {
    const SRC_DIR = path.join(ROOT, "src");
    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name)) files.push(full);
      }
    };
    walk(SRC_DIR);
    const rel = (f: string): string => path.relative(SRC_DIR, f).split(path.sep).join("/");
    const production = files.filter((f) => !rel(f).startsWith("__tests__/"));
    expect(production.length).toBeGreaterThan(100);

    // The raw string may be written down exactly once — in the constant.
    const spellsTheLiteral = production
      .filter((f) => fs.readFileSync(f, "utf8").includes('"preferred-document-type-key-taken"'))
      .map(rel)
      .sort();
    expect(spellsTheLiteral).toEqual(["lib/admin/value-lists/queries.ts"]);

    // …and the identifier reaches exactly the two callers that handle it.
    const mentions = production
      .filter((f) => fs.readFileSync(f, "utf8").includes("PREFERRED_KEY_TAKEN"))
      .map(rel)
      .sort();
    expect(mentions).toEqual([
      "app/api/document-types/resolve/route.ts",
      "lib/admin/value-lists/queries.ts",
      "lib/documents/resolve-document-type.ts",
    ]);
  });
});
