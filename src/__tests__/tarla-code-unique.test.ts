/**
 * Two tarla codes may not fold to one code.                     (Slice #34.32)
 *
 * WHAT THIS SUITE IS FOR
 * ----------------------
 * Five claims, none of which any other suite makes:
 *
 *   1. `t3` and `T3` are ONE code to this codebase, and the create and rename
 *      doors refuse the second — while `47/2` and `472` stay two codes,
 *      because the fold here is NOT the document-type one, and a whitespace-
 *      only code stays allowed, because `sameTarlaCode` refuses to call two
 *      empty folds equal.
 *   2. `migration_083_tarla_code_unique.sql` encodes exactly that rule,
 *      including the exception, and encodes it in the SAME TEXT that has
 *      measured this table — `pg_temp.ga40_fold` in
 *      `scripts/decision-checks.sql`, which is what query 1c groups by.
 *   3. Both value-lists doors turn the refusal into a named 400 with a `code`,
 *      and turn migration_083's 23505 into the same refusal rather than into
 *      the generic Romanian sentence.
 *   4. THE IMPORT ADOPTS. `resolveTarlaForCreate` never inserts a row the
 *      index would reject and never fails an import on a constraint — which is
 *      the decision the slice required to be stated AND covered.
 *   5. Both locales can say all of it.
 *
 * ⚠️ **THE SQL HALF IS TESTED BY READING THE FILE, WHICH IS THE ONLY WAY IT CAN
 * BE**, exactly as `document-type-name-unique.test.ts` tests migration_080. A
 * migration cannot call TypeScript, so the rule is restated in SQL and a test
 * binds the two texts. There is no database in Jest;
 * `scripts/verify-rebuild.ts` is where the CREATE actually happens.
 *
 * ⚠️ **AND THE BINDING THAT MATTERS MOST IS THAT THE TWO ADJACENT INDEXES USE
 * DIFFERENT FOLDS.** migration_080 folds a display NAME and drops everything
 * outside `[a-z0-9]`; migration_083 folds a cadastral CODE and keeps the
 * separators. §2 asserts the difference rather than leaving it to a comment,
 * because "harmonising" the two expressions is a one-line change that would
 * silently make `47/2` and `472` one code.
 */

import fs from "fs";
import path from "path";

import {
  TARLA_CODE_TAKEN_CODE,
  TARLA_CODE_UNIQUE_INDEX,
  TarlaCodeTakenError,
  asTarlaCodeTaken,
  sameTarlaCode,
  tarlaCodeTakenBy,
} from "@/lib/properties/tarla-code-guard";
import { cadastralKey, cadastralValue } from "@/lib/properties/cadastral-identity";
import { foldRomanian } from "@/lib/import/id-card";
import { normaliseDocumentTypeName } from "@/lib/documents/document-type-match";
import {
  FAILURE_CODES,
  failureFromResponse,
  takenByOf,
} from "@/lib/admin/value-lists/failures";
import { tarlaSchema } from "@/lib/admin/value-lists/validation";

const ROOT = process.cwd();

function readRoot(...parts: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...parts), "utf8");
}

const MIGRATION       = readRoot("src", "db", "migration_083_tarla_code_unique.sql");
const DECISION_CHECKS = readRoot("scripts", "decision-checks.sql");
const SCHEMA          = readRoot("src", "db", "schema", "index.ts");
const REPAIR          = readRoot("src", "db", "supabase_repair_missing_tables.sql");
const POST_ROUTE      = readRoot("src", "app", "api", "admin", "value-lists", "[list]", "route.ts");
const PUT_ROUTE       = readRoot("src", "app", "api", "admin", "value-lists", "[list]", "[id]", "route.ts");
const VL_QUERIES      = readRoot("src", "lib", "admin", "value-lists", "queries.ts");
const PROP_QUERIES    = readRoot("src", "lib", "properties", "queries.ts");

/** Whitespace is not information in SQL; everything else in these texts is. */
function squash(sql: string): string {
  return sql.replace(/\s+/g, " ").trim();
}

/**
 * The same text with whitespace around brackets and commas removed as well.
 *
 * ⚠️ **ONLY for comparing SQL against the TypeScript that restates it.** The
 * migration wraps the fold across five lines and `src/db/schema/index.ts`
 * writes it on one, so `squash` alone leaves them differing by the spaces after
 * `regexp_replace(` — a difference that is not information. Deliberately NOT a
 * blanket `replace(/\s+/g, "")`: that would also flatten the `' '` that is the
 * whitespace-collapse's REPLACEMENT argument into `''`, and a fold that
 * collapsed runs of spaces to nothing instead of to one space is a different
 * fold. The space inside those quotes is not adjacent to a bracket or a comma,
 * so it survives.
 */
function tight(sql: string): string {
  return squash(sql).replace(/\s*([(),])\s*/g, "$1");
}

/**
 * `supabase_repair_missing_tables.sql`'s copy of the CREATE, out of the
 * `EXECUTE $q$ … $q$` its guarded block wraps it in.
 *
 * ⚠️ **Anchored on the statement and terminated by the dollar-quote**, not by
 * a `;` — there is no semicolon inside that literal — and it THROWS rather
 * than widening to the file, for `indexSource`'s reason.
 */
function repairIndexSource(): string {
  // ⚠️ **SEARCHED FROM INSIDE THE BLOCK, BECAUSE THE FILE'S HEADER QUOTES THE
  // STATEMENT TOO** — `NOT PURELY ADDITIVE` lists it as a bullet, 1500 lines
  // above the block that runs it. The `not created:` WARNING is inside the
  // guarded block and above its `ELSE`, so it is a position the CREATE can only
  // follow. This is the same trap `indexSource` documents, in the second file.
  const marker = `${TARLA_CODE_UNIQUE_INDEX} not created:`;
  const from = REPAIR.indexOf(marker);
  if (from < 0) throw new Error(`repair file: no "${marker}" WARNING`);
  const anchor = `CREATE UNIQUE INDEX ${TARLA_CODE_UNIQUE_INDEX}`;
  const at = REPAIR.indexOf(anchor, from);
  if (at < 0) throw new Error(`repair file: no "${anchor}" statement in the block`);
  const end = REPAIR.indexOf("$q$", at);
  if (end < 0) throw new Error("repair file: CREATE is not inside a $q$ literal");
  return REPAIR.slice(at, end).trimEnd();
}

