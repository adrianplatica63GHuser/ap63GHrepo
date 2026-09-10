/**
 * @jest-environment node
 */

/**
 * Slice #34.14 — `updateValue` has eleven branches, and one of them was
 * guarding the write-once column that three of them share.
 *
 * THE DEFECT THIS FILE IS ABOUT
 *   `origin` says who CHOSE a reference row — a person („Adăugat manual") or a
 *   machine that was doing something else at the time („Creat la import"). It
 *   is write-once by construction: migration_069 gave it to
 *   `lookup_document_type`, migration_077 gave the same column with the same
 *   meaning to `lookup_tarla` and `lookup_institution`, and
 *   `src/lib/admin/value-lists/origin-status.ts` builds a word, a colour and an
 *   "awaiting review" filter on top of it.
 *
 *   `updateValue` is `.set(...)` over whatever object it is handed. Its
 *   `document-types` branch composed four guards, `stripDocumentTypeOrigin`
 *   among them; the `tarla` and `institutions` branches were one line —
 *   `db.update(<table>).set(data)`. So a caller that is not the HTTP route — a
 *   script, a future admin action, a test — could re-originate a tarla code or
 *   an institution by handing back the row it had just read, turning an
 *   imported row into a hand-added one with nothing in the diff to see.
 *
 *   ⚠️ **ZOD WAS THE ONLY THING STOPPING IT, AND ZOD IS ON THE OTHER SIDE OF
 *   THE DOOR.** `LIST_UPDATE_SCHEMAS` never names the column, which protects
 *   `PUT /api/admin/value-lists/[list]/[id]` and protects nothing else. That is
 *   the exact distinction `stripDocumentTypeOrigin`'s own header drew in Slice
 *   #26.12, and the exact reason #32.07 moved the identity-card refusal INTO
 *   the query layer rather than leaving it at the route.
 *
 * WHAT THIS FILE CAN AND CANNOT ASSERT
 *   There is no database here — no test in this repo has one — so "a write
 *   cannot change a row's origin" is split into the two halves that are
 *   reachable without one, in the style of value-list-ordering and
 *   document-type-origin-single-source:
 *
 *     • **The strip, behaviourally** (§1), over the payload shape each of the
 *       eleven lists is actually edited through. A pure function, asserted on
 *       what it returns.
 *
 *     • **That the strip is on the path** (§2), read out of `updateValue`'s
 *       own source with comments removed: the raw parameter is consumed once,
 *       by the strip, and every `.set(...)` below takes a value derived from
 *       it. This is what a behavioural test would need a database for, and it
 *       is stronger than "the call appears somewhere in the function" — a
 *       strip whose result is thrown away satisfies that and nothing else.
 *
 *     • **Which tables carry the column at all** (§3), derived from the
 *       Drizzle schema rather than from a list somebody keeps up to date. The
 *       set has grown twice — once per migration — and the guard did not follow
 *       either time. It is three today; if it becomes four, this file says so.
 *
 *   ⚠️ **WHAT §2 IS NOT.** It reads a spelling, not an outcome. A refactor that
 *   renames the local can make it red while the behaviour is fine. That is the
 *   accepted cost of the same trade `tarla-is-a-reference.test.ts` states: the
 *   failure being guarded is SILENT — a row that quietly changes its own
 *   provenance looks exactly like a row that was always manual.
 */

import fs from "fs";
import path from "path";
import { getTableConfig } from "drizzle-orm/pg-core";
import { LIST_META, VALID_LIST_KEYS, type ListKey } from "@/lib/admin/value-lists/config";
import { stripLookupOrigin } from "@/lib/admin/value-lists/validation";
import { LIST_DEPENDENCIES } from "@/lib/admin/value-lists/dependents";

const SRC = path.join(process.cwd(), "src");
const read = (...p: string[]) => fs.readFileSync(path.join(SRC, ...p), "utf8");