/**
 * migration_083's `CREATE UNIQUE INDEX` STATEMENT — from the keyword to its
 * terminating semicolon — and nothing else in the file.
 *
 * ⚠️ **It anchors on `CREATE UNIQUE INDEX IF NOT EXISTS`, which appears once,
 * and it THROWS rather than returning the file.** The migration's header
 * quotes the bare phrase `CREATE UNIQUE INDEX` while explaining what a
 * colliding table does to one, so an `indexOf` on that prefix finds a comment.
 * A helper that fell back to the whole file would make every assertion below
 * satisfiable by section 1 — which is exactly what happened to the first
 * version of this suite.
 */
function indexSource(): string {
  // ⚠️ **SEARCHED FROM `BEGIN;`, BECAUSE THE HEADER QUOTES THE STATEMENT
  // TWICE** — once as the bare `CREATE UNIQUE INDEX` that fails on a colliding
  // table, once as the `CREATE UNIQUE INDEX IF NOT EXISTS` the repair file may
  // NOT use. Everything after `BEGIN;` is executable; nothing there quotes it.
  const body = MIGRATION.indexOf("\nBEGIN;");
  if (body < 0) throw new Error("migration_083: no BEGIN;");
  const anchor = `CREATE UNIQUE INDEX IF NOT EXISTS ${TARLA_CODE_UNIQUE_INDEX}`;
  const at = MIGRATION.indexOf(anchor, body);
  if (at < 0) throw new Error(`migration_083: no "${anchor}" statement after BEGIN;`);
  const end = MIGRATION.indexOf(";", at);
  if (end < 0) throw new Error("migration_083: CREATE UNIQUE INDEX has no terminator");
  return MIGRATION.slice(at, end + 1);
}

function messages(locale: "ro-RO" | "en-GB"): Record<string, unknown> {
  return JSON.parse(readRoot("messages", `${locale}.json`));
}

/**
 * Source with comments blanked — a claim about CODE must not be satisfiable by
 * a comment about code. Block, JSX-block and line comments, in that order.
 */
function stripSourceComments(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ");
}

/**
 * Every `.ts`/`.tsx` under `src/` (tests excluded) whose CODE matches.
 *
 * ⚠️ **A WALK, NOT A LIST.** §6's invariant is about every reader that exists,
 * and a hand-written list of readers is a list that a third file joins without
 * anybody noticing — which is the exact failure mode an adversarial round
 * measured on the first version of that section. Paths are returned
 * repo-relative with forward slashes so the assertion reads the same on
 * Windows, where this suite actually runs.
 */
function productionFilesMatching(pattern: RegExp): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "__tests__" || entry.name === "node_modules") continue;
        walk(full);
      } else if (/\.tsx?$/.test(entry.name)) {
        if (pattern.test(stripSourceComments(fs.readFileSync(full, "utf8")))) {
          out.push(path.relative(ROOT, full).split(path.sep).join("/"));
        }
      }
    }
  };
  walk(path.join(ROOT, "src"));
  return out.sort();
}

function at(obj: unknown, dotted: string): unknown {
  return dotted
    .split(".")
    .reduce<unknown>(
      (acc, k) =>
        typeof acc === "object" && acc !== null
          ? (acc as Record<string, unknown>)[k]
          : undefined,
      obj,
    );
}

const ROWS = [
  { id: "id-t3",    indicativ: "T3" },
  { id: "id-47",    indicativ: "47/2" },
  { id: "id-blank", indicativ: " " },
];

// ---------------------------------------------------------------------------
// §1 One code, however it is spelled — and two codes that merely look alike
// ---------------------------------------------------------------------------

describe("§1 sameTarlaCode", () => {
  it.each([
    ["the same code",        "T3"],
    ["a different case",     "t3"],
    ["leading whitespace",   "  T3"],
    ["collapsible spacing",  "T3 "],
  ])("%s is the same code as T3", (_label, spelling) => {
    expect(sameTarlaCode(spelling, "T3")).toBe(true);
    expect(tarlaCodeTakenBy(spelling, ROWS)?.id).toBe("id-t3");
  });

  /**
   * ⚠️ **THE FOLD KEEPS THE SEPARATORS, AND THAT IS THE WHOLE REASON THIS IS
   * NOT `normaliseDocumentTypeName`.** A tarla code is a cadastral identifier;
   * `47/2` and `472` are two parcels to everyone who reads a deed. The
   * document-type fold would make them one, which is the wrong answer here and
   * the right one there.
   */
  it.each([
    ["472"],
    ["47-2"],
    ["4/72"],
  ])("%s is NOT the same code as 47/2", (spelling) => {
    expect(sameTarlaCode(spelling, "47/2")).toBe(false);
  });

  /**
   * ⚠️ **"WITHOUT EXTRA SPACES" IS EXACT, AND THE BOUNDARY IS WHERE THE TWO
   * FOLDS PART COMPANY.** `foldRomanian` COLLAPSES a run of whitespace to one
   * space and trims; it does not remove a single internal one. So `T  3` and
   * `T 3` are one code and `T 3` and `T3` are two — which is what the Romanian
   * sentence promises („fără spații în plus", surplus spaces, not all of them).
   *
   * ⚠️ **AND `cadastralKey` DISAGREES HERE, DELIBERATELY** — it removes ALL
   * whitespace (`cadastral-identity.ts`), so an import parsing a folder that
   * said `T 3` ADOPTS an existing `T3` while Reference Data treats the two as
   * different codes. That asymmetry is the whole design (§4: looser where the
   * answer is "adopt", stricter where it is "no"), and this is the one place it
   * is measured rather than argued.
   *
   * An adversarial round found the row this replaces: `sameTarlaCode("T 3",
   * "47/2")` was asserted `false` under a title about punctuation-stripped
   * neighbours, which is true of `"banana"` too and could never fail.
   */
  it("⚠️ a run of spaces folds to one, and one internal space is not removed", () => {
    expect(sameTarlaCode("T  3", "T 3")).toBe(true);
    expect(sameTarlaCode("  T 3  ", "T 3")).toBe(true);
    expect(sameTarlaCode("T 3", "T3")).toBe(false);
    // …and the import's fold is the looser one on exactly this pair.
    expect(cadastralKey("T 3")).toBe(cadastralKey("T3"));
  });

  it("⚠️ the document-type fold WOULD have merged 47/2 and 472 — this one does not", () => {
    expect(normaliseDocumentTypeName("47/2")).toBe(normaliseDocumentTypeName("472"));
    expect(sameTarlaCode("47/2", "472")).toBe(false);
  });

  it("folds diacritics, because the codes are typed by a Romanian speaker", () => {
    expect(sameTarlaCode("tarlaua-ă", "TARLAUA-Ă")).toBe(true);
    expect(sameTarlaCode("tarlaua-a", "tarlaua-ă")).toBe(true);
  });

  /**
   * ⚠️ **THE EXCEPTION, AND IT IS REACHABLE** — `tarlaSchema` accepts a single
   * space, so a whitespace-only `indicativ` is a valid payload. Two of them
   * must not be one code, or the first such row takes the empty slot and every
   * other one is refused.
   */
  it("two codes that fold to nothing are NOT the same code", () => {
    expect(tarlaSchema.safeParse({ indicativ: " " }).success).toBe(true);
    expect(foldRomanian(" ")).toBe("");
    expect(sameTarlaCode(" ", "  ")).toBe(false);
    expect(tarlaCodeTakenBy("  ", ROWS)).toBeNull();
  });

  it("is not fooled by a non-string on either side", () => {
    expect(sameTarlaCode(3, "3")).toBe(false);
    expect(sameTarlaCode("3", null)).toBe(false);
    expect(tarlaCodeTakenBy(undefined, ROWS)).toBeNull();
  });

  it("⚠️ exceptId lets a row keep its own code through a rename", () => {
    expect(tarlaCodeTakenBy("t3", ROWS, "id-t3")).toBeNull();
    expect(tarlaCodeTakenBy("t3", ROWS, "id-47")?.id).toBe("id-t3");
  });
});

// ---------------------------------------------------------------------------
// §2 The migration says the same thing, in the same words
// ---------------------------------------------------------------------------

/**
 * The body of `pg_temp.ga40_fold` from `scripts/decision-checks.sql`, which is
 * what query 1c groups `lookup_tarla` by — i.e. what the index expression has
 * to be if it is to index the text this table was measured over.
 */
const FOLD_FROM_DECISION_CHECKS = (() => {
  const m = DECISION_CHECKS.match(
    /CREATE OR REPLACE FUNCTION pg_temp\.ga40_fold\(txt text\) RETURNS text AS \$\$([\s\S]*?)\$\$/,
  );
  if (!m) throw new Error("scripts/decision-checks.sql: pg_temp.ga40_fold not found");
  return squash(m[1]).replace(/^SELECT /, "");
})();

const INDEXED_FOLD = squash(FOLD_FROM_DECISION_CHECKS.replace(/\$1/g, "indicativ"));

describe("§2 migration_083 encodes the fold this table was measured under", () => {
  it("⚠️ carries decision-checks.sql's ga40_fold, character for character", () => {
    expect(squash(MIGRATION)).toContain(INDEXED_FOLD);
  });

  it("⚠️ creates the index the code names, under the name the code holds", () => {
    expect(MIGRATION).toContain(
      `CREATE UNIQUE INDEX IF NOT EXISTS ${TARLA_CODE_UNIQUE_INDEX}`,
    );
    expect(MIGRATION).toContain("ON lookup_tarla (");
  });

  /**
   * ⚠️ **THE STATEMENT, NOT THE FILE — AND AN ADVERSARIAL ROUND MEASURED WHY
   * THAT DISTINCTION IS THE WHOLE TEST.** The first version of these two
   * assertions searched the WHOLE migration and sliced from
   * `indexOf("CREATE UNIQUE INDEX")`, which lands 193 lines early inside a
   * header sentence — „A bare `CREATE UNIQUE INDEX` on a colliding table fails
   * with an unreadable…". So `body` was the entire executable file, the fold
   * appears in it FIVE times (section 1 twice, section 2 twice, section 4
   * once), and `toBeGreaterThanOrEqual(2)` passed with the index's `WHERE`
   * DELETED — a TOTAL unique index, green. The `<> ''` assertion was satisfied
   * by section 1's `HAVING` for the same reason. Measured: 8/8 green on that
   * mutant.
   *
   * So the statement is extracted and the count is EXACT. `indexSource()`
   * refuses rather than returning a best guess, because a helper that silently
   * widens to the file is how the first version came to measure nothing.
   */
  it("⚠️ the CREATE statement exists, and this file can find it", () => {
    expect(indexSource().startsWith(
      `CREATE UNIQUE INDEX IF NOT EXISTS ${TARLA_CODE_UNIQUE_INDEX}`,
    )).toBe(true);
    expect(indexSource().trimEnd().endsWith(";")).toBe(true);
  });

  it("⚠️ excludes the empty folded form — in the INDEX, not merely somewhere", () => {
    expect(squash(indexSource())).toContain(`${INDEXED_FOLD} <> ''`);
  });

  it("⚠️ indexes and filters on the SAME expression, exactly twice", () => {
    // Postgres compares the two structurally when it decides whether a query
    // may use a partial index; two folds that differed would still create,
    // still enforce uniqueness, and cover a different set of rows than they
    // appear to. EXACTLY two: one occurrence means the `WHERE` is gone and the
    // index is total, three means something else has been folded into the
    // statement.
    const body = squash(indexSource());
    expect(`${body.split(INDEXED_FOLD).length - 1} occurrence(s) in the statement`)
      .toBe("2 occurrence(s) in the statement");
  });

  /**
   * ⚠️ **THE TWO ADJACENT INDEXES MUST NOT CONVERGE.** migration_080 folds a
   * display name and drops everything outside `[a-z0-9]`; this one folds a
   * cadastral code and keeps the separators. Harmonising them is one line and
   * would make `47/2` and `472` one code, so the difference is asserted rather
   * than left to the comment that explains it.
   */
  it("⚠️ does NOT carry migration_080's extra [^a-z0-9] strip", () => {
    expect(squash(MIGRATION)).not.toContain("'[^a-z0-9]', '', 'g'");
  });

  it("is wrapped in a transaction and is idempotent by name", () => {
    expect(MIGRATION).toContain("BEGIN;");
    expect(MIGRATION.trimEnd().endsWith("COMMIT;")).toBe(true);
    expect(MIGRATION).toContain("CREATE UNIQUE INDEX IF NOT EXISTS");
  });

  /**
   * ⚠️ **The refusal is what makes the migration readable on a database nobody
   * measured.** A bare `CREATE UNIQUE INDEX` on a colliding table fails with
   * `Key (...)=(...) is duplicated`, naming the FOLDED form and neither of the
   * two rows. Section 1 names both, their ids and their property counts — and
   * it refuses rather than merging, because deciding which of a pair survives
   * is a business question, which is migration_078's and migration_080's answer
   * to the same shape.
   */
  it("⚠️ refuses, rather than merges, when the table already collides", () => {
    expect(MIGRATION).toContain("migration_083 REFUSED");
    expect(MIGRATION).toContain("RAISE EXCEPTION");
  });

  /**
   * ⚠️ **THE NAME IS NOT THE DECLARATION, AND ONLY THE NAME WAS PINNED.**
   * `src/db/schema/index.ts`'s own ⚠️ says `.on()` and `.where()` must carry
   * the same expression as the migration; nothing compared the two texts, and
   * Drizzle does not create this index (migrations are hand-applied), so drift
   * would surface only as a `verify-rebuild.ts` baseline diff long afterwards.
   *
   * The two spellings differ in exactly two mechanical ways and the
   * normalisation below undoes both: the column arrives as the interpolation
   * `${t.indicativ}`, and a backslash inside a TypeScript template literal is
   * written doubled (`'\\s+'` for SQL's `'\s+'`).
   */
  it("⚠️ src/db/schema/index.ts declares the same index, name AND expression", () => {
    expect(SCHEMA).toContain(`uniqueIndex("${TARLA_CODE_UNIQUE_INDEX}")`);
    const at = SCHEMA.indexOf(`uniqueIndex("${TARLA_CODE_UNIQUE_INDEX}")`);
    // ⚠️ **NOT `indexOf("]", at)`** — the fold itself contains `']'`, inside
    // `'[' || chr(768) || '-' || chr(879) || ']'`, so the first `]` after the
    // call is four lines INSIDE the expression. The table's own terminator is
    // what ends the declaration.
    const close = SCHEMA.indexOf("\n  ],\n);", at);
    expect(`table terminator: ${close > at ? "found" : "MISSING"}`).toBe(
      "table terminator: found",
    );
    const declaration = tight(SCHEMA.slice(at, close))
      .replace(/\$\{t\.indicativ\}/g, "indicativ")
      .replace(/\\\\s/g, "\\s");
    const fold = tight(INDEXED_FOLD);
    expect(`.on(): ${declaration.includes(fold) ? "the migration's fold" : "SOMETHING ELSE"}`)
      .toBe(".on(): the migration's fold");
    // ⚠️ Built by the SAME normalisation rather than typed out, so the
    // predicate cannot drift from the expression it is compared against.
    const partial = tight(`${INDEXED_FOLD} <> ''`);
    expect(`.where(): ${declaration.includes(partial) ? "the migration's fold" : "SOMETHING ELSE"}`)
      .toBe(".where(): the migration's fold");
    // Exactly twice here too, for the reason the statement's own test gives.
    expect(`${declaration.split(fold).length - 1} occurrence(s) in the declaration`)
      .toBe("2 occurrence(s) in the declaration");
  });

  /**
   * The ADDITIVE door. `supabase_repair_missing_tables.sql` runs under
   * `psql -f` with no ON_ERROR_STOP, so its block must count first and WARN
   * rather than attempt a CREATE that could fail and scroll past a post-flight
   * still reporting OK — and section 10 must ask about the skip afterwards,
   * because a guard that turns a failure into a silent skip has moved the
   * problem rather than solved it.
   */
  it("⚠️ the repair file creates it, counting first, and asks about it at the end", () => {
    expect(REPAIR).toContain(`CREATE UNIQUE INDEX ${TARLA_CODE_UNIQUE_INDEX}`);
    expect(REPAIR).toContain(`${TARLA_CODE_UNIQUE_INDEX} not created:`);
    expect(REPAIR).toContain("lookup_tarla has no partial unique index over the folded indicativ");
  });

  /**
   * ⚠️ **AND ITS CREATE STATEMENT IS EXTRACTED, FOR THE REASON `indexSource`
   * EXISTS — AN ADVERSARIAL ROUND PROVED THE FILE-WIDE VERSION MEASURED
   * NOTHING.** The assertion above used to end `expect(squash(REPAIR))
   * .toContain(INDEXED_FOLD)`, which is satisfied by the `dupes` PRE-COUNT
   * twenty lines above the statement, in the same block. Measured, each of
   * these left the suite green: deleting the CREATE's `WHERE` (a TOTAL unique
   * index on the cloud only), swapping its fold for migration_080's, and
   * replacing the whole expression with `lower(indicativ)`.
   *
   * That door is the one that creates the index on a repaired Supabase
   * project, so a drift there is a database whose rule disagrees with
   * `tarla-code-guard.ts` — and it disagrees only in the cloud, which is the
   * hardest place to notice it.
   */
  it("⚠️ the repair file's CREATE carries the same fold, twice, partial", () => {
    const statement = repairIndexSource();
    expect(statement.startsWith(`CREATE UNIQUE INDEX ${TARLA_CODE_UNIQUE_INDEX}`)).toBe(true);
    const body = squash(statement);
    expect(`${body.split(INDEXED_FOLD).length - 1} occurrence(s) in the repair CREATE`)
      .toBe("2 occurrence(s) in the repair CREATE");
    expect(body).toContain(`${INDEXED_FOLD} <> ''`);
    // …and the two statements are the same statement, bar the `IF NOT EXISTS`
    // the repair file deliberately does NOT use (its block probes by shape and
    // guards the create itself — see the migration's "OTHER DOORS" section).
    expect(squash(indexSource()).replace(" IF NOT EXISTS", "").replace(/;$/, ""))
      .toBe(body);
  });
});