/** Comments blanked — a claim about code must not be satisfiable by a comment. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ");
}

/** One exported function of queries.ts, comments removed, to its closing brace. */
function functionSource(name: string): string {
  let source: string;
  try {
    source = read("lib", "admin", "value-lists", "queries.ts");
  } catch {
    return "";
  }
  const start = source.indexOf(`export async function ${name}(`);
  if (start < 0) return "";
  // The function's own closing brace is the only `}` at column 0 after it.
  const end = source.indexOf("\n}\n", start);
  if (end < 0) return "";
  return code(source.slice(start, end));
}

const UPDATE_VALUE = functionSource("updateValue");
const CREATE_VALUE = functionSource("createValue");

/**
 * Does the raw parameter stop at the guard?
 *
 * Returns a sentence rather than a boolean so a failure names what went wrong
 * instead of printing `false`.
 */
function rawPayloadStaysAboveTheSwitch(body: string): string {
  const sw = body.indexOf("switch (key)");
  if (sw < 0) return "payload: no switch found";
  // `slice`+`test` rather than `matchAll`: this project targets ES2017, where
  // `String.prototype.matchAll` is not in `lib` at all.
  if (!/\bpayload\b/.test(body.slice(0, sw))) return "payload: never taken";
  return /\bpayload\b/.test(body.slice(sw))
    ? "payload: read inside the switch"
    : "payload: above the switch";
}

// ── §1 The strip itself, on every list's payload shape ───────────────────────

/** What the edit form for each list actually sends, plus an `origin`. */
function payloadFor(key: ListKey): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of LIST_META[key].fields) out[field.key] = "x";
  out.origin = "MANUAL";
  return out;
}

describe("§1 stripLookupOrigin removes origin, and nothing else", () => {
  it.each(VALID_LIST_KEYS.map((k) => [k]))(
    "%s — an origin handed in with the row's own fields does not survive",
    (key) => {
      const payload = payloadFor(key);
      const stripped = stripLookupOrigin(payload) as Record<string, unknown>;
      expect(`${key}: has origin = ${"origin" in stripped}`).toBe(
        `${key}: has origin = false`,
      );
      // Every other key of the payload is returned untouched — the guard must
      // not be a filter that quietly drops a column somebody added to a list.
      const expected = { ...payload };
      delete expected.origin;
      expect(stripped).toEqual(expected);
    },
  );

  it("passes a payload that never mentioned origin through unchanged", () => {
    expect(stripLookupOrigin({ name: "Contract" })).toEqual({ name: "Contract" });
  });

  it("removes the key rather than blanking it", () => {
    // `{ origin: undefined }` is not the same thing: Drizzle's `.set()` would
    // still see the property, and „a column set to undefined" is a different
    // conversation with the driver than „a column that was never named".
    const stripped = stripLookupOrigin({ name: "T1", origin: "IMPORT" });
    expect(Object.keys(stripped)).toEqual(["name"]);
  });

  it("does not care what the origin was — a valid value is refused too", () => {
    // The column is write-once. „MANUAL" is not more acceptable than a typo:
    // re-originating an imported row to MANUAL is the exact defect.
    expect(stripLookupOrigin({ name: "T1", origin: "MANUAL" })).toEqual({ name: "T1" });
    expect(stripLookupOrigin({ name: "T1", origin: "nonsense" })).toEqual({ name: "T1" });
  });
});

// ── §2 …and it is on the path, once, above the switch ────────────────────────