// ---------------------------------------------------------------------------
// §3 The refusal an administrator reads
// ---------------------------------------------------------------------------

describe("§3 the refusal itself", () => {
  it("carries the colliding spelling, which is the point of it", () => {
    const err = new TarlaCodeTakenError("T3");
    expect(err.takenBy).toBe("T3");
    expect(err.message).toBe(TARLA_CODE_TAKEN_CODE);
    expect(asTarlaCodeTaken(err)).toBe(err);
    expect(asTarlaCodeTaken(new Error(TARLA_CODE_TAKEN_CODE))).toBeNull();
  });

  it("⚠️ both write doors sit on the guard, not just the create one", () => {
    // A guard on CREATE alone is a lock on a door with the window open beside
    // it: Reference Data's edit form renames a code.
    const code = stripSourceComments(VL_QUERIES);
    expect(code).toContain("return writeTarlaRow(data.indicativ, null,");
    expect(code).toContain("return writeTarlaRow(data.indicativ, id,");
    // One implementation, two callers — not a copy per branch.
    expect(code.match(/tarlaCodeTakenBy\(/g)?.length).toBe(1);
  });

  /**
   * ⚠️ **THE CHECK AND THE WRITE ARE ONE TRANSACTION, UNDER THE SAME LOCKS THE
   * IMPORT TAKES — AND AN ADVERSARIAL ROUND IS WHY THIS TEST EXISTS.**
   * The first version of this door was a lockless read on `db` followed by a
   * write on `db`, on the argument that migration_083's index is the
   * serialisation and both routes map its 23505 into the same sentence. True of
   * THIS door and false of the other one: `resolveTarlaForCreate` inserts here
   * too, and when IT loses the race the 23505 is not mapped anywhere — the
   * whole property create rolls back under the generic Romanian sentence.
   *
   * Three claims, because each fails on its own: the write is inside the
   * transaction (a lock released before the write guarantees nothing), the
   * locks come from the shared `tarlaLockIdentities` (a second opinion about
   * the identity string would serialise nothing), and they are taken BEFORE
   * the scan (a lock after the read it protects is a round trip and nothing
   * else).
   */
  it("⚠️ takes the import's own locks, before the READ, with the write inside", () => {
    // ⚠️ **COMMENTS STRIPPED FIRST.** This is a BEHAVIOUR guard, and a
    // behaviour guard must read only code — the repo's own habit. Measured by
    // an adversarial round: replacing the lock loop with
    // `void tarlaLockIdentities(code); // pg_advisory_xact_lock` left every
    // assertion here green, because the string it looks for had moved into a
    // comment.
    const source = stripSourceComments(VL_QUERIES);
    const at = source.indexOf("async function writeTarlaRow<T>(");
    expect(at).toBeGreaterThan(-1);
    const fn = source.slice(at);
    const body = fn.slice(0, fn.indexOf("\n}\n"));

    expect(body).toContain("db.transaction(");
    expect(body).toContain("return write(tx);");

    // ⚠️ **THE GUARD'S CONDITION, PINNED — BECAUSE EVERY ASSERTION BELOW IS
    // ABOUT ORDER AND ORDER SURVIVES UNREACHABILITY.** Measured: changing
    // `if (typeof code === "string")` to `if (false)` leaves the locks, the
    // read, the predicate and the refusal all present and all in sequence, and
    // every other test in this file green, with the whole guard dead. The one
    // arm it may legitimately skip is a caller that names no code at all.
    expect(body).toContain('if (typeof code === "string") {');

    // ⚠️ **AND THE LOOP RUNS TO COMPLETION, WHICH IS THE SLICE'S CENTRAL
    // CLAIM.** The chain below pins that `tarlaLockIdentities` is called and
    // that a lock is taken before the read; it does not pin that BOTH
    // identities are locked, and "both" is the whole of why there are two. The
    // plausible regression — reverting to #34.14's single `advisoryLockKeys(
    // "tarla:" + …)` — is caught by the chain, because it removes the call this
    // pins; a `break` inside the loop is not, so it is excluded by name.
    const loop = body.slice(
      body.indexOf("for (const identity of tarlaLockIdentities(code))"),
      body.indexOf(".select({ id: lookupTarla.id"),
    );
    expect(`loop: ${loop.includes("break") || loop.includes("return") ? "EXITS EARLY" : "runs to completion"}`)
      .toBe("loop: runs to completion");

    // ⚠️ **THE ANCHOR IS THE `SELECT`, NOT THE PREDICATE, AND THE SAME ROUND
    // MEASURED WHY.** This read `body.indexOf("tarlaCodeTakenBy(code, rows,
    // exceptId)")` — the pure-JS predicate, which runs on rows already in
    // memory. Moving the lock loop to sit BETWEEN the `tx.select(...)` and that
    // predicate kept the whole chain in order and stayed green, while the read
    // the locks exist to protect had become unlocked: a racer committing
    // between the SELECT's snapshot and the lock is exactly the twin this
    // function was added to stop.
    const identities = body.indexOf("tarlaLockIdentities(code)");
    const lockCall   = body.indexOf("pg_advisory_xact_lock");
    const read       = body.indexOf(".select({ id: lookupTarla.id");
    const predicate  = body.indexOf("tarlaCodeTakenBy(code, rows, exceptId)");
    const refusal    = body.indexOf("throw new TarlaCodeTakenError(taken.indicativ)");
    const write      = body.indexOf("return write(tx);");
    for (const [what, idx] of [
      ["identities", identities], ["lock call", lockCall], ["read", read],
      ["predicate", predicate], ["refusal", refusal], ["write", write],
    ] as const) {
      expect(`${what}: ${idx > -1 ? "present" : "MISSING"}`).toBe(`${what}: present`);
    }
    // identities → lock → READ → decide → refuse-or-write. Nothing out of order.
    expect(identities).toBeLessThan(lockCall);
    expect(lockCall).toBeLessThan(read);
    expect(read).toBeLessThan(predicate);
    expect(predicate).toBeLessThan(refusal);
    expect(refusal).toBeLessThan(write);

    // ⚠️ **AND THE REFUSAL QUOTES THE ROW, NOT THE INPUT.** `taken.indicativ`
    // is the spelling already in the list; `code` is what the administrator
    // just typed. Throwing the latter would render „…se citește la fel ca
    // acesta: „t3"" at somebody who has just typed `t3`, which is the one
    // thing the `{code}` placeholder and the whole `takenBy` wire field exist
    // to avoid. The index in the chain above pins that the throw is there at
    // all; this pins what it carries.
    expect(body).toContain("throw new TarlaCodeTakenError(taken.indicativ);");

    // The read goes through the TRANSACTION, not through `db` — a read on the
    // pool would not be covered by the locks this function has just taken, and
    // the whole point is that the check and the write see one state.
    expect(squash(body)).toContain(
      "const rows = await tx .select({ id: lookupTarla.id, indicativ: lookupTarla.indicativ }) .from(lookupTarla);",
    );
    expect(body.slice(read - 40, read)).not.toContain("db");
  });

  it.each([
    ["POST", POST_ROUTE],
    ["PUT",  PUT_ROUTE],
  ])("%s answers a named 400 with the code, and names the row", (_verb, source) => {
    expect(source).toContain("asTarlaCodeTaken(err)");
    expect(source).toContain("code: TARLA_CODE_TAKEN_CODE");
    expect(source).toContain("takenBy: tarlaTaken.takenBy");
  });

  /**
   * ⚠️ **THE RACE ARM.** The guard is a read and then a write, so two
   * administrators typing one code in the same instant both pass it;
   * migration_083's index is what makes the loser fail, and it must arrive as
   * the same refusal rather than as `dbErrorToResponse`'s generic 409.
   * Recognised by CONSTRAINT because that body carries no `code` at all.
   */
  it.each([
    ["POST", POST_ROUTE],
    ["PUT",  PUT_ROUTE],
  ])("%s maps migration_083's 23505 onto the same refusal", (_verb, source) => {
    expect(source).toContain('pgErrorCode(err) === "23505"');
    expect(source).toContain("pgErrorConstraint(err) === TARLA_CODE_UNIQUE_INDEX");
  });
});

// ---------------------------------------------------------------------------
// §4 The import adopts — the decision this slice had to state
// ---------------------------------------------------------------------------

/**
 * ⚠️ **WHY THIS SECTION EXISTS AT ALL.** `createPropertyIn` auto-seeds a tarla
 * from a value an import parsed out of a folder name, and a unique index over
 * the fold reaches that path too. Silently failing an import on a constraint
 * violation is the outcome the slice named as the one an adversarial round
 * should find, so the decision — ADOPT, never refuse — is covered here rather
 * than asserted in a comment.
 */
describe("§4 resolveTarlaForCreate adopts rather than minting a refused row", () => {
  /**
   * ⚠️ **THE MEASURED CASE THAT MAKES THE SECOND PASS NECESSARY, AND EVERY
   * PIECE OF IT IS REACHABLE.** `cadastralKey` applies `perToSlash` BEFORE
   * folding — `/(?<=\d)\s*per\s*(?=\d)/gi`, which is case-insensitive and
   * knows nothing about diacritics — so it is not a coarsening of
   * `foldRomanian`. The two folds cut the same strings into different classes.
   *
   *   • THE STORED ROW is `47PER2`. Reference Data's create door writes
   *     `data.indicativ` verbatim — it does NOT apply `cadastralValue` — so a
   *     person can type exactly this.
   *   • THE IMPORT'S VALUE is `cadastralValue("47pér2")`, which is `47pér2`
   *     unchanged, because `pér` is not `per` to that regex.
   *
   * To the SCAN those are `47/2` and `47per2` — a miss, so it would insert. To
   * the INDEX both fold to `47per2` — one code, so the insert is refused. That
   * is an import dying on a 23505 over a spelling, and it is what the second
   * pass removes.
   */
  it("⚠️ cadastralKey is NOT a coarsening of the index's fold — measured", () => {
    const stored = "47PER2";                      // an administrator typed this
    const value  = cadastralValue("47pér2");      // what an import would store
    expect(value).toBe("47pér2");

    // The scan misses…
    expect(cadastralKey(value)).not.toBe(cadastralKey(stored));
    // …and the index would have refused the row the scan was about to insert.
    expect(foldRomanian(value)).toBe(foldRomanian(stored));
    expect(sameTarlaCode(value, stored)).toBe(true);

    // Which is exactly what the second pass answers.
    expect(tarlaCodeTakenBy(value, [{ id: "stored", indicativ: stored }])?.id)
      .toBe("stored");
  });

  it("the ordinary case the slice names: a folder saying t3 where T3 exists", () => {
    const value = cadastralValue("t3");
    // Both folds agree here, so the FIRST pass already adopts — which is why
    // this has never minted a twin and the Reference Data door has.
    expect(cadastralKey(value)).toBe(cadastralKey("T3"));
    expect(sameTarlaCode(value, "T3")).toBe(true);
  });

  it("⚠️ the scan asks both folds, in that order, before it inserts", () => {
    const fn = PROP_QUERIES.slice(
      PROP_QUERIES.indexOf("async function resolveTarlaForCreate("),
    );
    const body = fn.slice(0, fn.indexOf("\n}\n"));
    const first  = body.indexOf("cadastralKey(r.indicativ) === wanted");
    const second = body.indexOf("sameTarlaCode(value, r.indicativ)");
    const insert = body.indexOf(".insert(lookupTarla)");
    expect(first).toBeGreaterThan(-1);
    expect(second).toBeGreaterThan(first);
    expect(insert).toBeGreaterThan(second);
  });

  it("⚠️ and it does NOT refuse — no tarla refusal is thrown from this path", () => {
    expect(PROP_QUERIES).not.toContain("TarlaCodeTakenError");
  });

  /**
   * The two seeds write this column too, and both looked a code up by exact
   * equality — which was untidy before the index and is a failed seed after
   * it. Both adopt now, by the same fold.
   */
  it("⚠️ the seeds adopt by the fold as well", () => {
    expect(readRoot("src", "db", "seed.ts")).toContain("sameTarlaCode(code, r.indicativ)");
    expect(squash(readRoot("src", "db", "seed_dev_data.sql"))).toContain(INDEXED_FOLD.replace(/indicativ/g, "t.indicativ"));
  });
});

// ---------------------------------------------------------------------------
// §5 Both locales can say it
// ---------------------------------------------------------------------------

describe("§5 the sentence a business user reads", () => {
  const ro = messages("ro-RO");
  const en = messages("en-GB");

  it("both codes are members of FAILURE_CODES", () => {
    expect(FAILURE_CODES).toContain("tarlaCodeTaken");
    expect(FAILURE_CODES).toContain("tarlaCodeTakenRace");
  });

  it.each(["tarlaCodeTaken", "tarlaCodeTakenRace"])(
    "%s exists in both locales",
    (key) => {
      expect(typeof at(ro, `valueList.confirm.errors.${key}`)).toBe("string");
      expect(typeof at(en, `valueList.confirm.errors.${key}`)).toBe("string");
    },
  );

  /**
   * ⚠️ **ONE OF THE TWO TAKES AN ARGUMENT AND THE OTHER MUST NOT.** The whole
   * reason there are two members for one wire code is that the race arm has no
   * spelling to quote — Postgres's 23505 names the FOLDED key, not the row — so
   * a single message with an empty slot in it would read as a refusal of a code
   * the sentence then failed to name.
   */
  it.each([
    ["ro-RO", ro],
    ["en-GB", en],
  ])("%s names the existing code, and only on the arm that has one", (_locale, m) => {
    expect(String(at(m, "valueList.confirm.errors.tarlaCodeTaken"))).toContain("{code}");
    expect(String(at(m, "valueList.confirm.errors.tarlaCodeTakenRace"))).not.toContain("{code}");
  });

  /**
   * ⚠️ **THE SERVER SENDS ONE CODE; THIS SIDE SPLITS IT ON WHETHER A ROW WAS
   * NAMED.** Asserted behaviourally, through the real function, because the
   * split is the thing that would silently collapse back into one branch.
   */
  it("failureFromResponse picks the arm from the body, not from the status", () => {
    expect(failureFromResponse(400, { code: TARLA_CODE_TAKEN_CODE, takenBy: "T3" }))
      .toBe("tarlaCodeTaken");
    expect(failureFromResponse(400, { code: TARLA_CODE_TAKEN_CODE }))
      .toBe("tarlaCodeTakenRace");
    expect(failureFromResponse(400, { code: TARLA_CODE_TAKEN_CODE, takenBy: "" }))
      .toBe("tarlaCodeTakenRace");
  });

  it("takenByOf answers null for every other failure", () => {
    expect(takenByOf({ code: "document_type_name_taken" })).toBeNull();
    expect(takenByOf(null)).toBeNull();
    expect(takenByOf({ takenBy: 7 })).toBeNull();
    expect(takenByOf({ takenBy: "T3" })).toBe("T3");
  });
});

// ---------------------------------------------------------------------------
// §6 Every reader of `valueList.confirm.errors.*` passes a values object
// ---------------------------------------------------------------------------

/**
 * ⚠️ **THE INVARIANT NOTHING PROTECTED, AND THE FAILURE IT PREVENTS IS THE
 * SILENT ONE.**                                                 (Slice #34.32)
 *
 * `tarlaCodeTaken` is the first message under this namespace with an ICU
 * placeholder. `use-intl` short-circuits with `return values || …` BEFORE it
 * reaches `IntlMessageFormat`, so a call site that omits the second argument
 * does NOT throw and does NOT fall back to the key path — it returns the
 * message VERBATIM, putting the literal text `{code}` on a Romanian-only
 * screen with nothing logged anywhere. (An empty `{}` is the case that renders
 * the key path, which is at least visible.)
 *
 * So the guard cannot be "the message exists in both locales" — §5 has that —
 * it has to be "every reader passes values", and BOTH halves of "every" have to
 * be derived rather than remembered: no file outside the two known readers
 * resolves one of these keys, and inside those two, every call is found
 * whatever it is called and however it is wrapped. A hard-coded total was tried
 * and retired — see the repo-walk test below for why — so what stands in its
 * place is a matcher that cannot be slipped past, not a number.
 *
 * ⚠️ Read from SOURCE, comments stripped, because there is no way to reach a
 * React component's call site without a renderer, and a claim about a call
 * site must not be satisfiable by a comment about one.
 */
describe("§6 every confirm.errors reader passes an ICU values object", () => {
  const READER_FILES = [
    "src/app/admin/value-lists/_components/value-list-modal.tsx",
    "src/app/admin/value-lists/_components/document-persons-modal.tsx",
  ] as const;
  const READERS = READER_FILES.map(
    (f) => [f.split("/").pop() as string, readRoot(...f.split("/"))] as const,
  );

  /**
   * Every call that resolves a `confirm.errors.*` key, in either of the two
   * shapes a reader can take: a key path built under a wider scope
   * (`` t(`confirm.errors.${…}` …) ``, the modal's) and a SCOPED HANDLE
   * (`tErr(…)`, the panel's). Each is matched up to its closing `)` by brace
   * counting rather than by a lazy regex, which would stop at the first `)`
   * inside the arguments.
   *
   * ⚠️ **THE HANDLE NAMES ARE READ OUT OF THE FILE AND THE OPENERS TOLERATE
   * WHITESPACE — AN ADVERSARIAL ROUND GOT PAST THE FIRST VERSION WITH BOTH.**
   * That version searched two string literals, `` "t(`confirm.errors." `` and
   * `"tErr("`, so a call formatted across lines (`t(\n  `confirm.errors.…`\n)`)
   * or a second handle under any other local name (`tE`, `tError`) was invisible
   * to every assertion in this section — green, with a call site rendering the
   * literal text `{code}` on a Romanian-only screen. Both holes are closed by
   * deriving rather than remembering: the handle names come from the file's own
   * `useTranslations("valueList.confirm.errors")` declarations, and the openers
   * are regexes that allow whitespace after the `(`.
   */
  function errorCalls(source: string): string[] {
    const body = stripSourceComments(source);
    // `const tErr = useTranslations("valueList.confirm.errors")` — any name.
    // ⚠️ **DEDUPLICATED — a file may declare the same handle name in two
    // components** (`document-persons-modal.tsx` declares `tErr` twice), and a
    // name searched twice reports every call twice, which would make the
    // per-call assertion run on duplicates and any count meaningless.
    const handles = [...new Set([
      ...body.matchAll(
        /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*useTranslations\(\s*["'`]valueList\.confirm\.errors["'`]\s*\)/g,
      ),
    ].map((m) => m[1]))];
    const openers = [
      // A key path under a wider scope, with any callee name.
      /\b[A-Za-z_$][\w$]*\s*\(\s*(?=[`"']confirm\.errors\.)/g,
      // A scoped handle, by every name the file declares for one.
      ...handles.map((h) => new RegExp(`\\b${h}\\s*\\(`, "g")),
    ];
    // Keyed by the position of the `(`, so a call an opener finds twice — or
    // that two openers both find — is one call.
    const found = new Map<number, string>();
    for (const opener of openers) {
      opener.lastIndex = 0;
      for (;;) {
        const m = opener.exec(body);
        if (m === null) break;
        const at = m.index;
        const open = body.indexOf("(", at);
        let depth = 0;
        let end = -1;
        for (let i = open; i < body.length; i++) {
          if (body[i] === "(") depth += 1;
          else if (body[i] === ")") {
            depth -= 1;
            if (depth === 0) { end = i; break; }
          }
        }
        // ⚠️ **AN UNBALANCED PARSE IS A FAILURE, NOT A GUESS.** Pushing
        // `body.slice(open)` — the whole rest of the file — was what the first
        // version did, and the rest of a file trivially satisfies every
        // assertion below: a parse this helper could not complete would have
        // been a GREEN. A sentinel that cannot pass is the honest answer.
        found.set(open, end < 0 ? "(UNBALANCED CALL)" : body.slice(open, end + 1));
      }
    }
    return [...found.entries()].sort((a, b) => a[0] - b[0]).map(([, call]) => call);
  }

  /**
   * The second argument, judged by SHAPE rather than by its contents.
   *
   * ⚠️ **AN ADVERSARIAL ROUND MEASURED THE FIRST VERSION AGAINST THREE
   * LEGITIMATE SPELLINGS AND IT FAILED ALL THREE.** It required
   * `call.toContain("code:")`, which rejects `tErr(c, { code })` — the ES6
   * shorthand, and the most natural way to write this exact call — as well as
   * `tErr(c, values)` and `tErr(c, { ...values })`. All three DO pass values.
   * What has to be true is narrower and checkable: there is a top-level second
   * argument, and it is not the empty object literal `{}` — which is the one
   * spelling `use-intl` treats as "values were supplied" while supplying none,
   * and which renders the raw key path.
   */
  function secondArgument(call: string): "missing" | "empty" | "present" {
    // `call` starts at `(` and ends at its matching `)`.
    const inner = call.slice(1, -1);
    let depth = 0;
    for (let i = 0; i < inner.length; i++) {
      const ch = inner[i];
      if (ch === "(" || ch === "[" || ch === "{") depth += 1;
      else if (ch === ")" || ch === "]" || ch === "}") depth -= 1;
      else if (ch === "," && depth === 0) {
        const rest = inner.slice(i + 1).trim();
        if (rest === "") return "missing";
        return /^\{\s*\}$/.test(rest.replace(/,$/, "").trim()) ? "empty" : "present";
      }
    }
    return "missing";
  }

  it.each(READERS)("%s — every call carries a values argument", (_file, source) => {
    const calls = errorCalls(source);
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      // Asserted as a sentence carrying the call so a failure names the
      // offending site rather than printing `false`.
      expect(`${call.slice(0, 60)} … : ${secondArgument(call)}`)
        .toBe(`${call.slice(0, 60)} … : present`);
    }
  });

  /**
   * ⚠️ **A LOWER BOUND PLUS A SEARCH, NOT A HARD-CODED TOTAL — AND THE ROUND
   * THAT CAUGHT THE HARD-CODED ONE IS WHY.** `expect(total).toBe(4)` was a
   * landmine in both directions: a legitimately deleted call site failed with
   * „3 call site(s)" and no pointer to the file, and — far worse — it said
   * nothing at all about a reader in a THIRD file, which is the case the
   * invariant is actually about. So the shape is the one `FAILURE_CODES`
   * itself uses: derive the population, do not remember it.
   */
  it("⚠️ no file outside the two known readers resolves a confirm.errors key", () => {
    // Both ways a reader can reach these messages: a scoped handle
    // (`useTranslations("valueList.confirm.errors")`, the panel's shape) and a
    // key path built under a wider scope (`` t(`confirm.errors.${…}`) ``, the
    // modal's). Comments are blanked first — four files DISCUSS these keys at
    // length and resolve none of them: `failures.ts`, `tarla-code-guard.ts`,
    // the value-lists POST, and `doc-type-person-roles/route.ts`. (⚠️ This
    // named "the two write routes"; the PUT contains no `confirm.errors.` at
    // all, and the one file NOT this slice's own was the one left out. An
    // adversarial round re-derived the list with this test's own regex.)
    const found = productionFilesMatching(
      /useTranslations\(\s*["'`]valueList\.confirm\.errors["'`]\s*\)|confirm\.errors\./,
    );
    expect(found.filter((f) => !(READER_FILES as readonly string[]).includes(f)))
      .toEqual([]);
  });

  it("the two known readers hold at least one call each", () => {
    for (const [file, source] of READERS) {
      expect(`${file}: ${errorCalls(source).length > 0 ? "has calls" : "NO CALLS"}`)
        .toBe(`${file}: has calls`);
    }
  });

  /**
   * And the other half of the invariant: exactly one message under this
   * namespace has a placeholder. If a second ever gains one, the assertion
   * above is what keeps it renderable — this one is what makes the change
   * visible.
   */
  it.each([
    ["ro-RO", messages("ro-RO")],
    ["en-GB", messages("en-GB")],
  ])("%s — tarlaCodeTaken is the only message here that takes an argument", (_locale, m) => {
    const errors = at(m, "valueList.confirm.errors") as Record<string, string>;
    const withArgs = Object.entries(errors)
      .filter(([, text]) => /\{[a-zA-Z]/.test(text))
      .map(([key]) => key);
    expect(withArgs).toEqual(["tarlaCodeTaken"]);
  });
});