describe("§2 updateValue writes nothing the strip has not been through", () => {
  it("is readable, and takes its payload under a name the switch does not use", () => {
    expect(UPDATE_VALUE.length > 0 ? "found" : "updateValue not found").toBe("found");
    expect(UPDATE_VALUE).toContain("payload: any,");
    expect(UPDATE_VALUE).toContain("const data: any = stripLookupOrigin(payload);");
  });

  /**
   * ⚠️ **THE ASSERTION THAT MAKES THE OTHERS WORTH ANYTHING.** A strip called
   * above the switch guards nothing if a branch below still reads the RAW
   * parameter — `.set(payload)` in one of eleven branches would satisfy every
   * other test in this file.
   *
   * Written as "the last mention is before the switch" rather than as a COUNT,
   * because a count is a number to bump: the create door names its payload
   * three times (the ternary), and a reader has to work out which spelling the
   * number was measuring. The claim is about REACH, so it is asserted as reach.
   */
  it("never mentions the raw payload after the switch opens", () => {
    expect(rawPayloadStaysAboveTheSwitch(UPDATE_VALUE)).toBe("payload: above the switch");
  });

  /**
   * Every write in the function takes the stripped object, or the
   * `document-types` branch's `values` — which is `sanitizeDocumentType-
   * TemplateFields(stripDocumentTypeOrigin(data))`, i.e. derived from it.
   * `document-type-origin-single-source.test.ts` pins that composition
   * character for character; this only has to know it comes from `data`.
   */
  it("every .set(...) takes the stripped object", () => {
    const sets = UPDATE_VALUE.match(/\.set\(([^)]*)\)/g) ?? [];
    expect(sets.length).toBeGreaterThan(0);
    expect([...new Set(sets)].sort()).toEqual([".set(data)", ".set(values)"]);
  });

  /**
   * …and there is one per list. Kept SEPARATE from the assertion above, because
   * the two fail for different reasons: that one fails when a write escapes the
   * guard, this one when a branch stops writing — or when a legitimate second
   * write is added to a branch, which is not an `origin` defect at all and
   * should not arrive under a title that says it is.
   */
  it("writes one row per list, and no branch has been left unable to write", () => {
    const sets = UPDATE_VALUE.match(/\.set\(([^)]*)\)/g) ?? [];
    expect(`${sets.length} .set(...) call(s)`).toBe(
      `${VALID_LIST_KEYS.length} .set(...) call(s)`,
    );
  });

  it("derives the document-types branch's values from the stripped object", () => {
    expect(UPDATE_VALUE).toContain("stripDocumentTypeOrigin(data)");
  });

  /**
   * ⚠️ **AND THE GUARD IS NOT PASTED PER BRANCH.** Three tables carry the
   * column today (§3) and the temptation is three strips, which is three things
   * to keep in step with a schema that has grown twice already. One call, above
   * the switch, covers every list including the one that does not exist yet.
   */
  it("strips once, not once per list", () => {
    const calls = UPDATE_VALUE.match(/stripLookupOrigin\(/g) ?? [];
    expect(`stripLookupOrigin called ${calls.length} time(s)`).toBe(
      "stripLookupOrigin called 1 time(s)",
    );
  });
});

// ── §2b …and the same column on the way IN ───────────────────────────────────
//
// ⚠️ **A DOOR THAT JUDGES ONE VERB IS THE DEFECT THIS SLICE IS ABOUT, TURNED
// AROUND.** `createValue`'s `tarla` and `institutions` branches were a bare
// `.values(data)`, so the caller that `updateValue` had just stopped from
// re-originating a row could still CREATE one with an origin it chose —
// minting a „Creat la import" code for a value a person typed, which is what
// `lookupTarla.origin`'s header forbids in as many words: „This is the ONE
// column on this table the server decides and no payload may state."

describe("§2b createValue strips it too, on every list but document-types", () => {
  it("takes its payload under a name the switch does not use", () => {
    expect(CREATE_VALUE.length > 0 ? "found" : "createValue not found").toBe("found");
    expect(CREATE_VALUE).toContain("payload: any,");
    expect(rawPayloadStaysAboveTheSwitch(CREATE_VALUE)).toBe("payload: above the switch");
  });

  /**
   * ⚠️ **`document-types` IS EXEMPT AND THAT IS NOT AN OVERSIGHT.** Its branch
   * hands `data` to `createDocumentTypeRow`, whose contract is to HONOUR a
   * caller's origin — the classifier's resolver mints types mid-import and has
   * to be able to say so. `document-type-origin-single-source.test.ts` pins
   * that conditional as an expression. So the exception is asserted here, in
   * the shape it is written, rather than left to be re-derived by whoever next
   * wonders why the strip is not unconditional on this door.
   */
  it("strips once, with document-types named as the one exception", () => {
    expect(CREATE_VALUE).toContain(
      'const data: any = key === "document-types" ? payload : stripLookupOrigin(payload);',
    );
    const calls = CREATE_VALUE.match(/stripLookupOrigin\(/g) ?? [];
    expect(`stripLookupOrigin called ${calls.length} time(s)`).toBe(
      "stripLookupOrigin called 1 time(s)",
    );
  });

  it("every .values(...) that is not the document-types row takes the stripped object", () => {
    const values = CREATE_VALUE.match(/\.values\(([^)]*)\)/g) ?? [];
    expect([...new Set(values)].sort()).toEqual([".values(data)"]);
  });

  /**
   * …and there are ten of them. The set assertion above is satisfied by ONE
   * surviving `.values(data)`, which is the same hole §2's split closes on the
   * update door. Ten rather than eleven: `document-types` writes through
   * `createDocumentTypeRow`, whose own `.values({ ...values, key, origin })` is
   * outside this function and pinned by `document-type-template-editor`.
   */
  it("writes one row per list but document-types", () => {
    const values = CREATE_VALUE.match(/\.values\(([^)]*)\)/g) ?? [];
    expect(`${values.length} .values(...) call(s)`).toBe(
      `${VALID_LIST_KEYS.length - 1} .values(...) call(s)`,
    );
  });
});

// ── §3 Which lists carry the column, derived rather than remembered ──────────

/**
 * The lookup table behind each list, read from the map `countDependents`,
 * `reassignDependents` and `deleteValue` already read. Using it here means the
 * set below cannot disagree with the tables the rest of the module operates on.
 */
function originColumn(key: ListKey) {
  return getTableConfig(LIST_DEPENDENCIES[key].table)
    .columns.find((c) => c.name === "origin");
}

function hasOriginColumn(key: ListKey): boolean {
  return originColumn(key) !== undefined;
}

describe("§3 the origin-carrying lists, as the schema has them", () => {
  /**
   * ⚠️ **THIS SET HAS GROWN TWICE AND THE GUARD FOLLOWED NEITHER TIME.**
   * migration_069 put `origin` on `lookup_document_type`; migration_077 put it
   * on `lookup_tarla` and `lookup_institution`. Pinned so that a fourth is a
   * deliberate act with a test to update — and so the #34.14 handover's line
   * about which lists carry the column has something that fails when it goes
   * stale.
   *
   * ⚠️ **The guard itself does NOT read this set**, deliberately:
   * `updateValue` strips unconditionally, so a fourth list arrives already
   * guarded and this test is a record rather than a dependency. That is the
   * difference between a fact worth knowing and a list worth forgetting.
   */
  it("is exactly tarla, document-types and institutions", () => {
    expect(VALID_LIST_KEYS.filter(hasOriginColumn).sort()).toEqual(
      ["document-types", "institutions", "tarla"],
    );
  });

  // ⚠️ **THERE IS NO SECOND TEST HERE COUNTING THE LISTS THAT DO NOT HAVE THE
  // COLUMN.** One was written and deleted: `filter(!P).length ===
  // keys.length - 3` over the same predicate and the same array is an identity,
  // true whenever the assertion above is, and a line with no failure mode reads
  // like coverage without being any.

  /**
   * The three that have it agree about what it means. A `$type` union that
   * drifted on one table would let a row hold a value the other two refuse,
   * and `lookupOriginStatus` — which reads all three — would render it as
   * „Adăugat manual" without anything going red.
   */
  it.each([["tarla"], ["document-types"], ["institutions"]] as const)(
    "%s declares it NOT NULL, defaulting to MANUAL",
    (key) => {
      const col = originColumn(key);
      expect(`${key}: ${col ? "present" : "MISSING"}`).toBe(`${key}: present`);
      if (!col) return;
      expect(`${key}: notNull=${col.notNull}`).toBe(`${key}: notNull=true`);
      expect(`${key}: default=${String(col.default)}`).toBe(`${key}: default=MANUAL`);
    },
  );
});
